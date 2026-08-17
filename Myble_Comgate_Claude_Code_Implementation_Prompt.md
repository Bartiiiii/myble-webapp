# Claude Code — Comgate payment integration, wiring pass

Paste this into Claude Code with the repo root at `myble-webapp/myble-webapp-project`.

---

## Context

The Comgate payment layer is **already written and committed**. `tsc --noEmit` and `eslint` are clean. Do not rewrite it. Your job is the wiring pass: connect the existing checkout to it, fix two pre-existing defects that the payment flow makes dangerous, and add the admin surfaces.

Read these first — they are the contract you are wiring into:

- `lib/comgate/config.ts` — knobs, `CAPTURE_MODE`, minor-unit helpers
- `lib/comgate/client.ts` — typed Comgate API client
- `lib/payments.ts` — the **only** module allowed to mutate payment state
- `lib/backstagePayments.ts` — admin reads
- `supabase/migrations/0006_payments.sql` — schema
- `app/api/payment/{create,notify,return}/route.ts`
- `app/api/admin/payments/[id]/route.ts`, `app/api/admin/orders/[id]/review/route.ts`
- `app/admin/(backstage)/payments/page.tsx`, `components/admin/PaymentActions.tsx`
- `COMGATE_INTEGRATION_SPEC.md` — the full spec; §7 is your task list

### Non-negotiable invariants

1. **Never trust a client-supplied price.** `/api/payment/create` takes only an order number and re-runs `quoteDesign()` server-side. Do not add an `amount` parameter to any endpoint.
2. **Never trust the webhook payload.** Comgate does not sign notifications. `syncPaymentByTransId()` re-fetches from the status API. Do not "optimise" this away.
3. **Idempotency lives in `lib/payments.ts`.** Do not add state transitions anywhere else.
4. **Money is in minor units (haléře), always integers.** No floats in the money path.
5. Match the existing house style: `// ─────` section banners, comments that explain *why*, `formatCzk`/`formatDate`/`Kpi`/`Section` from `components/admin/ui.tsx`, Tailwind v4 with indigo-600 on white/zinc.

---

## Task 1 — Server-generate the order number (LAUNCH BLOCKER)

`app/order/page.tsx:89` currently does:

```ts
const orderNo = `MB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
```

Four random digits generated in the browser. ~50% collision probability by ~110 orders, and `orders.order_no` is `unique` — so the insert fails and the customer loses the order. It is now also the Comgate `refId`.

**Do:**
- Move generation into `app/api/order/route.ts`. Use a Postgres sequence, or `MB-{year}-{6 lowercase base36 chars from gen_random_uuid()}`. Keep it **≤ 16 characters** — that is Comgate's hard limit on `label`.
- Have `/api/order` return `{ ok: true, orderNo }`.
- Remove client-side generation; the client uses the returned value.
- The consent record (`consent.orderNo`) must carry the same server-issued number.
- Add a migration `0007_order_no_sequence.sql` if you use a sequence.

## Task 2 — Rewire the checkout submit

`app/order/page.tsx` around line 173 currently fire-and-forgets the order POST and immediately redirects. Replace with a sequential, awaited flow:

1. `await` POST `/api/order` → read `orderNo` from the response. On failure, show an error and **do not** redirect.
2. `await` POST `/api/payment/create` with `{ orderNo, displayedTotalCzk: <the total the UI is showing> }`.
3. On `{ ok: true, redirect }` → `window.location.assign(redirect)` (external URL — **not** `router.push`).
4. On `{ ok: false, error: "price_changed" }` → tell the customer the price changed and ask them to reload. This means the client and server disagreed on the quote; it is a real condition, not a generic failure.
5. Any other failure → generic error, order already persisted, offer retry.

Add a `submitting` state so the Pay button is disabled during the flow. Add i18n keys to `lib/i18n.tsx` (EN block ~line 431, CZ block ~line 870) — Czech and English, matching the existing `checkout.*` naming.

## Task 3 — Confirmation page states

`app/order/confirmation/page.tsx` — read `?payment=` and render three states in both locales:

- `paid` — order confirmed; we are reviewing your design; you will hear from us
- `pending` — **explicitly not a failure.** Bank transfers can sit pending for hours. "Your order is placed, we're waiting for your bank."
- `cancelled` — payment not completed, with a retry link

Keep the existing B5 durable-medium copy intact — it is a legal requirement, not decoration.

## Task 4 — Admin surfaces

- `app/admin/(backstage)/layout.tsx` — add `{ href: "/admin/payments", label: "Payments" }` to the nav.
- `app/admin/(backstage)/orders/[id]/page.tsx` — add a Payments panel using `fetchPaymentsForOrder(order.id)` (method, amount, status, transId, refunded, settlement) and render `<ReviewActions orderId={order.id} reviewState={order.review_state} paymentStatus={order.payment_status} />`.
- `lib/backstageData.ts` — extend `OrderRow` with `payment_status`, `paid_at`, `payment_method`, `review_state`, `reviewed_at`, `review_note`. Add a payment-status column to the orders table view.
- `app/api/admin/export/route.ts` — add a `what=payments` export.

## Task 5 — Paid-order confirmation email

`app/api/payment/notify/route.ts` has a `TODO(Barti)` inside the `newlyPaid` branch. Add `sendPaymentConfirmationEmail()` to `lib/email.ts` following the existing `sendOrderConfirmationEmail` pattern (Resend, CZ + EN).

**It must be called only inside the `newlyPaid` guard.** Comgate retries a failed push up to 1 000 times; an email outside that guard sends 1 000 times.

## Task 6 — Analytics

PostHog is already wired (`lib/posthog-server.ts`, `lib/posthogClient.ts`). Capture:

- `payment_started` — `{ orderNo, amountCzk }`
- `payment_completed` — `{ orderNo, amountCzk, method }` (server-side, in the `newlyPaid` branch)
- `payment_failed` — `{ orderNo, reason }`
- `checkout_abandoned` — payment created but never completed

The `method` property is the point of the whole exercise: it measures the real Czech method mix, which is the assumption the provider choice rests on.

## Task 7 — Tests

Vitest is configured. Add `lib/payments.test.ts` covering, with the Comgate client mocked:

- `authoritativePrice()` returns the same total as `quoteDesign()`
- `assertPriceMatches()` throws on any mismatch
- `mapComgateStatus()` — `AUTHORIZED` → `paid` in immediate mode, `authorized` in pre-auth mode
- `verifyPushSecret()` — accepts the correct secret, rejects wrong secret, wrong length, empty, undefined
- Replaying the same PAID status is a no-op the second time (`changed === false`)
- A terminal payment never transitions again
- Refund exceeding the outstanding balance throws **before** any network call

Also add `toMinorUnits(2490) === 249000` — trivially, because getting it wrong charges 100×.

## Task 8 — Config

- `.env.example` (create it; the repo has none) with the six Comgate/site vars, documented, no real values.
- `vercel.json` — `{ "crons": [{ "path": "/api/cron/comgate-settlements", "schedule": "0 6 * * *" }] }`
- Rename one of the duplicate `0003_` migrations.

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint` clean
- [ ] `npx vitest run` green
- [ ] Order numbers server-generated, ≤16 chars, collision-safe
- [ ] Checkout redirects to Comgate; the three return states render in CZ and EN
- [ ] `/admin/payments` reachable from the nav and renders with zero payments
- [ ] Approve/Reject visible on order detail; Reject on a paid order triggers a refund
- [ ] Test matrix rows 5, 7, 8 and 9 from the spec pass by hand in `COMGATE_TEST=1`

## Do not

- Do not add a `server-only` import — the package is not installed; the repo uses comment convention (see `utils/supabase/admin.ts`).
- Do not add an npm Comgate SDK. The hand-rolled client is deliberate; the npm packages are unmaintained community forks.
- Do not put `COMGATE_SECRET` in any `NEXT_PUBLIC_*` variable, or import `lib/comgate/client.ts` or `lib/payments.ts` into a client component.
- Do not change `lib/pricing.ts` — it is the verified meble.pl cost engine.
- Do not touch `lib/rules-engine/` in this pass.
- Do not enable deferred payment or instalments yet — that is a gate decision, not a launch one.
```
