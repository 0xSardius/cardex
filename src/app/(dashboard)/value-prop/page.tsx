export default function ValuePropPage() {
  return (
    <div className="pb-16 max-w-4xl mx-auto">
      {/* Title block */}
      <div className="text-center mb-12">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.3em] text-[var(--cx-amber-dim)] uppercase mb-3">
          Value Proposition
        </div>
        <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl sm:text-5xl font-bold leading-tight">
          <span className="text-[var(--cx-amber)]">CardEx</span>
        </h1>
        <p className="mt-3 text-lg text-[var(--cx-text-dim)] max-w-2xl mx-auto">
          The pricing API that MTG finance has been waiting for.
        </p>
      </div>

      {/* The gap */}
      <div className="rounded-xl border border-[var(--cx-red)]/20 bg-[var(--cx-red)]/[0.03] p-6 mb-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-red)] uppercase mb-3">
          The Market Gap
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <GapCard
            stat="$800M+"
            label="Annual MTG singles market"
            detail="Largest collectible card game by transaction volume"
          />
          <GapCard
            stat="0"
            label="Public pricing APIs"
            detail="TCGPlayer closed theirs. Scryfall is read-only. CardMarket has no API for non-EU."
          />
          <GapCard
            stat="6+"
            label="Platforms to check manually"
            detail="TCGPlayer, CardMarket, Card Kingdom, MTGO, eBay, Hareruya — every trade requires cross-referencing"
          />
        </div>
      </div>

      {/* What CardEx does */}
      <div className="rounded-xl border border-[var(--cx-amber-dim)]/30 bg-[var(--cx-amber)]/[0.03] p-6 mb-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-amber)] uppercase mb-3">
          What CardEx Does
        </div>
        <p className="text-sm text-[var(--cx-text)] leading-relaxed mb-5">
          One API that aggregates pricing from every major MTG platform, normalizes across currencies and conditions, and surfaces actionable intelligence — arbitrage, MTGO leading indicators, Reserved List tracking, format legality.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Capability
            title="Unified Pricing"
            detail="TCGPlayer (USD), CardMarket (EUR), MTGO (tix) — one query returns all three with cross-platform spread %"
          />
          <Capability
            title="Treatment-Aware"
            detail="Regular, foil, extended art, borderless, showcase, etched — 1M+ SKUs priced individually"
          />
          <Capability
            title="Arbitrage Detection"
            detail="US/EU spreads, MTGO-to-paper gaps, buylist premiums flagged automatically"
          />
          <Capability
            title="Leading Indicators"
            detail="MTGO tix spikes precede paper by 1-3 days. CardEx detects divergence in real time."
          />
          <Capability
            title="Reserved List Tracking"
            detail="571 supply-locked cards flagged. The most speculated-on cards in MTG, tracked per-printing."
          />
          <Capability
            title="Format Legality"
            detail="22 formats from Standard to Vintage. Ban/unban cycles move prices 20-300% — know instantly."
          />
        </div>
      </div>

      {/* Who it's for */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 mb-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-cyan)] uppercase mb-3">
          Who It&apos;s For
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Audience
            who="MTG Finance Traders"
            hook="TCGPlayer closed their API. CardEx is open and cheaper."
            metric="r/mtgfinance: 200K+ members actively paying for data tools"
          />
          <Audience
            who="Bot & Agent Builders"
            hook="Programmatic MTG pricing without scraping. x402 native."
            metric="Growing x402 ecosystem on Solana needs real-world data sources"
          />
          <Audience
            who="LGS / Store Owners"
            hook="Buylist arbitrage alerts across US, EU, and JP markets."
            metric="$0.005/query to find $5-50 arbitrage opportunities"
          />
          <Audience
            who="Collectors"
            hook="What's my collection worth? $0.002 per card to find out."
            metric="Portfolio valuation + set completion cost estimation"
          />
        </div>
      </div>

      {/* By the numbers */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 mb-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-amber)] uppercase mb-4">
          By The Numbers
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat value="90K+" label="Cards indexed" sub="Every MTG printing, Alpha–present" />
          <Stat value="322K+" label="Price points" sub="USD, EUR, MTGO tix" />
          <Stat value="571" label="Reserved List" sub="Supply-locked cards tracked" />
          <Stat value="7" label="API endpoints" sub="All x402 gated, $0.001–$0.01" />
        </div>
      </div>

      {/* How it's different */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 mb-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-green)] uppercase mb-3">
          Why CardEx Wins
        </div>
        <div className="space-y-3">
          <DiffRow
            us="Pay per query ($0.001)"
            them="Monthly subscriptions ($10-50/mo)"
            label="Pricing"
          />
          <DiffRow
            us="x402 native — agents pay autonomously"
            them="API keys, OAuth, rate limits"
            label="Access"
          />
          <DiffRow
            us="USD + EUR + MTGO tix in one call"
            them="Single-platform data only"
            label="Coverage"
          />
          <DiffRow
            us="Foil, borderless, showcase, etched — per-SKU"
            them="Card-level pricing only"
            label="Depth"
          />
          <DiffRow
            us="ERC-8004 onchain identity + reputation"
            them="Trust us, we're a company"
            label="Trust"
          />
        </div>
      </div>

      {/* Revenue model */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 mb-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-amber)] uppercase mb-3">
          Revenue Model
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <RevenueBlock
            source="x402 Micropayments"
            detail="$0.001–$0.01 per query, USDC on Solana"
            status="LIVE"
            statusColor="var(--cx-green)"
          />
          <RevenueBlock
            source="Premium Data Tiers"
            detail="Historical pricing, batch endpoints, webhook alerts"
            status="PLANNED"
            statusColor="var(--cx-text-muted)"
          />
          <RevenueBlock
            source="Token Fee Share"
            detail="Bags protocol token — holders earn from API trading fees"
            status="EVALUATING"
            statusColor="var(--cx-amber)"
          />
        </div>
      </div>

      {/* Ecosystem */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-purple)] uppercase mb-3">
          Ecosystem
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <EcoBlock
            label="Chain"
            value="Solana"
            detail="USDC payments, ~$0.00025/tx, ~400ms finality"
          />
          <EcoBlock
            label="Protocol"
            value="x402"
            detail="HTTP-native micropayments. No API keys, no subscriptions."
          />
          <EcoBlock
            label="Sibling Agent"
            value="SolEnrich"
            detail="Solana data enrichment — wallet profiling, whale tracking. Agent-to-agent commerce ready."
          />
        </div>
      </div>
    </div>
  );
}

function GapCard({ stat, label, detail }: { stat: string; label: string; detail: string }) {
  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] p-4">
      <div className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold text-[var(--cx-red)]">{stat}</div>
      <div className="mt-1 text-sm font-medium text-[var(--cx-text)]">{label}</div>
      <div className="mt-1 text-xs text-[var(--cx-text-muted)]">{detail}</div>
    </div>
  );
}

function Capability({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] p-3">
      <div className="text-sm font-semibold text-[var(--cx-text)] mb-1">{title}</div>
      <div className="text-xs text-[var(--cx-text-dim)] leading-relaxed">{detail}</div>
    </div>
  );
}

function Audience({ who, hook, metric }: { who: string; hook: string; metric: string }) {
  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] p-4">
      <div className="text-sm font-bold text-[var(--cx-text)] mb-1">{who}</div>
      <div className="text-xs text-[var(--cx-cyan)] mb-2">&ldquo;{hook}&rdquo;</div>
      <div className="text-[11px] text-[var(--cx-text-muted)]">{metric}</div>
    </div>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="text-center">
      <div className="font-[family-name:var(--font-geist-mono)] text-3xl font-bold text-[var(--cx-amber)]">{value}</div>
      <div className="mt-1 text-sm font-medium text-[var(--cx-text)]">{label}</div>
      <div className="text-[11px] text-[var(--cx-text-muted)]">{sub}</div>
    </div>
  );
}

function DiffRow({ us, them, label }: { us: string; them: string; label: string }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="shrink-0 w-16 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)] uppercase tracking-wider pt-0.5">{label}</span>
      <div className="flex-1 grid sm:grid-cols-2 gap-2">
        <div className="rounded bg-[var(--cx-green)]/5 border border-[var(--cx-green)]/10 px-3 py-1.5">
          <span className="text-[var(--cx-green)]">{us}</span>
        </div>
        <div className="rounded bg-[var(--cx-surface-2)] border border-[var(--cx-border)] px-3 py-1.5">
          <span className="text-[var(--cx-text-muted)]">{them}</span>
        </div>
      </div>
    </div>
  );
}

function RevenueBlock({ source, detail, status, statusColor }: { source: string; detail: string; status: string; statusColor: string }) {
  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[var(--cx-text)]">{source}</span>
        <span
          className="rounded-full px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[9px] font-bold tracking-wider border"
          style={{ color: statusColor, borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)` }}
        >
          {status}
        </span>
      </div>
      <div className="text-xs text-[var(--cx-text-dim)]">{detail}</div>
    </div>
  );
}

function EcoBlock({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg bg-[var(--cx-surface-2)] p-4">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-[var(--cx-purple)] mt-1">{value}</div>
      <div className="text-xs text-[var(--cx-text-dim)] mt-1">{detail}</div>
    </div>
  );
}
