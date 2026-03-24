export default function Home() {
  return (
    <div className="noise scanlines min-h-screen bg-[var(--cx-black)] text-[var(--cx-text)] overflow-x-hidden">
      {/* Top status bar */}
      <StatusBar />

      {/* Ticker */}
      <Ticker />

      {/* Hero */}
      <Hero />

      {/* Problem */}
      <Problem />

      {/* Features / Endpoints */}
      <Endpoints />

      {/* Stats */}
      <Stats />

      {/* Who it's for */}
      <Audience />

      {/* How it works */}
      <HowItWorks />

      {/* CTA */}
      <CTA />

      {/* Footer */}
      <Footer />
    </div>
  );
}

/* ─── STATUS BAR ─── */
function StatusBar() {
  return (
    <header className="animate-fade-in fixed top-0 left-0 right-0 z-50 border-b border-[var(--cx-border)] bg-[var(--cx-black)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 font-[family-name:var(--font-geist-mono)] text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-wider text-[var(--cx-amber)]">CARDEX</span>
          <span className="text-[var(--cx-text-muted)]">|</span>
          <span className="text-[var(--cx-text-dim)]">MARKET INTELLIGENCE AGENT</span>
        </div>
        <div className="hidden items-center gap-4 sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--cx-green)] animate-pulse-glow" />
            <span className="text-[var(--cx-green-dim)]">SYSTEMS ONLINE</span>
          </span>
          <span className="text-[var(--cx-text-muted)]">x402 / SOLANA</span>
        </div>
      </div>
    </header>
  );
}

/* ─── TICKER ─── */
function Ticker() {
  const items = [
    { name: "Black Lotus (Alpha)", price: "$285,000", change: "+2.3%" },
    { name: "Mox Sapphire (Beta)", price: "$12,800", change: "+1.1%" },
    { name: "Underground Sea (Rev)", price: "$620.00", change: "-1.2%" },
    { name: "Jace, the Mind Sculptor", price: "$89.99", change: "+4.7%" },
    { name: "Ragavan, Nimble Pilferer", price: "$62.50", change: "+3.8%" },
    { name: "The One Ring (Foil)", price: "$185.00", change: "-0.5%" },
    { name: "Force of Will (Alliances)", price: "$95.00", change: "+1.4%" },
    { name: "Sheoldred, the Apocalypse", price: "$48.00", change: "+5.2%" },
    { name: "Cavern of Souls (UMA)", price: "$52.00", change: "-2.1%" },
    { name: "Wrenn and Six (MH1)", price: "$58.00", change: "+0.9%" },
  ];

  const doubled = [...items, ...items];

  return (
    <div className="animate-fade-in delay-200 mt-10 border-b border-[var(--cx-border)] bg-[var(--cx-surface)]/50 py-2 overflow-hidden">
      <div className="animate-ticker flex whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="mx-6 font-[family-name:var(--font-geist-mono)] text-xs inline-flex items-center gap-2"
          >
            <span className="text-[var(--cx-text-dim)]">{item.name}</span>
            <span className="text-[var(--cx-text)]">{item.price}</span>
            <span className={item.change.startsWith("+") ? "text-[var(--cx-green)]" : "text-[var(--cx-red)]"}>
              {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── HERO ─── */
function Hero() {
  return (
    <section className="relative py-28 sm:py-36 px-4">
      {/* Background grid */}
      <div className="terminal-grid animate-grid absolute inset-0 opacity-40" />

      {/* Decorative floating cards */}
      <div className="absolute top-16 right-[8%] hidden lg:block">
        <div className="card-shape w-20 bg-gradient-to-br from-[var(--cx-surface-2)] to-[var(--cx-surface-3)] rotate-12 opacity-20" />
      </div>
      <div className="absolute bottom-20 left-[6%] hidden lg:block">
        <div className="card-shape w-16 bg-gradient-to-br from-[var(--cx-surface-2)] to-[var(--cx-surface-3)] -rotate-6 opacity-15" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Terminal prefix */}
        <div className="animate-fade-up delay-100 mb-6 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-amber-dim)] tracking-widest uppercase">
          <span className="text-[var(--cx-amber)] animate-blink mr-1">_</span>
          Autonomous Agent &middot; x402 Micropayments &middot; Solana
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up delay-200 font-[family-name:var(--font-geist-sans)] text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
          <span className="text-glow-amber text-[var(--cx-amber)]">Real-time</span>{" "}
          MTG market intelligence
        </h1>

        {/* Subhead */}
        <p className="animate-fade-up delay-300 mt-6 text-lg sm:text-xl text-[var(--cx-text-dim)] max-w-2xl mx-auto leading-relaxed">
          The Bloomberg Terminal for Magic: The Gathering. Aggregated pricing from TCGPlayer, CardMarket, MTGO, and more — served via pay-per-query micropayments.
        </p>

        {/* CTA buttons */}
        <div className="animate-fade-up delay-500 mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#endpoints"
            className="gradient-border inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--cx-surface-2)] px-6 py-3 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-amber)] transition-all hover:bg-[var(--cx-surface-3)] hover:scale-[1.02]"
          >
            <span className="text-[var(--cx-text-muted)]">$</span> Query the API
          </a>
          <a
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--cx-border)] bg-transparent px-6 py-3 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text-dim)] transition-all hover:border-[var(--cx-border-bright)] hover:text-[var(--cx-text)]"
          >
            Browse Dashboard
          </a>
        </div>

        {/* Micro-proof */}
        <div className="animate-fade-up delay-700 mt-8 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
          No API keys &middot; No subscriptions &middot; Pay only for what you query
        </div>
      </div>
    </section>
  );
}

/* ─── PROBLEM ─── */
function Problem() {
  const platforms = [
    "TCGPlayer",
    "CardMarket",
    "Card Kingdom",
    "MTGO / Cardhoarder",
    "eBay",
    "Hareruya",
  ];

  return (
    <section className="relative border-t border-[var(--cx-border)] py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="animate-fade-up grid gap-12 md:grid-cols-2 md:items-center">
          {/* Left: Problem */}
          <div>
            <div className="mb-3 font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-red)] uppercase">
              The Problem
            </div>
            <h2 className="font-[family-name:var(--font-geist-sans)] text-3xl font-bold leading-tight">
              $800M+ singles market.<br />
              <span className="text-[var(--cx-text-dim)]">No programmatic access.</span>
            </h2>
            <p className="mt-4 text-[var(--cx-text-dim)] leading-relaxed">
              TCGPlayer closed their API to new apps. Prices are scattered across {platforms.length}+ platforms with different currencies, conditions, and 1M+ foil treatment SKUs. Traders manually cross-reference buylist spreads and Reserved List movements. Bots can&apos;t access any of it.
            </p>

            {/* Platform scatter */}
            <div className="mt-6 flex flex-wrap gap-2">
              {platforms.map((p, i) => (
                <span
                  key={p}
                  className="animate-fade-in rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]"
                  style={{ animationDelay: `${300 + i * 80}ms` }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Solution */}
          <div className="rounded-xl border border-[var(--cx-amber-dim)]/20 bg-[var(--cx-surface)]/80 p-6 glow-amber">
            <div className="mb-3 font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-green)] uppercase">
              The Solution
            </div>
            <h2 className="font-[family-name:var(--font-geist-sans)] text-3xl font-bold leading-tight">
              One API.<br />
              <span className="text-[var(--cx-amber)]">Every source.</span>
            </h2>
            <p className="mt-4 text-[var(--cx-text-dim)] leading-relaxed">
              CardEx aggregates all platforms into one treatment-aware API. Regular, foil, extended art, borderless, showcase — every SKU priced. Detect arbitrage in milliseconds. Pay per query with USDC — as low as $0.001.
            </p>

            {/* Mini terminal */}
            <div className="mt-6 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-black)] p-4 font-[family-name:var(--font-geist-mono)] text-xs">
              <div className="text-[var(--cx-text-muted)]">
                {">"} POST /api/v1/price
              </div>
              <div className="mt-1 text-[var(--cx-text-muted)]">
                {">"} {`{ "card": "Black Lotus", "game": "mtg" }`}
              </div>
              <div className="mt-2 text-[var(--cx-green)]">
                200 OK <span className="text-[var(--cx-text-muted)]">• paid $0.001 USDC</span>
              </div>
              <div className="mt-1 text-[var(--cx-text)]">
                {`{ "usd": 285000, "eur": 262400, "spread": "+8.6%" }`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── ENDPOINTS ─── */
function Endpoints() {
  const endpoints = [
    {
      method: "POST",
      path: "/api/v1/price",
      price: "$0.001",
      description: "Exact + fuzzy card lookup across all indexed platforms. Returns USD, EUR, MTGO tix with cross-platform spreads. Reserved List and format legality included.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/arbitrage",
      price: "$0.005",
      description: "Cross-platform arbitrage scanner. Detects TCGPlayer/CardMarket spreads, buylist premiums, MTGO-to-paper gaps, and Reserved List movements.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/mtgo-spread",
      price: "$0.005",
      description: "MTGO-to-paper price spread detector. Tix spikes are a leading indicator for paper price increases. Flags both directions.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/set/complete",
      price: "$0.008",
      description: "Set completion advisor. Shows missing cards, estimated cost to complete, and cheapest sources per card.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/portfolio/value",
      price: "$0.002/card",
      description: "Bulk portfolio valuation. Submit a list of cards, get aggregated market value with per-card breakdown.",
      tag: "BETA",
      tagColor: "var(--cx-cyan)",
    },
    {
      method: "POST",
      path: "/api/v1/grade",
      price: "$0.01",
      description: "AI vision-based grade estimation. Upload a card image, get PSA/BGS probability distribution and grading ROI.",
      tag: "SOON",
      tagColor: "var(--cx-text-muted)",
    },
  ];

  return (
    <section id="endpoints" className="border-t border-[var(--cx-border)] py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="animate-fade-up mb-3 font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-amber)] uppercase">
          API Endpoints
        </div>
        <h2 className="animate-fade-up delay-100 font-[family-name:var(--font-geist-sans)] text-3xl sm:text-4xl font-bold">
          Pay per query. <span className="text-[var(--cx-text-dim)]">Sub-cent pricing.</span>
        </h2>
        <p className="animate-fade-up delay-200 mt-3 text-[var(--cx-text-dim)] max-w-xl">
          Every endpoint is gated by x402 micropayments on Solana. No API keys, no rate limits, no subscriptions. Just USDC.
        </p>

        <div className="mt-12 space-y-3">
          {endpoints.map((ep, i) => (
            <div
              key={ep.path}
              className="animate-slide-left group rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-5 transition-all hover:border-[var(--cx-border-bright)] hover:bg-[var(--cx-surface)]"
              style={{ animationDelay: `${300 + i * 100}ms` }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 rounded bg-[var(--cx-surface-3)] px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-cyan)]">
                    {ep.method}
                  </span>
                  <code className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text)] truncate">
                    {ep.path}
                  </code>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold tracking-wider border"
                    style={{
                      color: `${ep.tagColor}`,
                      borderColor: `color-mix(in srgb, ${ep.tagColor} 30%, transparent)`,
                    }}
                  >
                    {ep.tag}
                  </span>
                </div>
                <span className="shrink-0 font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-amber)]">
                  {ep.price}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--cx-text-dim)] leading-relaxed">
                {ep.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── STATS ─── */
function Stats() {
  const stats = [
    { value: "90K+", label: "Cards Indexed", sub: "Every MTG printing" },
    { value: "322K+", label: "Price Points", sub: "USD, EUR, MTGO Tix" },
    { value: "571", label: "Reserved List", sub: "Supply-locked cards tracked" },
    { value: "$0.001", label: "Min Query Cost", sub: "USDC on Solana" },
  ];

  return (
    <section className="border-t border-[var(--cx-border)] py-24 px-4 bg-[var(--cx-surface)]/30">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="animate-fade-up text-center"
              style={{ animationDelay: `${200 + i * 150}ms` }}
            >
              <div className="font-[family-name:var(--font-geist-mono)] text-4xl sm:text-5xl font-bold text-[var(--cx-amber)] text-glow-amber">
                {s.value}
              </div>
              <div className="mt-2 text-sm font-medium text-[var(--cx-text)]">{s.label}</div>
              <div className="mt-0.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── AUDIENCE ─── */
function Audience() {
  const audiences = [
    {
      label: "MTG Finance Traders",
      hook: "TCGPlayer closed their API. CardEx is open and cheaper.",
      icon: "↗",
    },
    {
      label: "Bot & Agent Builders",
      hook: "Programmatic MTG pricing without scraping. x402 native.",
      icon: "⚡",
    },
    {
      label: "Store Owners",
      hook: "Buylist arbitrage alerts across US, EU, and JP markets.",
      icon: "☰",
    },
    {
      label: "Collectors",
      hook: "What's my collection worth? $0.002 per card to find out.",
      icon: "◈",
    },
  ];

  return (
    <section className="border-t border-[var(--cx-border)] py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="animate-fade-up mb-3 font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-amber)] uppercase">
          Built For
        </div>
        <h2 className="animate-fade-up delay-100 font-[family-name:var(--font-geist-sans)] text-3xl sm:text-4xl font-bold">
          Humans and agents. <span className="text-[var(--cx-text-dim)]">Same API.</span>
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {audiences.map((a, i) => (
            <div
              key={a.label}
              className="animate-fade-up rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-5 transition-all hover:border-[var(--cx-border-bright)]"
              style={{ animationDelay: `${300 + i * 100}ms` }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--cx-surface-3)] font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-amber)]">
                  {a.icon}
                </span>
                <span className="font-semibold text-[var(--cx-text)]">{a.label}</span>
              </div>
              <p className="text-sm text-[var(--cx-text-dim)] leading-relaxed">{a.hook}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Send a request",
      desc: "POST to any endpoint with your query. No auth headers — x402 handles payment inline.",
      code: `curl -X POST https://cardex.up.railway.app/api/v1/price \\
  -d '{"card":"Ragavan, Nimble Pilferer","game":"mtg"}'`,
    },
    {
      num: "02",
      title: "Pay with USDC",
      desc: "Get a 402 response with payment details. Your x402 client auto-signs a Solana USDC transfer.",
      code: `HTTP/1.1 402 Payment Required
x402-version: 2
x402-scheme: exact-svm
x402-price: 1000  # $0.001 USDC`,
    },
    {
      num: "03",
      title: "Get your data",
      desc: "Resubmit with the signed payment proof. Receive normalized, cross-platform pricing instantly.",
      code: `{
  "card": "Ragavan, Nimble Pilferer (MH2)",
  "treatment": "regular",
  "prices": { "usd": 62.50, "eur": 54.80, "tix": 42.1 },
  "spread": "+14.1%",
  "sources": ["tcgplayer","cardmarket","mtgo"]
}`,
    },
  ];

  return (
    <section id="how-it-works" className="border-t border-[var(--cx-border)] py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="animate-fade-up mb-3 font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-amber)] uppercase">
          How It Works
        </div>
        <h2 className="animate-fade-up delay-100 font-[family-name:var(--font-geist-sans)] text-3xl sm:text-4xl font-bold">
          Three steps. <span className="text-[var(--cx-text-dim)]">No setup.</span>
        </h2>

        <div className="mt-14 space-y-12">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="animate-fade-up grid gap-6 md:grid-cols-[200px_1fr] md:items-start"
              style={{ animationDelay: `${300 + i * 150}ms` }}
            >
              <div>
                <span className="font-[family-name:var(--font-geist-mono)] text-5xl font-bold text-[var(--cx-surface-3)]">
                  {step.num}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-[var(--cx-text-dim)] leading-relaxed">{step.desc}</p>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-[var(--cx-border)] bg-[var(--cx-black)] p-4 font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed text-[var(--cx-text-dim)]">
                {step.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTA() {
  return (
    <section className="border-t border-[var(--cx-border)] py-28 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[var(--cx-amber)] opacity-[0.03] blur-[120px]" />

      <div className="relative mx-auto max-w-2xl text-center">
        <div className="animate-fade-up font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-green)] uppercase mb-4">
          Ready to query
        </div>
        <h2 className="animate-fade-up delay-100 font-[family-name:var(--font-geist-sans)] text-4xl sm:text-5xl font-bold">
          Market data for{" "}
          <span className="text-[var(--cx-amber)] text-glow-amber">every card.</span>
        </h2>
        <p className="animate-fade-up delay-200 mt-4 text-[var(--cx-text-dim)] text-lg">
          Start querying for as little as $0.001 per request. No signup required — just USDC on Solana.
        </p>

        <div className="animate-fade-up delay-400 mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#endpoints"
            className="gradient-border inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--cx-amber)]/10 px-8 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-amber)] transition-all hover:bg-[var(--cx-amber)]/20 hover:scale-[1.02]"
          >
            View Endpoints
          </a>
          <a
            href="https://github.com"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--cx-border)] px-8 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text-dim)] transition-all hover:border-[var(--cx-border-bright)] hover:text-[var(--cx-text)]"
          >
            Documentation
          </a>
        </div>

        {/* Tech badges */}
        <div className="animate-fade-up delay-600 mt-12 flex flex-wrap gap-3 justify-center">
          {["x402 Protocol", "Solana USDC", "ERC-8004 Identity", "Sub-cent Tx"].map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-[var(--cx-border)] px-3 py-1 font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--cx-text-muted)]"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer className="border-t border-[var(--cx-border)] py-8 px-4">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--cx-amber)]">CARDEX</span>
          <span>Autonomous Market Intelligence</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Magic: The Gathering</span>
          <span className="text-[var(--cx-border)]">|</span>
          <span>Powered by x402</span>
        </div>
      </div>
    </footer>
  );
}
