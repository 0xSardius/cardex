/**
 * /demo/wallet — SSR showcase of the wallet-insight endpoint.
 *
 * Renders the composed SolEnrich risk + CardEx payment history + portfolio
 * payload for any Solana wallet address passed as ?address=... The form
 * is a plain HTML GET so the URL is shareable in outreach DMs.
 */

import Link from "next/link";
import { composeWalletInsight, type WalletInsightResult } from "@/lib/insight/wallet";
import type { EnrichWalletLightResponse } from "@/lib/solenrich/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ address?: string }>;

export default async function DemoWalletPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const address = (params.address ?? "").trim();

  let result: WalletInsightResult | null = null;
  let error: string | null = null;
  if (address) {
    try {
      result = await composeWalletInsight(address);
    } catch (err) {
      error = err instanceof Error ? err.message : "lookup failed";
    }
  }

  return (
    <div className="animate-fade-in">
      <DemoHeader />
      <LookupForm initial={address} />

      {error && (
        <div className="mt-6 rounded-lg border border-[var(--cx-red)]/40 bg-[var(--cx-red)]/5 px-4 py-3 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-red)]">
          lookup failed — {error}
        </div>
      )}

      {!address && <Suggestions />}

      {result && <Result data={result} />}
    </div>
  );
}

function DemoHeader() {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
        <span className="inline-block h-1 w-1 rounded-full bg-[var(--cx-amber)] animate-pulse" />
        live demo — agent-to-agent x402
      </div>
      <h1 className="font-[family-name:var(--font-geist-sans)] text-3xl font-bold text-[var(--cx-text)]">
        Wallet Intelligence
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--cx-text-dim)]">
        CardEx pays SolEnrich $0.002 for wallet enrichment, joins it against CardEx payment history and
        portfolio data, and returns one composed view. The agent caller pays CardEx $0.005 via x402.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
        <span>
          agent endpoint: <code className="text-[var(--cx-cyan)]">POST /api/v1/wallet-insight</code>
        </span>
        <span>•</span>
        <span>
          price: <code className="text-[var(--cx-green)]">$0.005</code> per call
        </span>
        <span>•</span>
        <span>
          upstream: <code className="text-[var(--cx-purple)]">solenrich enrich-wallet-light</code>
        </span>
      </div>
    </div>
  );
}

function LookupForm({ initial }: { initial: string }) {
  return (
    <form method="GET" className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        name="address"
        defaultValue={initial}
        placeholder="paste any solana wallet address"
        spellCheck={false}
        className="flex-1 rounded-md border border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text)] placeholder:text-[var(--cx-text-muted)] focus:border-[var(--cx-amber)] focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md border border-[var(--cx-amber)] bg-[var(--cx-amber)]/10 px-5 py-2 font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-amber)] transition-colors hover:bg-[var(--cx-amber)]/20"
      >
        run lookup
      </button>
    </form>
  );
}

function Suggestions() {
  // Sensible defaults: well-known Solana addresses that yield rich payloads
  // when the agent wallet is funded. The Magic Eden treasury is a safe pick
  // because it's deeply linked in the cluster graph.
  const examples: { label: string; address: string }[] = [
    {
      label: "Magic Eden marketplace",
      address: "1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix",
    },
    {
      label: "Tensor program authority",
      address: "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN",
    },
  ];
  return (
    <div className="mt-6 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/30 p-4">
      <div className="mb-3 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
        try one
      </div>
      <div className="flex flex-wrap gap-2">
        {examples.map((e) => (
          <Link
            key={e.address}
            href={`/demo/wallet?address=${e.address}`}
            className="rounded-md border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-cyan)] transition-colors hover:border-[var(--cx-cyan)]/40"
          >
            {e.label}{" "}
            <span className="text-[var(--cx-text-muted)]">
              · {e.address.slice(0, 4)}…{e.address.slice(-4)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Result({ data }: { data: WalletInsightResult }) {
  const solenrich = data.solenrich as EnrichWalletLightResponse | { unavailable: true; reason: string };
  const isSolenrichDown = "unavailable" in solenrich && solenrich.unavailable;

  return (
    <div className="mt-8 space-y-6">
      <AddressHeader address={data.address} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SolEnrichCard data={solenrich} />
        <CardExCard payment={data.cardex.paymentHistory} portfolio={data.cardex.portfolio} />
      </div>
      {isSolenrichDown && <SolEnrichDegradedBanner />}
      <PaymentFlow />
    </div>
  );
}

function AddressHeader({ address }: { address: string }) {
  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 px-4 py-3">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
        wallet
      </div>
      <div className="mt-1 break-all font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text)]">
        {address}
      </div>
    </div>
  );
}

function SolEnrichCard({
  data,
}: {
  data: EnrichWalletLightResponse | { unavailable: true; reason: string };
}) {
  const unavailable = "unavailable" in data && data.unavailable;

  return (
    <div className="rounded-lg border border-[var(--cx-purple)]/30 bg-[var(--cx-surface)]/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-purple)]">
            solenrich · enrich-wallet-light
          </div>
          <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-bold text-[var(--cx-text)]">
            Risk &amp; Holdings
          </h2>
        </div>
        <span className="rounded bg-[var(--cx-purple)]/15 px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-purple)]">
          $0.002 paid
        </span>
      </div>

      {unavailable ? (
        <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
          unavailable —{" "}
          <span className="text-[var(--cx-text-dim)]">
            {(data as { reason: string }).reason}
          </span>
        </div>
      ) : (
        <SolEnrichBody data={data as EnrichWalletLightResponse} />
      )}
    </div>
  );
}

function SolEnrichBody({ data }: { data: EnrichWalletLightResponse }) {
  const levelColor =
    data.riskLevel === "HIGH" || data.riskLevel === "CRITICAL"
      ? "text-[var(--cx-red)] bg-[var(--cx-red)]/10"
      : data.riskLevel === "MEDIUM"
      ? "text-[var(--cx-amber)] bg-[var(--cx-amber)]/10"
      : "text-[var(--cx-green)] bg-[var(--cx-green)]/10";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className={`rounded px-2 py-1 font-[family-name:var(--font-geist-mono)] text-xs font-bold ${levelColor}`}
        >
          {data.riskLevel ?? "—"} · {data.riskScore ?? "—"}
        </span>
        <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-dim)]">
          {data.solBalance?.toFixed(3) ?? "—"} SOL
        </div>
      </div>

      {data.behavioralLabels && data.behavioralLabels.length > 0 && (
        <div>
          <div className="mb-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
            behavioral labels
          </div>
          <div className="flex flex-wrap gap-1">
            {data.behavioralLabels.map((l) => (
              <span
                key={l}
                className="rounded bg-[var(--cx-purple)]/10 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-purple)]"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.tokenHoldings && data.tokenHoldings.length > 0 && (
        <div>
          <div className="mb-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
            top holdings
          </div>
          <div className="space-y-1">
            {data.tokenHoldings.slice(0, 5).map((h) => (
              <div
                key={h.mint}
                className="flex items-center justify-between font-[family-name:var(--font-geist-mono)] text-xs"
              >
                <span className="text-[var(--cx-text)]">{h.symbol}</span>
                <span className="text-[var(--cx-text-dim)]">${h.valueUsd?.toFixed(2) ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardExCard({
  payment,
  portfolio,
}: {
  payment: WalletInsightResult["cardex"]["paymentHistory"];
  portfolio: WalletInsightResult["cardex"]["portfolio"];
}) {
  return (
    <div className="rounded-lg border border-[var(--cx-amber)]/30 bg-[var(--cx-surface)]/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
            cardex · payments + portfolio
          </div>
          <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-bold text-[var(--cx-text)]">
            CardEx History
          </h2>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
            x402 payment history
          </div>
          {payment ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
                  calls paid
                </div>
                <div className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-text)]">
                  {payment.totalPayments}
                </div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
                  total spent
                </div>
                <div className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-green)]">
                  ${parseFloat(payment.totalSpentUsd).toFixed(4)}
                </div>
              </div>
            </div>
          ) : (
            <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
              no prior payments to CardEx
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
            portfolio
          </div>
          {portfolio ? (
            <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text)]">
              <span className="font-bold">{portfolio.itemCount}</span> tracked cards in &ldquo;
              {portfolio.name}&rdquo;
            </div>
          ) : (
            <div className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
              no portfolio on file for this wallet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SolEnrichDegradedBanner() {
  return (
    <div className="rounded-lg border border-[var(--cx-amber)]/30 bg-[var(--cx-amber)]/5 px-4 py-3">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-amber)]">
        graceful degradation
      </div>
      <p className="mt-1 text-xs text-[var(--cx-text-dim)]">
        SolEnrich returned <code className="text-[var(--cx-amber)]">unavailable</code> on this lookup —
        the CardEx agent wallet likely isn&apos;t funded yet. CardEx still returns its own payment +
        portfolio side so the SLA never depends on SolEnrich uptime.
      </p>
    </div>
  );
}

function PaymentFlow() {
  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/30 p-5">
      <div className="mb-3 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-cyan)]">
        agent-to-agent x402 flow
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Step
          n={1}
          label="caller → cardex"
          amount="$0.005 USDC"
          note="bot signs SOL tx, x402 verifies"
        />
        <Step
          n={2}
          label="cardex → solenrich"
          amount="$0.002 USDC"
          note="cardex pays from its own wallet"
        />
        <Step
          n={3}
          label="cardex → caller"
          amount="composed json"
          note="risk + payment history + portfolio"
        />
      </div>
    </div>
  );
}

function Step({ n, label, amount, note }: { n: number; label: string; amount: string; note: string }) {
  return (
    <div className="rounded-md border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[var(--cx-cyan)]/15 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold text-[var(--cx-cyan)]">
          {n}
        </span>
        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)]">
          {label}
        </span>
      </div>
      <div className="mt-1 font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-text)]">
        {amount}
      </div>
      <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--cx-text-muted)]">
        {note}
      </div>
    </div>
  );
}
