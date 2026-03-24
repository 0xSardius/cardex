import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--cx-black)] text-[var(--cx-text)]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--cx-border)] bg-[var(--cx-black)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-geist-mono)] text-sm font-bold tracking-wider text-[var(--cx-amber)]"
            >
              CARDEX
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              <NavLink href="/search">Search</NavLink>
              <NavLink href="/arbitrage">Arbitrage</NavLink>
              <NavLink href="/mtgo-spread">MTGO Spread</NavLink>
            </div>
          </div>
          <div className="flex items-center gap-3 font-[family-name:var(--font-geist-mono)] text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--cx-green)] animate-pulse" />
              <span className="text-[var(--cx-green-dim)] hidden sm:inline">LIVE</span>
            </span>
            <span className="text-[var(--cx-text-muted)]">MTG</span>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex sm:hidden border-t border-[var(--cx-border)] px-4 py-2 gap-1">
          <NavLink href="/search">Search</NavLink>
          <NavLink href="/arbitrage">Arbitrage</NavLink>
          <NavLink href="/mtgo-spread">MTGO</NavLink>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 pt-20 sm:pt-16 pb-16">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-xs text-[var(--cx-text-dim)] transition-colors hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text)]"
    >
      {children}
    </Link>
  );
}
