/**
 * CC Gacha ingestion — machines, pool NFTs, and pulls (winners feed).
 *
 * Three ingest functions, composable per cron cadence:
 *   - ingestGachaMachines: /api/machines → append-only gacha_machines snapshots
 *     (odds, stock, buyback %, platform EV). Cheap; run with pool.
 *   - ingestGachaPool: /api/getNfts per (code, rarity) → gacha_pool_nfts upserts.
 *     Top-100-per-tier cap; lastSeenAt staleness ≠ left-the-pool (see recon doc).
 *   - ingestGachaPulls: /api/getAllWinners → gacha_pulls accumulation. The feed
 *     only serves the latest ~200 rows, so run this every 2-3 min; missed
 *     windows are unrecoverable.
 *
 * Mint resolution: gacha NFTs carry sparse attributes (no Set / Card Name /
 * often no Serial Number) but a rich title string ("2024 #232 Mew EX PSA 10
 * Paf EN-Paldean Fates"). Identity = attributes where present, title parse for
 * the gaps. Resolutions are cached in mint_card_map (platform
 * "collector-crypt" — gacha mints ARE CC-vaulted mints), so the main listings
 * pipeline benefits too. English-only matching (same language gate as
 * magic-eden.ts — JP sets reuse EN set codes and would mismatch).
 *
 * Usage: npx tsx src/lib/ingestion/gacha.ts [machines|pool|pulls|all]
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { GachaClient, type GachaNft, type GachaWinner } from "./clients/gacha-client";
import { parseCollectorCryptAttributes, normalizeCardNumber } from "../games/pokemon/collector-crypt-attributes";
import { parseGachaTitle } from "../games/pokemon/gacha-title-parser";
import { buildResolutionContext, type ResolutionContext } from "./magic-eden";

const PLATFORM = "collector-crypt";
const RARITIES = ["common", "uncommon", "rare", "epic"] as const;

export const DEFAULT_POOL_CODES = (process.env.GACHA_POOL_CODES ?? "pokemon_50")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PRIZE_TIER_RARITY: Record<number, string> = {
  1: "epic",
  2: "rare",
  3: "uncommon",
  4: "common",
};

// ─── Machines ─────────────────────────────────────────────────────────────────

export interface MachinesReport {
  machinesObserved: number;
  snapshotsInserted: number;
}

export async function ingestGachaMachines(
  sql: any,
  client: GachaClient
): Promise<MachinesReport> {
  const machines = await client.getMachines();
  let inserted = 0;
  for (const m of machines) {
    await sql`
      INSERT INTO gacha_machines (
        code, name, price_usd, instant_buyback_pct,
        odds, tier_ranges, stock, platform_ev, target_ev, is_public
      ) VALUES (
        ${m.code}, ${m.name ?? null}, ${m.price ?? null}, ${m.instantBuyback ?? null},
        ${JSON.stringify(m.odds ?? {})}::jsonb,
        ${JSON.stringify(m.tierRanges ?? {})}::jsonb,
        ${JSON.stringify(m.stock ?? {})}::jsonb,
        ${Number.isFinite(m.ev) ? m.ev : null},
        ${Number.isFinite(m.targetEv) ? m.targetEv : null},
        ${m.public ?? true}
      )
    `;
    inserted++;
  }
  return { machinesObserved: machines.length, snapshotsInserted: inserted };
}

// ─── Mint resolution (shared by pool + pulls) ─────────────────────────────────

interface GachaIdentitySource {
  mintAddress: string;
  title: string | null; // description / json_name — the rich string
  attributes: Array<{ trait_type: string; value: string | number }> | null;
  categoryHint: string | null; // e.g. from pack_type prefix ("pokemon_50" → "Pokemon")
}

interface Resolver {
  resolve(item: GachaIdentitySource): Promise<string | null>; // collectibleId | null
  resolvedCount: number;
  attemptedCount: number;
}

export function categoryFromPackType(packType: string | null | undefined): string | null {
  if (!packType) return null;
  const prefix = packType.split("_")[0]?.toLowerCase();
  if (!prefix) return null;
  if (prefix === "pokemon" || prefix === "pikachu" || prefix === "gengar" || prefix === "charizard") return "Pokemon";
  if (prefix === "onepiece") return "One Piece";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/**
 * Builds a resolver that caches known mints (from mint_card_map) and fuzzy
 * set-name lookups in memory, and writes new resolutions to mint_card_map.
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildGachaResolver(
  sql: any,
  ctx: ResolutionContext,
  mints: string[]
): Promise<Resolver> {
  const known = new Map<string, string | null>(); // mint → collectibleId|null
  if (mints.length > 0) {
    const rows = (await sql`
      SELECT mint_address, collectible_id FROM mint_card_map
      WHERE mint_address = ANY(${mints})
    `) as Array<{ mint_address: string; collectible_id: string | null }>;
    for (const r of rows) known.set(r.mint_address, r.collectible_id);
  }

  // Valid set codes (for the abbrev-as-code path: "Svp" → svp, "Smp" → smp).
  const validCodes = new Set(
    Array.from(ctx.setCodeByName.values(), (c) => c.toLowerCase())
  );

  // Punctuation-insensitive set names, longest first, for substring scanning
  // ("Celebrations: Classic Collection" matches inside "Celebrations - Classic
  // Collection"; longest-first so subset names beat their parent set).
  const normalizedSets: Array<{ norm: string; code: string }> = Array.from(
    ctx.setCodeByName.entries(),
    ([name, code]) => ({ norm: normalizeForMatch(name), code })
  )
    .filter((s) => s.norm.length >= 3)
    .sort((a, b) => b.norm.length - a.norm.length);

  function substringScanSetCode(
    blob: string,
    prefer: "suffix" | "any" = "any"
  ): string | null {
    const norm = ` ${normalizeForMatch(blob)} `;
    // Suffix preference: grammar-1 set parts put the set name last ("Sun &
    // Moon Team Up" → "Team Up" sm9, not era prefix "Sun & Moon" sm1).
    if (prefer === "suffix") {
      for (const s of normalizedSets) {
        if (norm.endsWith(` ${s.norm} `)) return s.code;
      }
    }
    // Otherwise pick the match starting LATEST in the blob — PSA-label blobs
    // lead with the era ("Sword & Shield Lost Origin …"), and the real set
    // name follows the era prefix. Tie-break: longest (list is sorted).
    let best: { code: string; idx: number } | null = null;
    for (const s of normalizedSets) {
      const idx = norm.indexOf(` ${s.norm} `);
      if (idx >= 0 && (!best || idx > best.idx)) best = { code: s.code, idx };
    }
    return best?.code ?? null;
  }

  const fuzzySetCache = new Map<string, string | null>(); // set name → set code

  async function fuzzySetCode(setName: string): Promise<string | null> {
    const key = setName.toLowerCase();
    if (fuzzySetCache.has(key)) return fuzzySetCache.get(key)!;
    const rows = (await sql`
      SELECT code FROM sets
      WHERE game = 'pokemon' AND name % ${setName}
      ORDER BY similarity(name, ${setName}) DESC
      LIMIT 1
    `) as Array<{ code: string }>;
    const code = rows[0]?.code ?? null;
    fuzzySetCache.set(key, code);
    return code;
  }

  // Subset-number retry: TG/GG/SV-prefixed numbers live in sibling "gallery" /
  // "shiny vault" sets (swsh11 TG6 → swsh11tg; swsh12pt5 GG10 → swsh12pt5gg;
  // sm115 SV77 → sma; swsh45 SV… → swsh45sv).
  function candidateSetCodes(setCode: string, cardNumber: string): string[] {
    const codes = [setCode];
    const prefix = cardNumber.match(/^(tg|gg|sv)\d+/i)?.[1]?.toLowerCase();
    if (prefix === "tg") codes.push(`${setCode}tg`);
    if (prefix === "gg") codes.push(`${setCode}gg`);
    if (prefix === "sv") codes.push(`${setCode}sv`, "sma");
    return codes;
  }

  function lookupCollectible(setCode: string, rawNumber: string | null, normNumber: string | null): string | null {
    // Try normalized ("SV77"→"sv77") and raw ("SM04") number forms — catalog
    // padding conventions vary by set.
    const numbers = [normNumber, rawNumber?.split("/")[0]?.trim()]
      .filter((n): n is string => !!n)
      .map((n) => n.toLowerCase());
    // Era-prefixed promo numbers: swshp stores "SWSH075" while titles say
    // "#075" — retry plain numerics with the code's era prefix attached.
    const code0 = setCode.toLowerCase();
    if (code0.endsWith("p") && numbers[0] && /^\d+$/.test(numbers[0])) {
      const era = code0.slice(0, -1); // swshp → swsh
      for (const n of [...numbers]) {
        numbers.push(`${era}${n}`, `${era}${n.padStart(3, "0")}`);
      }
    }
    for (const code of candidateSetCodes(code0, numbers[0] ?? "")) {
      for (const num of numbers) {
        const hit = ctx.collectibleByKey.get(`${code}|${num}`);
        if (hit) return hit;
      }
    }
    return null;
  }

  const resolver: Resolver = {
    resolvedCount: 0,
    attemptedCount: 0,
    async resolve(item: GachaIdentitySource): Promise<string | null> {
      // Already resolved to a collectible → done, no re-work.
      const existing = known.get(item.mintAddress);
      if (existing) return existing;

      const attrParsed = parseCollectorCryptAttributes(item.attributes ?? undefined);
      const titleParsed = parseGachaTitle(item.title);
      if (!attrParsed && !titleParsed) return null;

      const category = attrParsed?.category ?? item.categoryHint ?? null;
      // Language: title parse is the richer signal for gacha strings (attrs
      // rarely carry Set); non-default wins.
      const language =
        titleParsed && titleParsed.language !== "en"
          ? titleParsed.language
          : attrParsed?.language ?? titleParsed?.language ?? "en";
      const cardName = attrParsed?.cardName ?? titleParsed?.cardName ?? null;
      const grader = attrParsed?.grader ?? titleParsed?.grader ?? null;
      const grade = attrParsed?.grade ?? titleParsed?.grade ?? null;
      const rawNumber = attrParsed?.serialNumber ?? titleParsed?.cardNumber ?? null;
      const cardNumber = normalizeCardNumber(rawNumber);
      const isPokemon = (category ?? "").toLowerCase() === "pokemon";

      // Set code, in decreasing confidence:
      //   attribute set string → title abbrev as literal code ("Svp" → svp) →
      //   exact name → substring scan (set name inside title text) → trgm fuzzy.
      let setCode: string | null = attrParsed?.setCode ?? null;
      const setName = attrParsed?.setName ?? titleParsed?.setName ?? null;
      if (isPokemon && !setCode) {
        const abbrev = titleParsed?.setAbbrev?.toLowerCase();
        if (abbrev && validCodes.has(abbrev)) setCode = abbrev;
      }
      const year = attrParsed?.year ?? titleParsed?.year ?? null;
      if (isPokemon && !setCode && setName) {
        // Wizards-era "Black Star Promo" labels fuzzy-match to the wrong era's
        // promo set (bwp/swshp all look alike to trgm) — pin by year.
        if (year && year <= 2003 && /black star|promo/i.test(setName)) {
          setCode = "basep";
        }
        if (!setCode) setCode = ctx.setCodeByName.get(setName.trim().toLowerCase()) ?? null;
        if (!setCode) setCode = substringScanSetCode(setName, "suffix");
        // Year-augmented fuzzy first — disambiguates yearly series like
        // "McDonald's Collection {year}" — then plain fuzzy.
        if (!setCode && year) setCode = await fuzzySetCode(`${setName} ${year}`);
        if (!setCode) setCode = await fuzzySetCode(setName);
      }
      if (isPokemon && !setCode && titleParsed?.setCardBlob) {
        // Grammar 2 (PSA-label): set + card mixed — substring scan only; trgm
        // on a blob containing the card name is noise.
        setCode = substringScanSetCode(titleParsed.setCardBlob);
      }

      let collectibleId: string | null = null;
      if (isPokemon && setCode && cardNumber && language === "en") {
        collectibleId = lookupCollectible(setCode, rawNumber, cardNumber);
      }

      this.attemptedCount++;
      if (collectibleId) this.resolvedCount++;

      // Skip the write when we knew this mint (unresolved) and still have nothing new.
      if (known.has(item.mintAddress) && !collectibleId) {
        return null;
      }

      await sql`
        INSERT INTO mint_card_map (
          mint_address, platform, category, collectible_id,
          card_name, set_code, card_number,
          grader, grade, parallel, language, raw_attributes
        ) VALUES (
          ${item.mintAddress}, ${PLATFORM}, ${category}, ${collectibleId ?? null}::uuid,
          ${cardName}, ${setCode}, ${cardNumber},
          ${grader}, ${grade}, ${null}, ${language},
          ${JSON.stringify(item.attributes ?? [])}::jsonb
        )
        ON CONFLICT (mint_address) DO UPDATE SET
          collectible_id = COALESCE(mint_card_map.collectible_id, EXCLUDED.collectible_id),
          category = COALESCE(EXCLUDED.category, mint_card_map.category),
          card_name = COALESCE(EXCLUDED.card_name, mint_card_map.card_name),
          set_code = COALESCE(EXCLUDED.set_code, mint_card_map.set_code),
          card_number = COALESCE(EXCLUDED.card_number, mint_card_map.card_number),
          grader = COALESCE(EXCLUDED.grader, mint_card_map.grader),
          grade = COALESCE(EXCLUDED.grade, mint_card_map.grade),
          language = EXCLUDED.language
      `;
      known.set(item.mintAddress, collectibleId);
      return collectibleId;
    },
  };

  return resolver;
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

export interface PoolReport {
  codes: string[];
  nftsObserved: number;
  rowsUpserted: number;
  mintsAttempted: number;
  mintsResolved: number;
}

export async function ingestGachaPool(
  sql: any,
  client: GachaClient,
  codes: string[] = DEFAULT_POOL_CODES
): Promise<PoolReport> {
  const ctx = await buildResolutionContext(sql);

  // Fetch all tiers first so the resolver can batch-load known mints.
  const items: Array<{ code: string; rarity: string; nft: GachaNft }> = [];
  for (const code of codes) {
    for (const rarity of RARITIES) {
      const nfts = await client.getNfts(code, rarity);
      for (const nft of nfts) items.push({ code, rarity, nft });
    }
  }

  const resolver = await buildGachaResolver(
    sql,
    ctx,
    items.map((i) => i.nft.nft_address)
  );

  let rowsUpserted = 0;
  for (const { code, rarity, nft } of items) {
    const collectibleId = await resolver.resolve({
      mintAddress: nft.nft_address,
      title: nft.description ?? nft.name ?? null,
      attributes: nft.attributes ?? null,
      categoryHint: categoryFromPackType(code),
    });

    await sql`
      INSERT INTO gacha_pool_nfts (
        machine_code, mint_address, rarity, name, description,
        insured_value, image_url, attributes, collectible_id, last_seen_at
      ) VALUES (
        ${code}, ${nft.nft_address}, ${rarity}, ${nft.name ?? null}, ${nft.description ?? null},
        ${Number.isFinite(nft.insured_value) ? nft.insured_value : null},
        ${nft.image ?? null},
        ${JSON.stringify(nft.attributes ?? [])}::jsonb,
        ${collectibleId ?? null}::uuid, NOW()
      )
      ON CONFLICT (machine_code, mint_address) DO UPDATE SET
        rarity = EXCLUDED.rarity,
        insured_value = EXCLUDED.insured_value,
        collectible_id = COALESCE(gacha_pool_nfts.collectible_id, EXCLUDED.collectible_id),
        last_seen_at = NOW()
    `;
    rowsUpserted++;
  }

  return {
    codes,
    nftsObserved: items.length,
    rowsUpserted,
    mintsAttempted: resolver.attemptedCount,
    mintsResolved: resolver.resolvedCount,
  };
}

// ─── Pulls ────────────────────────────────────────────────────────────────────

export interface PullsReport {
  pullsObserved: number;
  pullsInserted: number;
  pullsAlreadyKnown: number;
  mintsAttempted: number;
  mintsResolved: number;
  oldestObserved: string | null;
  newestObserved: string | null;
}

export async function ingestGachaPulls(
  sql: any,
  client: GachaClient
): Promise<PullsReport> {
  const winners = await client.getAllWinners({ count: 200 });
  if (winners.length === 0) {
    return {
      pullsObserved: 0,
      pullsInserted: 0,
      pullsAlreadyKnown: 0,
      mintsAttempted: 0,
      mintsResolved: 0,
      oldestObserved: null,
      newestObserved: null,
    };
  }

  // Dedupe against recent rows only — the feed window is minutes wide.
  const oldest = winners[winners.length - 1].created_at;
  const existingRows = (await sql`
    SELECT mint_address, pulled_at FROM gacha_pulls
    WHERE pulled_at >= ${oldest}::timestamptz - interval '1 minute'
  `) as Array<{ mint_address: string; pulled_at: string }>;
  const existingKeys = new Set(
    existingRows.map((r) => `${r.mint_address}|${new Date(r.pulled_at).toISOString()}`)
  );

  const fresh = winners.filter(
    (w) => !existingKeys.has(`${w.nft_address}|${new Date(w.created_at).toISOString()}`)
  );

  const ctx = await buildResolutionContext(sql);
  const resolver = await buildGachaResolver(
    sql,
    ctx,
    fresh.map((w) => w.nft_address)
  );

  let inserted = 0;
  for (const w of fresh) {
    const meta = w.nft?.content?.metadata;
    const title = meta?.json_name ?? meta?.name ?? null;
    const collectibleId = await resolver.resolve({
      mintAddress: w.nft_address,
      title,
      attributes: meta?.attributes ?? null,
      categoryHint: categoryFromPackType(w.pack_type),
    });

    await sql`
      INSERT INTO gacha_pulls (
        winner, mint_address, pack_type, prize_tier, rarity,
        insured_value, memo_slug, nft_name, collectible_id, pulled_at
      ) VALUES (
        ${w.winner ?? null}, ${w.nft_address}, ${w.pack_type}, ${w.prize_tier ?? null},
        ${PRIZE_TIER_RARITY[w.prize_tier] ?? null},
        ${Number.isFinite(w.insuredValue) ? w.insuredValue : null},
        ${w.memo_slug ?? null}, ${title}, ${collectibleId ?? null}::uuid,
        ${w.created_at}::timestamptz
      )
      ON CONFLICT (mint_address, pulled_at) DO NOTHING
    `;
    inserted++;
  }

  return {
    pullsObserved: winners.length,
    pullsInserted: inserted,
    pullsAlreadyKnown: winners.length - fresh.length,
    mintsAttempted: resolver.attemptedCount,
    mintsResolved: resolver.resolvedCount,
    oldestObserved: oldest,
    newestObserved: winners[0].created_at,
  };
}

// ─── Standalone entry point ───────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const client = new GachaClient();
  const mode = process.argv[2] ?? "all";

  const startedAt = Date.now();
  const out: Record<string, unknown> = {};
  if (mode === "machines" || mode === "all") {
    out.machines = await ingestGachaMachines(sql, client);
  }
  if (mode === "pool" || mode === "all") {
    out.pool = await ingestGachaPool(sql, client);
  }
  if (mode === "pulls" || mode === "all") {
    out.pulls = await ingestGachaPulls(sql, client);
  }
  out.elapsedMs = Date.now() - startedAt;
  console.log(JSON.stringify(out, null, 2));
}

if (process.argv[1]?.endsWith("gacha.ts")) {
  main().catch((err) => {
    console.error("Gacha ingestion failed:", err);
    process.exit(1);
  });
}
