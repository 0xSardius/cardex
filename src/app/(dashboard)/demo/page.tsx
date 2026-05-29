/**
 * /demo — Landing page for the agent-facing demos.
 *
 * One-screen pitch: CardEx is the only Solana oracle that fuses paper-market
 * truth with onchain marketplace state, served per-query via x402. The two
 * sub-demos surface the composition narrative; this page frames them.
 */

import Link from "next/link";

export const dynamic = "force-static";

export default function DemoLanding() {
  return (
    <div className="animate-fade-in">
      <Hero />
      <DemoGrid />
      <ApiSummary />
    </div>
  );
}

function Hero() {
  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
        <span className="inline-block h-1 w-1 rounded-full bg-[var(--cx-amber)] animate-pulse" />
        for trading agents — solana-native
      </div>
      <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-bold text-[var(--cx-text)] text-glow-amber">
        Paper truth meets onchain state.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-[var(--cx-text-dim)]">
        CardEx is the pricing oracle that tokenized-card trading agents use. Paper-market data from
        Scryfall, TCGPlayer, CardMarket, Pokemon Price Tracker — joined live to Collector Crypt and
        Magic Eden listings, with SolEnrich seller intel layered on top. Per-query via x402 USDC on
        Solana.
      </p>
    </div>
  );
}

function DemoGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DemoCard
        href="/demo/arbitrage"
        accent="green"
        eyebrow="live scan · pokemon"
        title="Underpriced Onchain"
        body="Live feed of Collector Crypt + Magic Eden listings priced below paper-market by ≥10%, ranked by net profit after marketplace fees. Each row carries SolEnrich seller risk + wash-trade-cluster flag."
        endpoint="POST /api/v1/rwa-arbitrage"
        price="$0.005"
        cta="open demo"
      />
      <DemoCard
        href="/demo/wallet"
        accent="purple"
        eyebrow="agent-to-agent composition"
        title="Wallet Intelligence"
        body="Paste any Solana wallet, get a single composed view: SolEnrich risk score + behavioral labels + token holdings, fused with CardEx payment history and tracked portfolio."
        endpoint="POST /api/v1/wallet-insight"
        price="$0.005"
        cta="open demo"
      />
    </div>
  );
}

function DemoCard({
  href,
  accent,
  eyebrow,
  title,
  body,
  endpoint,
  price,
  cta,
}: {
  href: string;
  accent: "green" | "purple";
  eyebrow: string;
  title: string;
  body: string;
  endpoint: string;
  price: string;
  cta: string;
}) {
  const accentColor = accent === "green" ? "var(--cx-green)" : "var(--cx-purple)";
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 transition-all hover:border-[var(--cx-border-bright)] hover:bg-[var(--cx-surface)]"
    >
      <div
        className="mb-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider"
        style={{ color: accentColor }}
      >
        {eyebrow}
      </div>
      <h3 className="font-[family-name:var(--font-geist-sans)] text-xl font-bold text-[var(--cx-text)]">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[var(--cx-text-dim)]">{body}</p>
      <div className="mt-4 flex items-end justify-between">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
          <code className="text-[var(--cx-cyan)]">{endpoint}</code>
          <div className="mt-0.5">
            agent price <span style={{ color: accentColor }}>{price}</span> via x402
          </div>
        </div>
        <span
          className="font-[family-name:var(--font-geist-mono)] text-xs transition-transform group-hover:translate-x-1"
          style={{ color: accentColor }}
        >
          {cta} →
        </span>
      </div>
    </Link>
  );
}

function ApiSummary() {
  const endpoints: { name: string; method: string; price: string; live: boolean }[] = [
    { name: "/api/v1/price", method: "POST", price: "$0.001", live: true },
    { name: "/api/v1/arbitrage", method: "POST", price: "$0.005", live: true },
    { name: "/api/v1/grade", method: "POST", price: "$0.01", live: true },
    { name: "/api/v1/portfolio/value", method: "POST", price: "$0.002/card", live: true },
    { name: "/api/v1/set/complete", method: "POST", price: "$0.008", live: true },
    { name: "/api/v1/wallet-insight", method: "POST", price: "$0.005", live: true },
    { name: "/api/v1/rwa-fair-value", method: "POST", price: "$0.002", live: true },
    { name: "/api/v1/rwa-arbitrage", method: "POST", price: "$0.005", live: true },
  ];

  return (
    <div className="mt-12">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-bold text-[var(--cx-text)]">
          Full endpoint surface
        </h2>
        <Link
          href="/search"
          className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-cyan)] hover:underline"
        >
          dashboard →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--cx-border)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--cx-surface-2)] font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
              <th className="px-4 py-2 text-left">endpoint</th>
              <th className="px-4 py-2 text-left">method</th>
              <th className="px-4 py-2 text-right">price</th>
              <th className="px-4 py-2 text-right">status</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((e) => (
              <tr key={e.name} className="border-t border-[var(--cx-border)] bg-[var(--cx-surface)]/30">
                <td className="px-4 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-cyan)]">
                  {e.name}
                </td>
                <td className="px-4 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-dim)]">
                  {e.method}
                </td>
                <td className="px-4 py-2 text-right font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-green)]">
                  {e.price}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-1 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-green-dim)]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--cx-green)]" />
                    live
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
