import { db } from "@/lib/db";
import { collectibles, sets, pricePoints, marketSnapshots } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch card with set info
  const [card] = await db
    .select({
      id: collectibles.id,
      name: collectibles.name,
      game: collectibles.game,
      setNumber: collectibles.setNumber,
      rarity: collectibles.rarity,
      cardType: collectibles.cardType,
      treatment: collectibles.treatment,
      foil: collectibles.foil,
      reserved: collectibles.reserved,
      legalities: collectibles.legalities,
      imageUrl: collectibles.imageUrl,
      externalId: collectibles.externalId,
      setName: sets.name,
      setCode: sets.code,
      setEra: sets.era,
    })
    .from(collectibles)
    .leftJoin(sets, eq(collectibles.setId, sets.id))
    .where(eq(collectibles.id, id))
    .limit(1);

  if (!card) notFound();

  // Fetch latest prices from all sources
  const prices = await db
    .select({
      source: pricePoints.source,
      condition: pricePoints.condition,
      priceUsd: pricePoints.priceUsd,
      currency: pricePoints.currency,
      observedAt: pricePoints.observedAt,
    })
    .from(pricePoints)
    .where(eq(pricePoints.collectibleId, id))
    .orderBy(desc(pricePoints.observedAt))
    .limit(20);

  // Fetch latest market snapshot
  const [snapshot] = await db
    .select({
      date: marketSnapshots.date,
      avgPrice: marketSnapshots.avgPrice,
      medianPrice: marketSnapshots.medianPrice,
      lowPrice: marketSnapshots.lowPrice,
      highPrice: marketSnapshots.highPrice,
      volume: marketSnapshots.volume,
      trend7d: marketSnapshots.trend7d,
      trend30d: marketSnapshots.trend30d,
    })
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.collectibleId, id),
        eq(marketSnapshots.condition, "nm")
      )
    )
    .orderBy(desc(marketSnapshots.date))
    .limit(1);

  // Group prices by source
  const pricesBySource = new Map<string, typeof prices>();
  for (const p of prices) {
    const key = `${p.source}|${p.condition}`;
    if (!pricesBySource.has(key)) {
      pricesBySource.set(key, []);
    }
    pricesBySource.get(key)!.push(p);
  }

  // Get the latest price per source+condition
  const latestPrices = Array.from(pricesBySource.entries()).map(([key, ps]) => ({
    source: ps[0].source,
    condition: ps[0].condition,
    priceUsd: ps[0].priceUsd,
    currency: ps[0].currency,
    observedAt: ps[0].observedAt,
  }));

  const legalities = card.legalities as Record<string, string> | null;

  // Key formats to display
  const keyFormats = ["standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper"];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/search"
        className="inline-flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)] hover:text-[var(--cx-text)] mb-6"
      >
        &larr; Back to Search
      </Link>

      {/* Card header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-[family-name:var(--font-geist-sans)] text-3xl font-bold">
            {card.name}
          </h1>
          {card.reserved && (
            <span className="rounded bg-[var(--cx-amber)]/15 px-2 py-1 font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[var(--cx-amber)]">
              RESERVED LIST
            </span>
          )}
          {card.foil && (
            <span className="rounded bg-[var(--cx-purple)]/15 px-2 py-1 font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[var(--cx-purple)]">
              FOIL
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text-dim)]">
          <span>{card.setName}</span>
          {card.setCode && <span className="uppercase">[{card.setCode}]</span>}
          {card.setNumber && <span>#{card.setNumber}</span>}
          {card.rarity && <span className="capitalize">{card.rarity}</span>}
          {card.treatment && card.treatment !== "regular" && (
            <span className="text-[var(--cx-cyan)] capitalize">{card.treatment}</span>
          )}
          {card.setEra && <span className="text-[var(--cx-text-muted)]">{card.setEra}</span>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prices */}
        <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-5">
          <h2 className="mb-4 font-[family-name:var(--font-geist-mono)] text-xs font-bold tracking-widest text-[var(--cx-amber)] uppercase">
            Latest Prices
          </h2>
          {latestPrices.length > 0 ? (
            <div className="space-y-2">
              {latestPrices.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-[var(--cx-surface-2)] px-3 py-2"
                >
                  <div>
                    <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-dim)]">
                      {formatSource(p.source)}
                    </span>
                    <span className="ml-2 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
                      {p.condition}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-text)]">
                      {p.currency === "TIX"
                        ? `${p.priceUsd} tix`
                        : `${p.currency === "EUR" ? "€" : "$"}${parseFloat(p.priceUsd).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--cx-text-muted)]">No price data</p>
          )}
        </div>

        {/* Market Snapshot */}
        <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-5">
          <h2 className="mb-4 font-[family-name:var(--font-geist-mono)] text-xs font-bold tracking-widest text-[var(--cx-amber)] uppercase">
            Market Snapshot
          </h2>
          {snapshot ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Average" value={`$${snapshot.avgPrice}`} />
                <StatBox label="Median" value={`$${snapshot.medianPrice}`} />
                <StatBox label="Low" value={`$${snapshot.lowPrice}`} />
                <StatBox label="High" value={`$${snapshot.highPrice}`} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--cx-border)]">
                <TrendBox label="7-day" value={snapshot.trend7d} />
                <TrendBox label="30-day" value={snapshot.trend30d} />
              </div>
              <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
                Snapshot date: {snapshot.date}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--cx-text-muted)]">No market snapshot data</p>
          )}
        </div>

        {/* Format Legality */}
        {legalities && (
          <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-5 lg:col-span-2">
            <h2 className="mb-4 font-[family-name:var(--font-geist-mono)] text-xs font-bold tracking-widest text-[var(--cx-amber)] uppercase">
              Format Legality
            </h2>
            <div className="flex flex-wrap gap-2">
              {keyFormats.map((format) => {
                const status = legalities[format];
                return (
                  <LegalityBadge key={format} format={format} status={status} />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] px-3 py-2">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)] uppercase">
        {label}
      </div>
      <div className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-text)]">
        {value ?? "—"}
      </div>
    </div>
  );
}

function TrendBox({ label, value }: { label: string; value: number | null }) {
  const isPositive = value !== null && value > 0;
  const isNegative = value !== null && value < 0;

  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] px-3 py-2">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)] uppercase">
        {label} trend
      </div>
      <div
        className={`font-[family-name:var(--font-geist-mono)] text-sm font-bold ${
          isPositive
            ? "text-[var(--cx-green)]"
            : isNegative
              ? "text-[var(--cx-red)]"
              : "text-[var(--cx-text-muted)]"
        }`}
      >
        {value !== null ? `${value > 0 ? "+" : ""}${value}%` : "—"}
      </div>
    </div>
  );
}

function LegalityBadge({ format, status }: { format: string; status: string }) {
  const colors: Record<string, string> = {
    legal: "text-[var(--cx-green)] border-[var(--cx-green)]/20 bg-[var(--cx-green)]/5",
    not_legal: "text-[var(--cx-text-muted)] border-[var(--cx-border)] bg-transparent",
    banned: "text-[var(--cx-red)] border-[var(--cx-red)]/20 bg-[var(--cx-red)]/5",
    restricted: "text-[var(--cx-amber)] border-[var(--cx-amber)]/20 bg-[var(--cx-amber)]/5",
  };

  return (
    <span
      className={`rounded-md border px-2.5 py-1 font-[family-name:var(--font-geist-mono)] text-xs ${
        colors[status] ?? colors.not_legal
      }`}
    >
      <span className="capitalize">{format}</span>
      <span className="ml-1.5 text-[10px] uppercase">
        {status === "not_legal" ? "✗" : status === "legal" ? "✓" : status === "banned" ? "BAN" : "R"}
      </span>
    </span>
  );
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    scryfall_tcgplayer: "TCGPlayer",
    scryfall_cardmarket: "CardMarket",
    scryfall_mtgo: "MTGO",
  };
  return map[source] ?? source;
}
