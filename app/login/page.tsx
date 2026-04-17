"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const { status } = useSession();
  const callbackUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("callbackUrl") || "/"
      : "/";
  const isLoading = status === "loading";
  const isSignedIn = status === "authenticated";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-700" fill="currentColor">
                <path d="M3 12c3-6 8-9 14-9 2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2zm0 8.8C6 14.8 11 12 17 12c2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Myble</span>
          </Link>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm font-medium text-indigo-600">Account</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Use your Google account to sign in. You will stay signed in on this device until you sign out.
          </p>
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
            <div className="mx-auto max-w-md">
              <h2 className="text-2xl font-semibold tracking-tight">Welcome</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Sign in with Google to access your Myble account on this site.
              </p>

              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl })}
                disabled={isLoading || isSignedIn}
                className="mt-8 inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.58-5.05-3.7H.96v2.33A9 9 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.95 10.72A5.41 5.41 0 0 1 3.66 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l2.99-2.33z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.56-2.56C13.46.95 11.43 0 9 0A9 9 0 0 0 .96 4.95l2.99 2.33c.71-2.12 2.7-3.7 5.05-3.7z"
                  />
                </svg>
                {isLoading
                  ? "Checking session..."
                  : isSignedIn
                    ? "Already signed in"
                    : "Sign in with Google"}
              </button>

              {isSignedIn ? (
                <Link
                  href={callbackUrl}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Continue
                </Link>
              ) : null}

              <div className="mt-6 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <p className="text-sm text-zinc-600">
                  We use Google only to verify your identity. We do not post on your behalf.
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h3 className="text-lg font-semibold">Why sign in?</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              <li>• Save and return to your designs</li>
              <li>• Smoother checkout when you order</li>
              <li>• Order updates in one place</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
