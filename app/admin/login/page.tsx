import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBackstageGate } from "@/lib/adminAuth";
import { BackstageLoginForm } from "@/components/admin/BackstageControls";

export const metadata = { title: "Backstage — Myble", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Second gate of the backstage: reachable only by the owner's Google session
// (everyone else 404s), then asks for the single backstage account.
export default async function BackstageLoginPage() {
  const gate = await getBackstageGate();
  if (!gate.googleOk) notFound();
  if (gate.backstageOk) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 10h16M4 15h16" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight text-white">Myble Backstage</p>
            <p className="text-xs text-zinc-400">{gate.email}</p>
          </div>
        </div>

        <section className="mt-6 rounded-3xl bg-white p-7 shadow-2xl">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">One more key</h1>
          <p className="mt-1.5 text-sm text-zinc-600">
            Google checked out. Enter the backstage account to open the panel.
          </p>
          <div className="mt-6">
            <BackstageLoginForm />
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Session lasts 12 hours · <Link href="/" className="underline hover:text-zinc-300">back to site</Link>
        </p>
      </div>
    </main>
  );
}
