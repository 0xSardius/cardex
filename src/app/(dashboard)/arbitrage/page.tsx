import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Link from "next/link";

export default async function ArbitragePage() {
  const results: any = await db.execute(sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price, observed_at
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_eur AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price, observed_at
      FROM price_points
      WHERE source = 'scryfall_cardmarket' AND condition = 'nm' AND currency = 'EUR'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT
      c.id,
      c.name,
      c.rarity,
      c.treatment,
      c.reserved,
      s.name as set_name,
      s.code as set_code,
      u.price as usd_price,
      e.price as eur_price,
      ROUND(ABS(u.price - e.price), 2) as spread,
      ROUND(ABS(u.price - e.price) / LEAST(u.price, e.price) * 100, 1) as spread_pct,
      CASE WHEN u.price > e.price THEN 'buy_eu_sell_us' ELSE 'buy_us_sell_eu' END as direction
    FROM latest_usd u
    JOIN latest_eur e ON e.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'mtg'
      AND u.price > 1
      AND e.price > 1
      AND ABS(u.price - e.price) / LEAST(u.price, e.price) * 100 >= 15
    ORDER BY spread_pct DESC
    LIMIT 30
  `);

  const rows = results.rows ?? results;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold">
          Arbitrage Scanner
        </h1>
        <p className="mt-1 text-sm text-[var(--cx-text-dim)]">
          US/EU price spreads — TCGPlayer vs CardMarket. Cards with 15%+ divergence.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 text-center">
          <p className="text-[var(--cx-text-dim)]">No arbitrage opportunities found</p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="mb-3 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
            {rows.length} opportunities
          </div>

          {rows.map((r: any) => (
            <Link
              key={r.id}
              href={`/card/${r.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 px-4 py-3 transition-all hover:border-[var(--cx-border-bright)] hover:bg-[var(--cx-surface)]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--cx-text)] truncate">
                    {r.name}
                  </span>
                  {r.reserved && (
                    <span className="shrink-0 rounded bg-[var(--cx-amber)]/15 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold text-[var(--cx-amber)]">
                      RL
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
                  {r.set_name} [{r.set_code}]
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-4 text-right">
                <div>
                  <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">USD</div>
                  <div className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text)]">
                    ${parseFloat(r.usd_price).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">EUR</div>
                  <div className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text)]">
                    &euro;{parseFloat(r.eur_price).toFixed(2)}
                  </div>
                </div>
                <div className="min-w-[60px]">
                  <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">Spread</div>
                  <div className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-green)]">
                    {r.spread_pct}%
                  </div>
                </div>
                <div className="hidden sm:block">
                  <span
                    className={`rounded px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] ${
                      r.direction === "buy_eu_sell_us"
                        ? "bg-[var(--cx-green)]/10 text-[var(--cx-green)]"
                        : "bg-[var(--cx-cyan)]/10 text-[var(--cx-cyan)]"
                    }`}
                  >
                    {r.direction === "buy_eu_sell_us" ? "Buy EU → Sell US" : "Buy US → Sell EU"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
