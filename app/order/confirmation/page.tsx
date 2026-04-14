"use client";

import Link from "next/link";

export default function OrderConfirmationPage() {
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

        <div className="mx-auto grid w-full max-w-5xl gap-6">
          {/* Main confirmation card */}
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 sm:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <p className="mt-6 text-sm font-medium text-emerald-600">
                Order confirmed
              </p>

              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
                Your order is in.
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                Thanks for choosing Myble. We’ve received your custom furniture order and
                your production request is now being processed.
              </p>

              <div className="mt-8 rounded-2xl bg-zinc-50 p-5 text-left ring-1 ring-zinc-200">
                <h2 className="text-sm font-semibold text-zinc-900">What happens next</h2>
                <div className="mt-4 space-y-3 text-sm text-zinc-600">
                  <p>• A confirmation email with your order details is on its way.</p>
                  <p>• We’ll send you updates as your furniture moves through production.</p>
                  <p>• Your assembly instructions will be delivered by email as part of your order package.</p>
                  <p>• Once your order is shipped, you’ll receive delivery information and next steps.</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Back to homepage
                </Link>

                <Link
                  href="/design"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
                >
                  Create another design
                </Link>
              </div>
            </div>
          </section>

          {/* Extra info cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <p className="text-sm font-medium text-indigo-600">Order support</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Need to make a change?
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                If you need to update your delivery details or have a question about your
                order, contact support as soon as possible and we’ll do our best to help
                before production progresses further.
              </p>
              <a
                href="mailto:hello@my-ble.eu"
                className="mt-5 inline-flex items-center justify-center rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                Contact support
              </a>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <p className="text-sm font-medium text-indigo-600">Your order includes</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Everything you need to build it
              </h2>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>• Custom-cut furniture parts</p>
                <p>• Necessary fittings and connectors</p>
                <p>• Assembly instructions</p>
                <p>• Delivery to your address</p>
              </div>
              <p className="mt-5 text-sm leading-6 text-zinc-600">
                We’ve designed the process to be straightforward, so you can go from idea
                to finished furniture with confidence.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}