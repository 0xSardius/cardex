/**
 * /demo/arbitrage — SSR showcase of the rwa-arbitrage endpoint.
 *
 * Calls the shared scanArbitrage() composition directly (no x402 hop),
 * so the page lights up regardless of whether the visitor has a wallet.
 * The footer explains that an agent caller pays $0.005 via x402 to get
 * the same payload from POST /api/v1/rwa-arbitrage.
 */

import Link from "next/link";
import { scanArbitrage } from "@/lib/insight/arbitrage";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function DemoArbitragePage() {
  let scan: Awaited<ReturnType<typeof scanArbitrage>> | null = null;
  let error: string | null = null;
  try {
    scan = await scanArbitrage({ limit: 20, min_spread_percent: 10, min_paper_price_usd: 25 });
  } catch (err) {
    error = err instanceof Error ? err.message : "scan failed";
  }

  return (
    <div className="animate-fade-in">
      <DemoHeader />

      {error && (
        <div className="mb-6 rounded-lg border border-[var(--cx-red)]/40 bg-[var(--cx-red)]/5 px-4 py-3 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-red)]">
          scan failed — {error}
        </div>
      )}

      {scan && (
        <>
          <StatusStrip
            count={scan.count}
            scanned={scan.candidate_count_scanned}
            washDropped={scan.wash_trade_dropped}
            solUsdRate={scan.sol_usd_rate}
          />

          {scan.seller_intel_unavailable && <SolEnrichBanner />}

          {scan.opportunities.length === 0 ? (
            <EmptyState />
          ) : (
            <OpportunityList items={scan.opportunities} />
          )}

          <ResponseShape />
        </>
      )}
    </div>
  );
}

function DemoHeader() {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
        <span className="inline-block h-1 w-1 rounded-full bg-[var(--cx-amber)] animate-pulse" />
        live demo — pokemon tokenized cards
      </div>
      <h1 className="font-[family-name:var(--font-geist-sans)] text-3xl font-bold text-[var(--cx-text)]">
        Underpriced Onchain vs Paper
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--cx-text-dim)]">
        Live scan of Collector Crypt + Magic Eden Pokemon listings priced below paper-market by ≥10%, net of marketplace fees.
        Each row is enriched with SolEnrich seller-risk and wash-trade-cluster intel via agent-to-agent x402.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
        <span>
          agent endpoint: <code className="text-[var(--cx-cyan)]">POST /api/v1/rwa-arbitrage</code>
        </span>
        <span>•</span>
        <span>
          price: <code className="text-[var(--cx-green)]">$0.005</code> per call via x402
        </span>
      </div>
    </div>
  );
}

function StatusStrip({
  count,
  scanned,
  washDropped,
  solUsdRate,
}: {
  count: number;
  scanned: number;
  washDropped: number;
  solUsdRate: { rate: number; age_ms: number; source: string } | null;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="opportunities" value={count.toString()} accent="green" />
      <Stat label="listings scanned" value={scanned.toString()} />
      <Stat
        label="wash-trades dropped"
        value={washDropped.toString()}
        accent={washDropped > 0 ? "amber" : undefined}
      />
      <Stat
        label="sol/usd (pyth)"
        value={solUsdRate ? `$${solUsdRate.rate.toFixed(2)}` : "—"}
        sub={solUsdRate ? `${Math.floor(solUsdRate.age_ms / 1000)}s old` : undefined}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber";
}) {
  const valueColor =
    accent === "green"
      ? "text-[var(--cx-green)]"
      : accent === "amber"
      ? "text-[var(--cx-amber)]"
      : "text-[var(--cx-text)]";
  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 px-3 py-2">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
        {label}
      </div>
      <div className={`font-[family-name:var(--font-geist-mono)] text-lg font-bold ${valueColor}`}>
        {value}
      </div>
      {sub && (
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function SolEnrichBanner() {
  return (
    <div className="mb-6 rounded-lg border border-[var(--cx-amber)]/30 bg-[var(--cx-amber)]/5 px-4 py-3">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
        solenrich · degraded
      </div>
      <p className="mt-1 text-xs text-[var(--cx-text-dim)]">
        Seller-risk and wash-trade signals fell through to{" "}
        <code className="text-[var(--cx-amber)]">unavailable</code> on this scan — most likely the
        CardEx agent wallet is unfunded or SolEnrich is unreachable. Card-level paper-vs-onchain
        spread numbers are unaffected.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 text-center">
      <p className="text-[var(--cx-text-dim)]">No underpriced listings right now</p>
      <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
        Try again in a few minutes — listings rotate quickly
      </p>
    </div>
  );
}

type Opportunity = Awaited<ReturnType<typeof scanArbitrage>>["opportunities"][number];

function OpportunityList({ items }: { items: Opportunity[] }) {
  return (
    <div className="space-y-2">
      {items.map((o) => (
        <OpportunityRow key={o.listing_id} o={o} />
      ))}
    </div>
  );
}

function OpportunityRow({ o }: { o: Opportunity }) {
  const paper = o.paper_price.median_usd;
  const onchain = o.onchain.best_ask_usd;
  const profit = o.net_profit.net_usd;
  const grade =
    o.collectible.grader && o.collectible.grade
      ? `${o.collectible.grader} ${o.collectible.grade}`
      : "raw";
  const conditionBasis = (o.paper_price as { condition_basis?: string }).condition_basis;

  return (
    <a
      href={o.listing_url ?? "#"}
      target={o.listing_url ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-4 transition-all hover:border-[var(--cx-border-bright)] hover:bg-[var(--cx-surface)]"
    >
      <div className="flex items-start gap-4">
        <CardThumb url={o.collectible.image_url} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-[var(--cx-text)]">
                  {o.collectible.name ?? "Unknown card"}
                </span>
                <span className="shrink-0 rounded bg-[var(--cx-cyan)]/10 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-cyan)]">
                  {grade}
                </span>
                {conditionBasis === "raw_fallback" && (
                  <span className="shrink-0 rounded bg-[var(--cx-text-muted)]/20 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-dim)]">
                    raw-fallback
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
                {o.collectible.set ?? "—"}
                {o.collectible.set_code ? ` [${o.collectible.set_code}]` : ""}
                {o.collectible.number ? ` · #${o.collectible.number}` : ""}
                {o.marketplace ? ` · ${o.marketplace}` : ` · ${o.source}`}
              </div>
            </div>

            <SpreadBadge percent={o.spread.percent} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PriceCell label="paper median" value={paper} />
            <PriceCell label="onchain ask" value={onchain} sub={o.onchain.best_ask_currency} />
            <PriceCell
              label="net profit"
              value={profit}
              accent={profit > 0 ? "green" : undefined}
            />
            <div>
              <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
                seller signals
              </div>
              <SellerBadges
                risk={o.seller_risk as Record<string, unknown>}
                cluster={o.seller_cluster as Record<string, unknown>}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
            <span>obs {o.onchain.observed_minutes_ago}m ago</span>
            {o.onchain.seller && (
              <span className="truncate">
                seller{" "}
                <code className="text-[var(--cx-text-dim)]">
                  {o.onchain.seller.slice(0, 4)}…{o.onchain.seller.slice(-4)}
                </code>
              </span>
            )}
            <span className="ml-auto text-[var(--cx-cyan)]">
              {o.listing_url ? "view listing →" : "no url"}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

function CardThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div
        aria-hidden
        className="card-shape h-20 w-[57px] shrink-0 bg-[var(--cx-surface-2)]"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt=""
      className="card-shape h-20 w-[57px] shrink-0 object-cover"
      loading="lazy"
    />
  );
}

function SpreadBadge({ percent }: { percent: number }) {
  const abs = Math.abs(percent);
  const tone =
    abs >= 50
      ? "text-[var(--cx-green)] bg-[var(--cx-green)]/10"
      : abs >= 25
      ? "text-[var(--cx-amber)] bg-[var(--cx-amber)]/10"
      : "text-[var(--cx-cyan)] bg-[var(--cx-cyan)]/10";
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-xs font-bold ${tone}`}
    >
      {percent.toFixed(1)}%
    </span>
  );
}

function PriceCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | null;
  sub?: string;
  accent?: "green";
}) {
  const color = accent === "green" ? "text-[var(--cx-green)]" : "text-[var(--cx-text)]";
  return (
    <div>
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
        {label}
      </div>
      <div className={`font-[family-name:var(--font-geist-mono)] text-sm font-bold ${color}`}>
        {value == null ? "—" : `$${value.toFixed(2)}`}
      </div>
      {sub && (
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function SellerBadges({
  risk,
  cluster,
}: {
  risk: Record<string, unknown>;
  cluster: Record<string, unknown>;
}) {
  if (risk.unavailable && cluster.unavailable) {
    return (
      <div className="mt-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
        unavailable
      </div>
    );
  }
  const level = risk.level as string | undefined;
  const score = risk.score as number | undefined;
  const wash = cluster.wash_trade_flag as boolean | null | undefined;
  const labels = (risk.labels as string[] | undefined) ?? [];
  const levelColor =
    level === "HIGH" || level === "CRITICAL"
      ? "text-[var(--cx-red)] bg-[var(--cx-red)]/10"
      : level === "MEDIUM"
      ? "text-[var(--cx-amber)] bg-[var(--cx-amber)]/10"
      : "text-[var(--cx-green)] bg-[var(--cx-green)]/10";
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {level && (
        <span
          className={`rounded px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] ${levelColor}`}
        >
          {level}
          {score != null ? ` · ${score}` : ""}
        </span>
      )}
      {wash === true && (
        <span className="rounded bg-[var(--cx-red)]/15 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-red)]">
          wash-cluster
        </span>
      )}
      {labels.slice(0, 2).map((l) => (
        <span
          key={l}
          className="rounded bg-[var(--cx-text-muted)]/15 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-dim)]"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

function ResponseShape() {
  return (
    <div className="mt-10 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/30 p-5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
            for agents
          </div>
          <h3 className="font-[family-name:var(--font-geist-sans)] text-base font-bold text-[var(--cx-text)]">
            Same payload, served via x402
          </h3>
        </div>
        <Link
          href="/"
          className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-cyan)] hover:underline"
        >
          api docs →
        </Link>
      </div>
      <p className="text-xs text-[var(--cx-text-dim)]">
        Bot operators get this exact JSON by POSTing to{" "}
        <code className="text-[var(--cx-cyan)]">/api/v1/rwa-arbitrage</code> with a $0.005 USDC payment on
        Solana. Includes ETag, 60s Cache-Control, and a stable response shape (
        <code className="text-[var(--cx-text)]">opportunities[]</code>,{" "}
        <code className="text-[var(--cx-text)]">net_profit</code>,{" "}
        <code className="text-[var(--cx-text)]">seller_risk</code>,{" "}
        <code className="text-[var(--cx-text)]">seller_cluster</code>).
      </p>
    </div>
  );
}
