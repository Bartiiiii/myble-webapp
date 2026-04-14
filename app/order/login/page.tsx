"use client";

import Link from "next/link";

export default function OrderLoginPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {/* Brand row */}
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

        {/* Page header */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm font-medium text-indigo-600">Order flow</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Sign in to continue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Log in to save your design, continue to checkout, and track your order.
          </p>
        </div>

        {/* Main content */}
        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Login card */}
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
            <div className="mx-auto max-w-md">
              <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Continue with your account or choose a faster option below.
              </p>

              <form className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-sm">
                  <label className="flex items-center gap-2 text-zinc-600">
                    <input type="checkbox" className="rounded border-zinc-300" />
                    Remember me
                  </label>

                  <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Forgot password?
                  </a>
                </div>

                <Link
                  href="/order"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Continue to checkout
                </Link>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  or
                </span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>

              <button className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.1 0 10.1-4.3 10.1-10.3 0-.7-.1-1.2-.2-1.7H12Z"
                  />
                </svg>
                Quick login with Google
              </button>

              <div className="mt-6 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <p className="text-sm text-zinc-600">
                  Don’t have an account yet?
                </p>
                <button className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500">
                  Create account
                </button>
              </div>
            </div>
          </section>

          {/* Side info card */}
          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h3 className="text-lg font-semibold">Why create an account?</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              <li>• Save your furniture design</li>
              <li>• Continue checkout faster</li>
              <li>• Access order updates later</li>
              <li>• Manage future projects in one place</li>
            </ul>

            <div className="mt-6 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <p className="text-sm font-medium text-zinc-800">
                Your current design will stay attached to this session until you continue.
              </p>
            </div>
          </aside>
        </div>

        {/* Guest card */}
        <div className="mx-auto mt-6 w-full max-w-5xl">
          <div className="rounded-3xl bg-zinc-100 p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Continue as a guest</p>
                <p className="mt-1 text-sm text-zinc-600">
                  You can skip account creation for now and go straight to the next step.
                </p>
              </div>

              <Link
                href="/order"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-300 transition hover:bg-zinc-50"
              >
                Continue as guest
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
