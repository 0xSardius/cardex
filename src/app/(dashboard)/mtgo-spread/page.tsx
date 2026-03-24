import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Link from "next/link";

export default async function MtgoSpreadPage() {
  // MTGO-high: tix price disproportionately high vs paper
  const mtgoHighResults: any = await db.execute(sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT
      c.id, c.name, c.rarity, c.treatment, c.reserved,
      s.name as set_name, s.code as set_code,
      u.price as paper_usd, t.tix as mtgo_tix,
      ROUND(t.tix / u.price, 2) as ratio
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'mtg' AND u.price >= 1 AND t.tix >= 0.5 AND t.tix / u.price >= 2
    ORDER BY t.tix / u.price DESC
    LIMIT 20
  `);

  // Paper-high: paper price disproportionately high vs MTGO
  const paperHighResults: any = await db.execute(sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT
      c.id, c.name, c.rarity, c.treatment, c.reserved,
      s.name as set_name, s.code as set_code,
      u.price as paper_usd, t.tix as mtgo_tix,
      ROUND(u.price / t.tix, 2) as ratio
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'mtg' AND u.price >= 5 AND t.tix >= 0.1 AND u.price / t.tix >= 20
    ORDER BY u.price / t.tix DESC
    LIMIT 20
  `);

  const mtgoHigh = mtgoHighResults.rows ?? mtgoHighResults;
  const paperHigh = paperHighResults.rows ?? paperHighResults;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold">
          MTGO-Paper Spread
        </h1>
        <p className="mt-1 text-sm text-[var(--cx-text-dim)]">
          Leading indicator — MTGO tix spikes often precede paper price increases by 1-3 days.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* MTGO High */}
        <div>
          <div className="mb-4">
            <h2 className="font-[family-name:var(--font-geist-mono)] text-xs font-bold tracking-widest text-[var(--cx-green)] uppercase">
              MTGO Tix High
            </h2>
            <p className="mt-1 text-xs text-[var(--cx-text-muted)]">
              Tix expensive relative to paper — paper may follow upward
            </p>
          </div>

          <div className="space-y-1">
            {mtgoHigh.map((r: any) => (
              <SpreadRow
                key={r.id}
                id={r.id}
                name={r.name}
                setName={r.set_name}
                setCode={r.set_code}
                reserved={r.reserved}
                left={`$${parseFloat(r.paper_usd).toFixed(2)}`}
                leftLabel="Paper"
                right={`${r.mtgo_tix} tix`}
                rightLabel="MTGO"
                ratio={`${r.ratio}x`}
                ratioColor="var(--cx-green)"
              />
            ))}
            {mtgoHigh.length === 0 && (
              <p className="text-sm text-[var(--cx-text-muted)] py-4">No signals</p>
            )}
          </div>
        </div>

        {/* Paper High */}
        <div>
          <div className="mb-4">
            <h2 className="font-[family-name:var(--font-geist-mono)] text-xs font-bold tracking-widest text-[var(--cx-amber)] uppercase">
              Paper Price High
            </h2>
            <p className="mt-1 text-xs text-[var(--cx-text-muted)]">
              Paper expensive vs MTGO — Commander, collector, or Reserved List demand
            </p>
          </div>

          <div className="space-y-1">
            {paperHigh.map((r: any) => (
              <SpreadRow
                key={r.id}
                id={r.id}
                name={r.name}
                setName={r.set_name}
                setCode={r.set_code}
                reserved={r.reserved}
                left={`$${parseFloat(r.paper_usd).toFixed(2)}`}
                leftLabel="Paper"
                right={`${r.mtgo_tix} tix`}
                rightLabel="MTGO"
                ratio={`${r.ratio}x`}
                ratioColor="var(--cx-amber)"
              />
            ))}
            {paperHigh.length === 0 && (
              <p className="text-sm text-[var(--cx-text-muted)] py-4">No signals</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpreadRow({
  id,
  name,
  setName,
  setCode,
  reserved,
  left,
  leftLabel,
  right,
  rightLabel,
  ratio,
  ratioColor,
}: {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  reserved: boolean;
  left: string;
  leftLabel: string;
  right: string;
  rightLabel: string;
  ratio: string;
  ratioColor: string;
}) {
  return (
    <Link
      href={`/card/${id}`}
      className="flex items-center justify-between rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 px-3 py-2.5 transition-all hover:border-[var(--cx-border-bright)] hover:bg-[var(--cx-surface)]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--cx-text)] truncate">
            {name}
          </span>
          {reserved && (
            <span className="shrink-0 rounded bg-[var(--cx-amber)]/15 px-1 py-0.5 font-[family-name:var(--font-geist-mono)] text-[9px] font-bold text-[var(--cx-amber)]">
              RL
            </span>
          )}
        </div>
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
          {setName} [{setCode}]
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3 text-right">
        <div>
          <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">{leftLabel}</div>
          <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text)]">{left}</div>
        </div>
        <div>
          <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">{rightLabel}</div>
          <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text)]">{right}</div>
        </div>
        <div className="min-w-[40px]">
          <div
            className="font-[family-name:var(--font-geist-mono)] text-sm font-bold"
            style={{ color: ratioColor }}
          >
            {ratio}
          </div>
        </div>
      </div>
    </Link>
  );
}
