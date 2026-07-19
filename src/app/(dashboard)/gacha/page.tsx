/**
 * /gacha — free public Pack EV dashboard (Spec 01's growth surface).
 *
 * Renders the EV ladder for a gacha machine straight from computePackEv()
 * (no x402 hop — this page is the demo/distribution surface; agents pay
 * $0.001 for the same payload at GET /api/v1/gacha/ev).
 *
 * ?pack=pokemon_50 selects the machine (defaults to pokemon_50).
 */

import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { computePackEv, type PackEv } from "@/lib/gacha/ev";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const mono = "font-[family-name:var(--font-geist-mono)]";

export default async function GachaEvPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const { pack: packParam } = await searchParams;
  const pack = packParam ?? "pokemon_50";

  let ev: PackEv | null = null;
  let error: string | null = null;
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
    const sql = neon(process.env.DATABASE_URL);
    ev = await computePackEv(sql, pack);
  } catch (err) {
    error = err instanceof Error ? err.message : "EV computation failed";
  }

  return (
    <div className="animate-fade-in">
      <Header pack={pack} ev={ev} />

      {error && (
        <div className={`mb-6 rounded-lg border border-[var(--cx-red)]/40 bg-[var(--cx-red)]/5 px-4 py-3 ${mono} text-xs text-[var(--cx-red)]`}>
          EV computation failed — {error}
        </div>
      )}
      {!error && !ev && (
        <div className={`mb-6 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-3 ${mono} text-xs text-[var(--cx-text-dim)]`}>
          No machine snapshot for &quot;{pack}&quot; yet — the gacha ingestion cron hasn&apos;t seen it.
        </div>
      )}

      {ev && (
        <>
          <EvLadder ev={ev} />
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <OddsPanel ev={ev} />
            <CoveragePanel ev={ev} />
          </div>
          <ChaseCards ev={ev} />
          <Caveats ev={ev} />
          <ApiFooter />
        </>
      )}
    </div>
  );
}

function Header({ pack, ev }: { pack: string; ev: PackEv | null }) {
  return (
    <div className="mb-6">
      <div className={`${mono} text-xs uppercase tracking-widest text-[var(--cx-text-dim)]`}>
        Jupiter Gacha / Collector Crypt — independent pack EV
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold text-[var(--cx-text)]">
          {ev?.machine.name ?? pack}
        </h1>
        <span className={`${mono} text-sm text-[var(--cx-amber)]`}>
          ${ev?.machine.price_usd ?? "—"}/pack
        </span>
        {ev && (
          <span className={`${mono} text-xs text-[var(--cx-text-muted)]`}>
            pool as of {new Date(ev.machine.snapshot_at).toUTCString().replace("GMT", "UTC")}
          </span>
        )}
      </div>
    </div>
  );
}

function pctColor(pct: number | null): string {
  if (pct == null) return "text-[var(--cx-text-muted)]";
  return pct >= 0 ? "text-[var(--cx-green)]" : "text-[var(--cx-red)]";
}

function fmtPct(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function EvLadder({ ev }: { ev: PackEv }) {
  const rows: Array<{
    label: string;
    sub: string;
    value: number | null;
    pct: number | null;
    accent?: boolean;
  }> = [
    {
      label: "Platform EV",
      sub: "their number — expected insured value",
      value: ev.ev.platform_insured.value_usd,
      pct: ev.ev.platform_insured.vs_price_pct,
    },
    {
      label: "Observed EV",
      sub: `insured value across ${ev.ev.observed_insured.n_pulls} real pulls${ev.ev.observed_insured.ci95_usd != null ? ` (±$${ev.ev.observed_insured.ci95_usd} @95%)` : ""}`,
      value: ev.ev.observed_insured.value_usd,
      pct: ev.ev.observed_insured.vs_price_pct,
    },
    {
      label: "Buyback floor",
      sub: `guaranteed exit — ${ev.machine.instant_buyback_pct ?? "?"}% instant buyback`,
      value: ev.ev.buyback_floor.value_usd,
      pct: ev.ev.buyback_floor.vs_price_pct,
    },
    {
      label: "Realizable EV",
      sub: "fee-netted best exit per pull (buyback vs secondary)",
      value: ev.ev.realizable.value_usd,
      pct: ev.ev.realizable.vs_price_pct,
      accent: true,
    },
  ];

  const gap =
    ev.ev.platform_insured.vs_price_pct != null && ev.ev.realizable.vs_price_pct != null
      ? ev.ev.platform_insured.vs_price_pct - ev.ev.realizable.vs_price_pct
      : null;

  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`${mono} text-xs uppercase tracking-widest text-[var(--cx-text-dim)]`}>
          The EV ladder — headline vs spendable
        </h2>
        {gap != null && (
          <span className={`${mono} text-xs text-[var(--cx-amber)]`}>
            headline-to-realizable gap: {gap.toFixed(1)} pts
          </span>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 ${
              r.accent ? "border border-[var(--cx-amber)]/30 bg-[var(--cx-surface-2)]" : ""
            }`}
          >
            <div>
              <div className="text-sm font-semibold text-[var(--cx-text)]">{r.label}</div>
              <div className={`${mono} text-[11px] text-[var(--cx-text-dim)]`}>{r.sub}</div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className={`${mono} text-sm text-[var(--cx-text)]`}>
                {r.value != null ? `$${r.value.toFixed(2)}` : "—"}
              </span>
              <span className={`${mono} text-lg font-bold ${pctColor(r.pct)}`}>{fmtPct(r.pct)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OddsPanel({ ev }: { ev: PackEv }) {
  const stated = ev.observed_vs_stated.tier_odds_stated ?? {};
  const observed = ev.observed_vs_stated.tier_shares_observed ?? {};
  const tiers = ["epic", "rare", "uncommon", "common"];
  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] p-5">
      <h2 className={`${mono} text-xs uppercase tracking-widest text-[var(--cx-text-dim)]`}>
        Stated odds vs observed pulls
      </h2>
      <table className={`mt-3 w-full ${mono} text-xs`}>
        <thead>
          <tr className="text-left text-[var(--cx-text-muted)]">
            <th className="py-1 font-normal">tier</th>
            <th className="py-1 font-normal">stated</th>
            <th className="py-1 font-normal">observed (n={ev.observed_vs_stated.n_pulls})</th>
            <th className="py-1 font-normal">stock</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t} className="border-t border-[var(--cx-border)]">
              <td className="py-1.5 capitalize text-[var(--cx-text)]">{t}</td>
              <td className="py-1.5 text-[var(--cx-text-dim)]">
                {stated[t] != null ? `${(stated[t] * 100).toFixed(1)}%` : "—"}
              </td>
              <td className="py-1.5 text-[var(--cx-cyan)]">
                {observed[t] != null ? `${(observed[t] * 100).toFixed(1)}%` : "0.0%"}
              </td>
              <td className="py-1.5 text-[var(--cx-text-dim)]">{ev.machine.stock?.[t] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`${mono} mt-3 text-[11px] leading-relaxed text-[var(--cx-text-muted)]`}>
        Observed shares converge on stated odds as the pull sample grows; a persistent gap is
        a red flag we&apos;d surface here.
        {ev.jupiter_share_of_pulls != null &&
          ` ${(ev.jupiter_share_of_pulls * 100).toFixed(0)}% of observed pulls came through the Jupiter frontend.`}
      </p>
    </div>
  );
}

function CoveragePanel({ ev }: { ev: PackEv }) {
  const tiers = ["epic", "rare", "uncommon", "common"];
  return (
    <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] p-5">
      <h2 className={`${mono} text-xs uppercase tracking-widest text-[var(--cx-text-dim)]`}>
        Independent-pricing coverage
      </h2>
      <table className={`mt-3 w-full ${mono} text-xs`}>
        <thead>
          <tr className="text-left text-[var(--cx-text-muted)]">
            <th className="py-1 font-normal">tier</th>
            <th className="py-1 font-normal">pool resolved to catalog</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => {
            const pct = ev.paper_truth.pool_resolved_pct[t];
            return (
              <tr key={t} className="border-t border-[var(--cx-border)]">
                <td className="py-1.5 capitalize text-[var(--cx-text)]">{t}</td>
                <td className="py-1.5">
                  <span className="text-[var(--cx-text)]">
                    {pct != null ? `${(pct * 100).toFixed(0)}%` : "—"}
                  </span>
                  <span className="ml-2 inline-block h-1.5 w-24 rounded bg-[var(--cx-surface-3)] align-middle">
                    <span
                      className="block h-1.5 rounded bg-[var(--cx-amber)]"
                      style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={`${mono} mt-3 text-[11px] leading-relaxed text-[var(--cx-text-muted)]`}>
        Unresolved cards (mostly Japanese-language stock and sets not yet in the English
        catalog) fall back to platform insured values in the EV math. Graded paper comps:{" "}
        {ev.paper_truth.status === "unavailable"
          ? "pending ingestion"
          : `${(ev.paper_truth.graded_priced_pulls_pct * 100).toFixed(0)}% of pulls`}
        .
      </p>
    </div>
  );
}

function ChaseCards({ ev }: { ev: PackEv }) {
  if (ev.chase_cards.length === 0) return null;
  return (
    <div className="mt-6 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] p-5">
      <h2 className={`${mono} text-xs uppercase tracking-widest text-[var(--cx-text-dim)]`}>
        Chase cards in the visible pool (epic tier, by insured value)
      </h2>
      <div className="mt-3 space-y-1">
        {ev.chase_cards.map((c, i) => (
          <div
            key={i}
            className={`flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cx-border)] py-1.5 ${mono} text-xs`}
          >
            <span className="text-[var(--cx-text)]">{c.name ?? "—"}</span>
            <span className="flex items-center gap-3">
              {c.paper?.median_usd != null && (
                <span className="text-[var(--cx-cyan)]">
                  paper ${c.paper.median_usd.toFixed(0)}
                  <span className="text-[var(--cx-text-muted)]"> ({c.paper.condition_basis})</span>
                </span>
              )}
              <span className="text-[var(--cx-amber)]">
                insured ${c.insured_value_usd?.toFixed(0) ?? "—"}
              </span>
              {!c.resolved && <span className="text-[var(--cx-text-muted)]">unmatched</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Caveats({ ev }: { ev: PackEv }) {
  return (
    <div className="mt-6 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] p-5">
      <h2 className={`${mono} text-xs uppercase tracking-widest text-[var(--cx-text-dim)]`}>
        Honesty rail
      </h2>
      <ul className={`${mono} mt-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-[var(--cx-text-dim)]`}>
        {ev.caveats.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
        <li>
          This is transparency tooling, not an inducement to spend. Gacha packs are
          randomized purchases; an honest engine will often say a pack is −EV.
        </li>
      </ul>
    </div>
  );
}

function ApiFooter() {
  return (
    <div className={`mt-6 mb-10 rounded-lg border border-[var(--cx-border-bright)] bg-[var(--cx-surface-2)] p-5 ${mono} text-xs`}>
      <div className="text-[var(--cx-text-dim)]">
        Agents get this exact payload per-query via x402:
      </div>
      <div className="mt-2 text-[var(--cx-green)]">
        GET https://cardex.up.railway.app/api/v1/gacha/ev?pack=pokemon_50
        <span className="text-[var(--cx-text-muted)]"> — $0.001 USDC (Solana)</span>
      </div>
      <div className="mt-2 text-[var(--cx-text-muted)]">
        Data refresh: machine odds/stock ~30 min · pull feed ~2-3 min ·{" "}
        <Link href="/demo" className="text-[var(--cx-amber)] hover:underline">
          more CardEx endpoints
        </Link>
      </div>
    </div>
  );
}
