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
          <span className="text-[var(--cx-text-dim)]">TOKENIZED-CARD PRICING ORACLE</span>
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
    { name: "Charizard Base Set (PSA 10)", price: "$12,400", change: "+3.1%" },
    { name: "Umbreon VMAX Alt (Eevee)", price: "$520.00", change: "+6.2%" },
    { name: "Lugia 1st Ed (Neo Genesis)", price: "$3,200", change: "+2.7%" },
    { name: "Moonbreon (Evolving Skies)", price: "$410.00", change: "-1.8%" },
    { name: "Black Lotus (Alpha)", price: "$285,000", change: "+2.3%" },
    { name: "Mox Sapphire (Beta)", price: "$12,800", change: "+1.1%" },
    { name: "The One Ring (Foil)", price: "$185.00", change: "-0.5%" },
    { name: "Ragavan, Nimble Pilferer", price: "$62.50", change: "+3.8%" },
    { name: "Sheoldred, the Apocalypse", price: "$48.00", change: "+5.2%" },
    { name: "Pikachu Illustrator", price: "$1,900,000", change: "+0.4%" },
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
          Pricing Oracle &middot; x402 Micropayments &middot; Solana RWA
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up delay-200 font-[family-name:var(--font-geist-sans)] text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
          <span className="text-glow-amber text-[var(--cx-amber)]">Real-time</span>{" "}
          fair value for tokenized cards
        </h1>

        {/* Subhead */}
        <p className="animate-fade-up delay-300 mt-6 text-lg sm:text-xl text-[var(--cx-text-dim)] max-w-2xl mx-auto leading-relaxed">
          Paper-market truth meets onchain marketplace state. The Solana-native oracle trading agents query per call to spot tokenized cards mispriced against paper — Collector Crypt, Phygitals, and Magic Eden listings vs. TCGPlayer, CardMarket, and MTGO.
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
            href="/demo"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--cx-border)] bg-transparent px-6 py-3 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text-dim)] transition-all hover:border-[var(--cx-border-bright)] hover:text-[var(--cx-text)]"
          >
            See Live Demo
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
    "Collector Crypt",
    "Phygitals",
    "Magic Eden",
    "TCGPlayer",
    "CardMarket",
    "MTGO / Cardhoarder",
    "eBay",
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
              $124.5M/mo tokenized.<br />
              <span className="text-[var(--cx-text-dim)]">Prices that never agree.</span>
            </h2>
            <p className="mt-4 text-[var(--cx-text-dim)] leading-relaxed">
              The same graded Charizard gets minted on Collector Crypt, listed on Magic Eden, and sells for a different number on TCGPlayer and eBay. Every platform knows only its own side — and they&apos;re all conflicted. Trading bots fly blind across the spread.
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
              One oracle.<br />
              <span className="text-[var(--cx-amber)]">Both sides.</span>
            </h2>
            <p className="mt-4 text-[var(--cx-text-dim)] leading-relaxed">
              CardEx prices every onchain listing against paper-market truth, nets out marketplace fees, and screens the seller via SolEnrich — so an agent sees real, post-fee edge. Per query, in USDC, as low as $0.001.
            </p>

            {/* Mini terminal */}
            <div className="mt-6 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-black)] p-4 font-[family-name:var(--font-geist-mono)] text-xs">
              <div className="text-[var(--cx-text-muted)]">
                {">"} POST /api/v1/rwa-fair-value
              </div>
              <div className="mt-1 text-[var(--cx-text-muted)]">
                {">"} {`{ "mint": "4Uzajig8..." }`}
              </div>
              <div className="mt-2 text-[var(--cx-green)]">
                200 OK <span className="text-[var(--cx-text-muted)]">• paid $0.002 USDC</span>
              </div>
              <div className="mt-1 text-[var(--cx-text)]">
                {`{ "paper": 41.20, "onchain_ask": 33.00, "spread": "-19.9%" }`}
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
      path: "/api/v1/rwa-fair-value",
      price: "$0.002",
      description: "Paper-vs-onchain fair value for a single tokenized mint or listing URL. Returns paper-market price, best onchain ask, spread %, freshness, and grading basis.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/rwa-arbitrage",
      price: "$0.005",
      description: "Scan active Solana listings priced under the paper market by ≥X%. Net-profit sorted after marketplace fees, with seller risk + wash-trade clusters screened via SolEnrich.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/wallet-insight",
      price: "$0.005",
      description: "Wallet intelligence: tokenized-card holdings, portfolio value, and SolEnrich risk score — composed in one call. Agent-to-agent x402 (CardEx pays SolEnrich under the hood).",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/price",
      price: "$0.001",
      description: "Paper-market price across TCGPlayer, CardMarket, and MTGO. Exact + fuzzy lookup for MTG and Pokémon, with cross-platform spreads, Reserved List, and format legality.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
    },
    {
      method: "POST",
      path: "/api/v1/arbitrage",
      price: "$0.005",
      description: "Cross-market paper arbitrage scanner. Detects US/EU spreads, buylist premiums, and MTGO-to-paper gaps — the leading-indicator depth no onchain marketplace has.",
      tag: "LIVE",
      tagColor: "var(--cx-green)",
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
          Every endpoint is gated by x402 micropayments on Solana. No API keys, no rate limits, no subscriptions. Just USDC — and the facilitator sponsors the gas.
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
    { value: "$124.5M", label: "Monthly Volume", sub: "Tokenized cards onchain" },
    { value: "110K+", label: "Cards Indexed", sub: "MTG + Pokémon" },
    { value: "322K+", label: "Paper Price Points", sub: "USD, EUR, MTGO Tix" },
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
      label: "Arbitrage Bots",
      hook: "Scan Magic Eden + Collector Crypt listings against paper-market truth. Mispricing surfaced in milliseconds, net of fees.",
      icon: "⚡",
    },
    {
      label: "Trading Agents",
      hook: "x402-native, no API keys. Pay per call in USDC. ERC-8004 identity + reputation on every response.",
      icon: "↗",
    },
    {
      label: "Wallet & Portfolio Tools",
      hook: "Value tokenized holdings and screen counterparties — CardEx composes SolEnrich wallet risk in a single call.",
      icon: "◈",
    },
    {
      label: "MTG Finance & Collectors",
      hook: "The deepest cross-game offchain pricing on Solana. TCGPlayer, CardMarket, MTGO, Reserved List.",
      icon: "☰",
    },
  ];

  return (
    <section className="border-t border-[var(--cx-border)] py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="animate-fade-up mb-3 font-[family-name:var(--font-geist-mono)] text-xs tracking-widest text-[var(--cx-amber)] uppercase">
          Built For
        </div>
        <h2 className="animate-fade-up delay-100 font-[family-name:var(--font-geist-sans)] text-3xl sm:text-4xl font-bold">
          Agents first. <span className="text-[var(--cx-text-dim)]">Humans welcome.</span>
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
      code: `curl -X POST https://cardex.up.railway.app/api/v1/rwa-fair-value \\
  -d '{"mint":"4Uzajig8c5AuR3UNRrg13ErDqbQiNz5YShZMPyGDUenh"}'`,
    },
    {
      num: "02",
      title: "Pay with USDC",
      desc: "Get a 402 response with payment details. Your x402 client auto-signs a Solana USDC transfer — the facilitator sponsors the gas.",
      code: `HTTP/1.1 402 Payment Required
x402-version: 2
x402-scheme: exact (svm)
network: solana mainnet  # $0.002 USDC`,
    },
    {
      num: "03",
      title: "Get your data",
      desc: "Resubmit with the signed payment proof. Receive paper-market truth and onchain state, reconciled, instantly.",
      code: `{
  "card": "Raichu — XY Evolutions #49 (PSA 8)",
  "paper_price": 41.20,
  "onchain_ask": 33.00,
  "spread": "-19.9%",
  "seller_risk": "low",
  "freshness": "2m",
  "sources": ["pokemontcg","magic-eden","solenrich"]
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
          Price truth for{" "}
          <span className="text-[var(--cx-amber)] text-glow-amber">every tokenized card.</span>
        </h2>
        <p className="animate-fade-up delay-200 mt-4 text-[var(--cx-text-dim)] text-lg">
          Point your agent at CardEx and pay per call — sub-cent, USDC on Solana, no signup. Paper-market depth and onchain state in one response.
        </p>

        <div className="animate-fade-up delay-400 mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#endpoints"
            className="gradient-border inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--cx-amber)]/10 px-8 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-amber)] transition-all hover:bg-[var(--cx-amber)]/20 hover:scale-[1.02]"
          >
            View Endpoints
          </a>
          <a
            href="https://github.com/0xSardius/cardex"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--cx-border)] px-8 py-3.5 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text-dim)] transition-all hover:border-[var(--cx-border-bright)] hover:text-[var(--cx-text)]"
          >
            Documentation
          </a>
        </div>

        {/* Tech badges */}
        <div className="animate-fade-up delay-600 mt-12 flex flex-wrap gap-3 justify-center">
          {["x402 Protocol", "Solana USDC", "ERC-8004 Identity", "SolEnrich Composed"].map((badge) => (
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
          <span>Onchain Pricing Oracle</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Tokenized Collectibles &middot; Solana</span>
          <span className="text-[var(--cx-border)]">|</span>
          <span>Powered by x402</span>
        </div>
      </div>
    </footer>
  );
}
