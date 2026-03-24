import { searchCards } from "./actions";
import Link from "next/link";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = q ? await searchCards(q) : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold">
          Card Search
        </h1>
        <p className="mt-1 text-sm text-[var(--cx-text-dim)]">
          Search 90K+ MTG cards with fuzzy matching
        </p>
      </div>

      {/* Search form */}
      <form action="/search" method="GET" className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by card name..."
            autoFocus
            className="flex-1 rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2.5 font-[family-name:var(--font-geist-mono)] text-sm text-[var(--cx-text)] placeholder:text-[var(--cx-text-muted)] outline-none focus:border-[var(--cx-amber-dim)] transition-colors"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--cx-amber)]/10 px-5 py-2.5 font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-amber)] transition-colors hover:bg-[var(--cx-amber)]/20"
          >
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      {q && results.length === 0 && (
        <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-6 text-center">
          <p className="text-[var(--cx-text-dim)]">
            No results for &ldquo;{q}&rdquo;
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          <div className="mb-3 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
          </div>

          {results.map((card) => (
            <Link
              key={card.id}
              href={`/card/${card.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 px-4 py-3 transition-all hover:border-[var(--cx-border-bright)] hover:bg-[var(--cx-surface)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--cx-text)] truncate">
                      {card.name}
                    </span>
                    {card.reserved && (
                      <span className="shrink-0 rounded bg-[var(--cx-amber)]/15 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold text-[var(--cx-amber)]">
                        RL
                      </span>
                    )}
                    {card.foil && (
                      <span className="shrink-0 rounded bg-[var(--cx-purple)]/15 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-bold text-[var(--cx-purple)]">
                        FOIL
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
                    <span>{card.setName}</span>
                    {card.setCode && (
                      <span className="uppercase">[{card.setCode}]</span>
                    )}
                    {card.rarity && <span className="capitalize">{card.rarity}</span>}
                    {card.treatment && card.treatment !== "regular" && (
                      <span className="capitalize text-[var(--cx-cyan)]">{card.treatment}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                {card.priceUsd ? (
                  <span className="font-[family-name:var(--font-geist-mono)] text-sm font-bold text-[var(--cx-green)]">
                    ${parseFloat(card.priceUsd).toFixed(2)}
                  </span>
                ) : (
                  <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)]">
                    —
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!q && (
        <div className="rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface)]/50 p-8 text-center">
          <p className="text-[var(--cx-text-dim)]">
            Try searching for a card name
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {["Black Lotus", "Lightning Bolt", "Ragavan", "Force of Will", "Sheoldred"].map((name) => (
              <Link
                key={name}
                href={`/search?q=${encodeURIComponent(name)}`}
                className="rounded border border-[var(--cx-border)] px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-muted)] transition-colors hover:border-[var(--cx-border-bright)] hover:text-[var(--cx-text)]"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
