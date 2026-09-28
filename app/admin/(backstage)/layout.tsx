import Link from "next/link";
import { requireBackstage } from "@/lib/adminAuth";
import { BackstageLogoutButton } from "@/components/admin/BackstageControls";

export const metadata = { title: "Backstage — Myble", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Each icon is one or two SVG path `d` strings — the settings gear needs a
// second path (its centre hole) so it renders as a real cog rather than a
// single unclosed outline.
const NAV: { href: string; label: string; icon: string[] }[] = [
  { href: "/admin", label: "Dashboard", icon: ["M3 12l9-8 9 8M5 10v9h5v-5h4v5h5v-9"] },
  { href: "/admin/orders", label: "Orders", icon: ["M6 7V6a6 6 0 1 1 12 0v1h2l1 14H3L4 7h2Zm2 0h8V6a4 4 0 0 0-8 0v1Z"] },
  { href: "/admin/newsletter", label: "Newsletter", icon: ["M3 6h18v12H3V6Zm0 1 9 6 9-6"] },
  { href: "/admin/messages", label: "Messages", icon: ["M4 5h16v11H8l-4 4V5Z"] },
  { href: "/admin/designs", label: "Designs", icon: ["M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"] },
  { href: "/admin/users", label: "Users", icon: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 20a8 8 0 0 1 16 0"] },
  { href: "/admin/analytics", label: "Analytics", icon: ["M4 20V10m5.5 10V4M15 20v-7m5 7V8"] },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: [
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    ],
  },
];

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  const gate = await requireBackstage();

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-zinc-950 text-zinc-300">
        {/* The logo behaves like a logo anywhere else: back to the dashboard,
            with fresh numbers. A plain <a> rather than <Link> on purpose — it
            forces a real navigation, so it also reloads when you are already
            standing on the dashboard, which is exactly when you click it. */}
        <a
          href="/admin"
          aria-label="Myble Backstage — dashboard"
          className="mx-3 flex items-center gap-2.5 rounded-xl px-3 py-4 transition hover:bg-zinc-800/70"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 10h16M4 15h16" strokeLinecap="round" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Myble</p>
            <p className="text-[11px] uppercase tracking-widest text-indigo-400">Backstage</p>
          </div>
        </a>

        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                {item.icon.map((d) => (
                  <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 border-t border-zinc-800 px-4 py-4">
          <p className="truncate px-3 pb-1 text-xs text-zinc-500" title={gate.email ?? undefined}>
            {gate.email}
          </p>
          <Link href="/" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
            ← View site
          </Link>
          <BackstageLogoutButton />
        </div>
      </aside>

      <main className="ml-60 flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
