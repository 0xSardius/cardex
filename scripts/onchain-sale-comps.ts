/**
 * Edge B go/no-go (v2): do CC cards SELL near insured value, or near their low
 * listing price? Pulls recent Magic Eden SALES, then fetches each sold mint's
 * OWN attributes (insured value + grade) directly — so we're not limited to our
 * prior index — and reports realized-price ÷ insured-value.
 *
 * Also reports raw sale velocity (the liquidity reality for the trader).
 * Read-only. Usage: npx tsx scripts/onchain-sale-comps.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { getSolUsdRate } from "../src/lib/oracle/sol-usd";
import { MagicEdenV2Client } from "../src/lib/ingestion/clients/magic-eden-client";
import { parseCollectorCryptAttributes } from "../src/lib/games/pokemon/collector-crypt-attributes";

const ME = "https://api-mainnet.magiceden.dev/v2";
const SYMBOL = "collector_crypt";
const PAGES = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchActivities(offset: number): Promise<any[]> {
  const url = `${ME}/collections/${SYMBOL}/activities?offset=${offset}&limit=100`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "CardEx/0.1", Accept: "application/json" } });
    if (res.status === 429) { await sleep(20000); continue; }
    if (!res.ok) { await sleep(1000 * (attempt + 1)); continue; }
    return (await res.json()) as any[];
  }
  return [];
}

const insuredOf = (attrs: any[]): number | null => {
  const v = attrs?.find((a) => a.trait_type?.toLowerCase() === "insured value")?.value;
  const n = v != null && v !== "NA" ? parseFloat(String(v)) : null;
  return n != null && isFinite(n) ? n : null;
};

async function main() {
  const solUsd = (await getSolUsdRate())?.rate ?? null;
  const client = new MagicEdenV2Client();
  console.log(`SOL/USD = ${solUsd}\n`);

  // 1. Collect sales across a wider window.
  const sales = new Map<string, { sol: number; ageDays: number }>();
  let raw = 0;
  for (let p = 0; p < PAGES; p++) {
    const acts = await fetchActivities(p * 100);
    if (!acts.length) break;
    raw += acts.length;
    for (const a of acts) {
      if (a.type !== "buyNow" || typeof a.price !== "number" || !a.tokenMint) continue;
      const ageDays = a.blockTime ? (Date.now() / 1000 - a.blockTime) / 86400 : -1;
      if (!sales.has(a.tokenMint)) sales.set(a.tokenMint, { sol: a.price, ageDays });
    }
    await sleep(400);
  }
  const saleList = [...sales.entries()];
  const ages = saleList.map(([, s]) => s.ageDays).filter((d) => d >= 0);
  console.log(`activities scanned: ${raw} → unique sales: ${saleList.length}`);
  if (ages.length) {
    const windowD = Math.max(...ages);
    console.log(`window: ${windowD.toFixed(1)} days → ~${(saleList.length / windowD).toFixed(1)} sales/day (whole collection)\n`);
  }
  if (!saleList.length || !solUsd) { console.log("No sales / no oracle."); return; }

  // 2. Fetch each sold mint's own attributes → insured value, grade, language.
  const ratios: number[] = [];
  const rows: any[] = [];
  let nonPokemon = 0, noInsured = 0, japanese = 0;
  let i = 0;
  for (const [mint, s] of saleList) {
    i++;
    const token = await client.getToken(mint);
    const parsed = parseCollectorCryptAttributes(token?.attributes);
    if (!parsed || parsed.category.toLowerCase() !== "pokemon") { nonPokemon++; continue; }
    if (parsed.language !== "en") { japanese++; continue; }
    const insured = insuredOf(token?.attributes as any[]);
    if (insured == null || insured < 25) { noInsured++; continue; }
    const realized = s.sol * solUsd;
    const ratio = realized / insured;
    ratios.push(ratio);
    rows.push({ card: (parsed.cardName ?? "?").slice(0, 18), grade: parsed.grader && parsed.grade ? `${parsed.grader}${parsed.grade}` : "raw", sold_usd: Math.round(realized), insured, ratio: ratio.toFixed(2), days_ago: s.ageDays.toFixed(0) });
    if (i % 25 === 0) console.log(`  …${i}/${saleList.length} mints checked, ${ratios.length} usable`);
  }

  console.log(`\nsold mints: ${saleList.length} | non-Pokemon: ${nonPokemon} | Japanese: ${japanese} | no insured: ${noInsured} | USABLE: ${ratios.length}`);
  if (ratios.length < 5) { console.log(`\n⚠️ sample too small (${ratios.length}) for a confident verdict — thin sale volume is itself the finding.`); if (rows.length) console.table(rows); return; }

  ratios.sort((a, b) => a - b);
  const pct = (p: number) => ratios[Math.floor((ratios.length - 1) * p)];
  const frac = (f: (r: number) => boolean) => ratios.filter(f).length;
  console.log(`\n═══ realized ÷ insured value  (n=${ratios.length}) ═══`);
  console.log(`  median ${pct(0.5).toFixed(2)}   p25 ${pct(0.25).toFixed(2)}   p75 ${pct(0.75).toFixed(2)}`);
  console.log(`  within 80-120% of insured: ${frac((r)=>r>=0.8&&r<=1.2)} (${((frac((r)=>r>=0.8&&r<=1.2)/ratios.length)*100).toFixed(0)}%)`);
  console.log(`  below 60% of insured:      ${frac((r)=>r<0.6)} (${((frac((r)=>r<0.6)/ratios.length)*100).toFixed(0)}%)`);

  console.table(rows.sort((a, b) => +b.sold_usd - +a.sold_usd).slice(0, 25));

  const med = pct(0.5);
  console.log(`\n═══ VERDICT (n=${ratios.length}) ═══`);
  if (med >= 0.85) console.log(`median ${med.toFixed(2)} → insured value ≈ real clearing price. Listings far below it ARE underpriced. Edge B + Lane-A signal supported (small sample).`);
  else if (med >= 0.6) console.log(`median ${med.toFixed(2)} → cards clear somewhat below insured. A real but smaller discount than the gate implied.`);
  else console.log(`median ${med.toFixed(2)} → cards clear WELL below insured → insured value is inflated → the gate's "discounts" are largely a mirage.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
