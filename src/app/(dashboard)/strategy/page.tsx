export default function StrategyPage() {
  return (
    <div className="pb-12">
      {/* Header */}
      <div className="mb-2 font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.3em] text-[var(--cx-amber-dim)] uppercase">
        Strategic Analysis / Launch Decision Matrix
      </div>
      <h1 className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold mb-1">
        CardEx Go-to-Market
      </h1>
      <p className="text-sm text-[var(--cx-text-muted)] mb-10">
        Three paths evaluated. Pick one and execute.
      </p>

      {/* Canvas grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Canvas
          option="A"
          title="Ship Product First"
          subtitle="No token. Pure product play."
          risk="LOW"
          timeline="This week"
          recommended={false}
          problem="MTG traders have no programmatic pricing API. TCGPlayer closed theirs to new apps."
          solution="CardEx x402 API — micropayment-gated MTG prices, arbitrage detection, MTGO spread signals."
          metrics={["x402 revenue/query: $0.001–$0.01", "r/mtgfinance engagement", "Dashboard visitors"]}
          revenue="x402 micropayments from day 1"
          advantage="First MTG x402 agent. 90K cards, 322K prices, Scryfall pipeline built."
          channels={["r/mtgfinance (200K)", "MTG Twitter/X", "x402 builder community"]}
          cost="$7–10/mo (Railway + Neon)"
          keyRisk="Slow organic growth without speculative interest driving traffic."
          bestIf="You want credibility with the MTG finance community first."
        />

        <Canvas
          option="B"
          title="Launch Bags Token Now"
          subtitle="Token-first. Ride hackathon wave."
          risk="HIGH"
          timeline="Now"
          recommended={false}
          problem="Need hackathon momentum and fee revenue. Crypto attention is time-sensitive."
          solution="Bags token for CardEx — fee sharing from trading volume, speculative interest drives traffic to API."
          metrics={["Token trading volume", "Fee share revenue", "Holder count"]}
          revenue="Bags fee share + x402 micropayments (dual stream)"
          advantage="Already in Bags hackathon ecosystem. Dual revenue from day 1."
          channels={["Bags community", "Solana CT", "Crypto-native MTG players"]}
          cost="$7–10/mo + token launch effort + split focus"
          keyRisk="No users yet — token without product traction looks hollow. Splits focus with SolEnrich hackathon entry."
          bestIf="You want max financial upside and can absorb the credibility risk."
        />

        <Canvas
          option="C"
          title="Product → Users → Token"
          subtitle="Sequence for maximum leverage."
          risk="MEDIUM"
          timeline="2–4 weeks"
          recommended={true}
          problem="Need both product credibility AND token upside. Doing both at once dilutes both."
          solution="Ship CardEx publicly → get 10–20 real users → THEN launch Bags token with traction as the narrative."
          metrics={["Week 1–2: API users, dashboard visits", "Week 3–4: Token volume + fee share"]}
          revenue="x402 first → then x402 + Bags fee share"
          advantage={`"Live product generating real x402 fees" is the strongest token launch narrative in the market.`}
          channels={["r/mtgfinance first", "Then Bags + Solana CT for token"]}
          cost="$7–10/mo now. Token launch cost later."
          keyRisk="Someone else launches MTG token first (unlikely). Bags hackathon deadline may pass."
          bestIf="You want to maximize both credibility and financial upside."
        />
      </div>

      {/* Comparison strip */}
      <div className="mt-10 rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--cx-border)] font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-text-muted)] uppercase">
          Head-to-Head
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--cx-border)]">
                <th className="px-5 py-3 text-left font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)] font-normal">Factor</th>
                <th className="px-5 py-3 text-center font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)] font-normal">A: Product</th>
                <th className="px-5 py-3 text-center font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)] font-normal">B: Token Now</th>
                <th className="px-5 py-3 text-center font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)] font-normal">C: Sequenced</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-geist-mono)] text-xs">
              <CompRow label="Time to first $" a="Days" b="Hours" c="Days" highlight="b" />
              <CompRow label="Credibility" a="High" b="Low" c="High" highlight="ac" />
              <CompRow label="Revenue ceiling" a="Low" b="High" c="Highest" highlight="c" />
              <CompRow label="Focus cost" a="None" b="Split" c="Staged" highlight="a" />
              <CompRow label="MTG community reception" a="Positive" b="Skeptical" c="Positive" highlight="ac" />
              <CompRow label="Crypto community reception" a="Meh" b="Interested" c="Interested" highlight="bc" />
              <CompRow label="Downside if fails" a="Minimal" b="Reputation" c="Minimal" highlight="ac" />
              <CompRow label="Token narrative strength" a="N/A" b="Weak" c="Strong" highlight="c" />
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom line */}
      <div className="mt-8 rounded-xl border border-[var(--cx-amber-dim)]/30 bg-[var(--cx-amber)]/[0.03] p-5">
        <div className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.2em] text-[var(--cx-amber)] uppercase mb-2">
          Bottom Line
        </div>
        <p className="text-sm text-[var(--cx-text-dim)] leading-relaxed">
          <strong className="text-[var(--cx-text)]">Option C gives you two marketing events instead of one.</strong>{" "}
          Week 1: &ldquo;CardEx is live — the MTG pricing API that TCGPlayer won&rsquo;t give you.&rdquo;{" "}
          Week 3: &ldquo;CardEx is generating real fees — now launching a token so you can earn from it too.&rdquo;{" "}
          Each event feeds the next. Option B burns both events at once.
        </p>
      </div>
    </div>
  );
}

/* ─── CANVAS CARD ─── */
function Canvas({
  option,
  title,
  subtitle,
  risk,
  timeline,
  recommended,
  problem,
  solution,
  metrics,
  revenue,
  advantage,
  channels,
  cost,
  keyRisk,
  bestIf,
}: {
  option: string;
  title: string;
  subtitle: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  timeline: string;
  recommended: boolean;
  problem: string;
  solution: string;
  metrics: string[];
  revenue: string;
  advantage: string;
  channels: string[];
  cost: string;
  keyRisk: string;
  bestIf: string;
}) {
  const riskColor = {
    LOW: "text-[var(--cx-green)] border-[var(--cx-green)]/20 bg-[var(--cx-green)]/5",
    MEDIUM: "text-[var(--cx-amber)] border-[var(--cx-amber)]/20 bg-[var(--cx-amber)]/5",
    HIGH: "text-[var(--cx-red)] border-[var(--cx-red)]/20 bg-[var(--cx-red)]/5",
  }[risk];

  return (
    <div
      className={`relative rounded-xl border bg-[var(--cx-surface)]/50 p-5 flex flex-col ${
        recommended
          ? "border-[var(--cx-amber-dim)]/40 ring-1 ring-[var(--cx-amber)]/10"
          : "border-[var(--cx-border)]"
      }`}
    >
      {/* Recommended badge */}
      {recommended && (
        <div className="absolute -top-3 left-4 rounded bg-[var(--cx-amber)] px-2.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold tracking-wider text-[var(--cx-black)] uppercase">
          Recommended
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
            Option {option}
          </span>
          <span className={`rounded-md border px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold ${riskColor}`}>
            {risk} RISK
          </span>
        </div>
        <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-bold">{title}</h2>
        <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">{subtitle}</p>
      </div>

      {/* Fields */}
      <div className="space-y-3 flex-1">
        <Field label="Problem" value={problem} />
        <Field label="Solution" value={solution} />
        <Field label="Key Metrics">
          <ul className="space-y-0.5">
            {metrics.map((m, i) => (
              <li key={i} className="text-xs text-[var(--cx-text-dim)] before:content-['›_'] before:text-[var(--cx-text-muted)]">
                {m}
              </li>
            ))}
          </ul>
        </Field>
        <Field label="Revenue" value={revenue} />
        <Field label="Unfair Advantage" value={advantage} highlight />
        <Field label="Channels">
          <div className="flex flex-wrap gap-1">
            {channels.map((c) => (
              <span key={c} className="rounded border border-[var(--cx-border)] bg-[var(--cx-surface-2)] px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
                {c}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Cost" value={cost} />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-[var(--cx-border)] space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)] uppercase tracking-wider shrink-0">
            Timeline
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-xs font-bold text-[var(--cx-text)]">
            {timeline}
          </span>
        </div>
        <div>
          <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-red)] uppercase tracking-wider">
            Key Risk
          </span>
          <p className="text-xs text-[var(--cx-text-dim)] mt-0.5">{keyRisk}</p>
        </div>
        <div className="rounded-lg bg-[var(--cx-surface-2)] px-3 py-2">
          <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-amber)] uppercase tracking-wider">
            Best If
          </span>
          <p className="text-xs text-[var(--cx-text)] mt-0.5 font-medium">{bestIf}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── FIELD ─── */
function Field({
  label,
  value,
  highlight,
  children,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)] uppercase tracking-wider mb-0.5">
        {label}
      </div>
      {value ? (
        <p className={`text-xs leading-relaxed ${highlight ? "text-[var(--cx-amber)]" : "text-[var(--cx-text-dim)]"}`}>
          {value}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

/* ─── COMPARISON ROW ─── */
function CompRow({
  label,
  a,
  b,
  c,
  highlight,
}: {
  label: string;
  a: string;
  b: string;
  c: string;
  highlight: string;
}) {
  const cellClass = (col: string) =>
    highlight.includes(col)
      ? "text-[var(--cx-amber)] font-bold"
      : "text-[var(--cx-text-dim)]";

  return (
    <tr className="border-b border-[var(--cx-border)]/50">
      <td className="px-5 py-2.5 text-[var(--cx-text-muted)]">{label}</td>
      <td className={`px-5 py-2.5 text-center ${cellClass("a")}`}>{a}</td>
      <td className={`px-5 py-2.5 text-center ${cellClass("b")}`}>{b}</td>
      <td className={`px-5 py-2.5 text-center ${cellClass("c")}`}>{c}</td>
    </tr>
  );
}
