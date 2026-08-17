import { requireAccount } from "@/lib/accountAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AccountTabs } from "@/components/account/AccountTabs";

export const metadata = { title: "My Account — Myble", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// One auth gate for the whole /account/* tree (Next.js runs a layout once per
// request regardless of which nested page matches, so gating here is
// sufficient — no per-page redirect needed). Unlike backstage, this wraps the
// normal SiteHeader/SiteFooter rather than a separate dark app shell: the
// user asked for something simpler than admin, and a top tab bar rather than
// a sidebar, so it should read as part of the public site, not a tool.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireAccount();

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <SiteHeader variant="app" />
      <div className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-6">
          <AccountTabs />
        </div>
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
