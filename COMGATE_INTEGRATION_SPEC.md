# Myble × Comgate — integration spec

**Version 1.0 · 16 August 2026 · written against the live repo at `myble-webapp/myble-webapp-project`**

Status: the payment layer described here is **written, committed to the repo and passing `tsc --noEmit` and `eslint`**. What remains is the wiring into three existing files, the Supabase migration, and the Comgate account itself. All of that is in §7 and §8.

---

## 1. Is the Comgate API any good?

Short answer: **yes, with one significant caveat and one annoyance.**

### What's good

| | |
|---|---|
| **Auth** | HTTP Basic (`merchant:secret`, base64). Boring, correct, no OAuth dance, no token refresh. |
| **Shape** | Flat JSON over HTTPS, one resource per endpoint, `code: 0` means OK. Zero cleverness. Easy to wrap, easy to debug from `curl`. |
| **Docs** | `apidoc.comgate.cz` is complete and has a Postman collection. Every parameter is documented with type and constraint. |
| **Errors** | Numeric codes with stable meanings (1400 bad request, 1402 refund exceeds limit…). You can branch on them. |
| **Test mode** | A `test` boolean on payment creation. Fully functional gateway, no money moves. No separate sandbox credentials to manage. |
| **Retries** | Push notifications retry up to 1 000 times until you return 2xx, then email you. That's a genuinely good failure mode — a database blip doesn't lose a payment. |

### The caveat — webhooks are not signed

**Comgate does not sign push notifications.** No HMAC, no signature header. Instead it echoes your API secret back in the payload body, and the docs tell you to verify by calling the status API.

Stripe signs every webhook with an HMAC and a timestamp. Comgate does not. This is objectively weaker, and it dictates the architecture:

- We compare the echoed `secret` in **constant time** (`timingSafeEqual`) — a naive `===` leaks timing information.
- We then **throw the payload away** and call `GET /payment/transId/{id}.json` for the authoritative state.
- We additionally check that the amount Comgate reports equals the amount we asked for, and refuse to mark a payment paid if it doesn't.

This is implemented in `lib/payments.ts` (`verifyPushSecret`, `syncPaymentByTransId`). It is not optional and it is not paranoia — it's the documented correct usage.

Optional hardening: Comgate publishes its egress IPs at `https://payments.comgate.cz/ips-v4`. You can whitelist them in the portal. Worth doing before you're processing real volume, not before launch.

### The annoyance — no first-party TypeScript SDK

Comgate's only official SDK is PHP (`comgate-payments/sdk-php`, actively maintained, v1.9.2 April 2026). The npm packages (`@comgate/checkout`, `comgate-node`) are community-maintained.

**Decision: we hand-rolled a typed client** (`lib/comgate/client.ts`, ~200 lines). Rationale: the surface we need is nine endpoints of flat JSON with Basic auth. A small client we control beats an unmaintained dependency we don't, and it costs about a day. The client includes retry-with-backoff on 5xx/timeouts, a 15-second timeout, and never retries a business-level rejection.

### Honest comparison

If you were building on Stripe, the integration would be perhaps 12 hours instead of ~28, and webhooks would be cryptographically signed. That's real. But — as the provider analysis established — Stripe cannot put a Czech bank button at your checkout, and roughly a third of Czech e-commerce runs on bank rails. The API quality gap is worth about 15 founder-hours once. The method-coverage gap is worth roughly 14 000 Kč a month at your Scale scenario, forever.

---

## 2. What Comgate can actually do

Everything below is available on your merchant account. Grouped by whether it matters to Myble now.

### Using at launch

- **Card payments** — Visa, Visa Electron, Mastercard, Maestro, in 9 currencies (CZK, EUR, PLN, HUF, USD, GBP, RON, NOK, SEK).
- **Czech bank buttons (PSD2)** — the whole reason we chose Comgate. All major CZ banks.
- **Apple Pay / Google Pay** — appear automatically inside the hosted gateway once card methods are enabled. **No domain association file, no merchant registration, no client-side SDK.** This is genuinely easier than Stripe. (You only need the Checkout SDK if you want the buttons on your own page rather than on the gateway — you don't, at launch.)
- **QR payments** — Czech QR platba standard, free.
- **Hosted gateway** — Comgate renders the method picker, handles 3DS, localises to 26 languages. Zero PCI scope for you.
- **Partial refunds** — essential given the defects-only policy. One damaged panel in a five-panel kit is a partial refund, and that's the common case.
- **Settlement API** — `transferList` / `singleTransfer` / CSV / ABO export. This is what makes the reconciliation job in §5 possible, and it's better than most gateways expose.

### Available, deliberately not used yet

- **Deferred payment + instalments** — Twisto / Skip Pay / three-instalment. On the Profi tariff these cost 0–1.9%, versus 4.99% for Klarna through a global platform. Switch on at the 60-orders gate as a portal config change; no code change beyond leaving `COMGATE_METHOD = "ALL"`.
- **Pre-authorization** — see §3.
- **Recurring payments** — irrelevant to Myble; you sell one-off kits.
- **BLIK + PLN settlement** — the Poland path. Config change when you get there, not a new integration.
- **`/method.json`** — returns live method ids, localised names and logo URLs. Only needed if you ever build an in-page method picker instead of the hosted gateway.
- **`/config.json`** — set gateway branding (logo, background, colours, footer), notification URL and IP whitelist programmatically. Worth using to brand the gateway in Myble indigo.

### Not available

- No native marketplace / split-payout (that's PayU or Stripe Connect territory — only relevant if you onboard third-party carpenters).
- No built-in fraud engine comparable to Stripe Radar. For a made-to-measure furniture shop at your volume this is fine; 3DS does the heavy lifting.

---

## 3. Capture model — answering your question directly

You asked: *"we will have to check first if the design from the user makes sense, so maybe when we accept the design, we would CAPTURE the money, and if we don't accept, the money simply won't be captured?"*

That instinct is right, and the mechanism you're describing (pre-authorization) is real and supported. **But I recommend against using it, for three specific reasons — while building the code so you can switch in one line if I'm wrong.**

### Why not pre-auth

**1. It only works for cards.** Czech bank buttons cannot be pre-authorized. Neither can BNPL. Only cards, Apple Pay and Google Pay. On the expected CZ method mix that means ~28% of your orders would be captured immediately regardless, and you'd be operating two different money flows with two different admin states. For a solo founder that's a permanent complexity tax.

**2. The hold expires.** Comgate's documentation states the **minimum guaranteed block is 7 days**; longer is at the issuer's discretion and is not guaranteed. Your review would happen within a day or two, so the timing works — but if you're travelling, ill, or just busy for a week, the authorization lapses and the money is simply gone. You'd then have to ask the customer to pay again for a kit you've already approved.

**3. You already built the thing that makes rejection rare.** The rules engine — 55 evaluators, `validateConfiguratorDesign()`, server-side re-validation already wired into `app/api/order/route.ts` — exists precisely so impossible designs can't be ordered. Its current policy is explicitly sales-first ("we never reject an order on rules") with a `needsReview` flag. If the engine is doing its job, manual rejection should be a rare exception, not a routine gate. Designing the money flow around a rare event is the wrong optimisation.

### What I built instead

**Immediate capture + an explicit review gate + one-click refund on rejection.**

```
Customer pays  →  money captured  →  order status 'confirmed'
                                     review_state 'pending'
                                          ↓
                        ┌─────────────────┴─────────────────┐
                   Approve                              Reject
                        ↓                                   ↓
              status 'in_production'              full refund, automatically
              released to meble.pl                status 'cancelled'
```

The order is **never released to meble.pl on payment alone**. `review_state` starts at `pending` and production only begins when you approve. That gives you exactly the control you wanted — the difference is that the money is already in your account while you decide, and a rejection costs a 5 Kč refund fee.

`POST /api/admin/orders/[id]/review` handles both branches, and critically: **if the refund fails, the rejection is not recorded.** An order marked rejected with the customer still charged is the worst possible state, so that transaction is ordered deliberately.

### If you want pre-auth anyway

Set `COMGATE_CAPTURE_MODE=preauth`. Everything is implemented: `capturePreauth`, `cancelPreauth`, `capturePaymentById`, `releasePaymentById`, and the review route already branches on payment status. The same Approve button captures instead of doing nothing; the same Reject button releases instead of refunding.

**Revisit this decision with data.** If after 50 orders your manual rejection rate is above ~5%, pre-auth for card orders starts earning its complexity. Below that, it doesn't.

---

## 4. Architecture

```
app/order/page.tsx
   │  POST /api/order        ← already exists: persists order + rules record + consent
   │                            (must become awaited — see §7.1)
   ▼
POST /api/payment/create      ← takes ONLY an order number
   │  • loads the order from Supabase
   │  • re-runs quoteDesign(design) on the SERVER          ← price authority
   │  • inserts a payments row (status 'created')
   │  • calls Comgate POST /payment.json
   │  • stores transId + redirect, status → 'pending'
   ▼
Comgate hosted gateway        ← customer picks method, 3DS, pays
   │
   ├─── POST /api/payment/notify   (server → server, retried up to 1000×)
   │       verify secret → re-fetch status from API → transition → fulfil once
   │
   └─── GET  /api/payment/return   (browser redirect)
           same sync, then redirect to /order/confirmation?payment=paid|pending|cancelled
```

Both paths call the same `syncPaymentByTransId()`. They race; that's fine and expected. Whichever lands first wins and the second is a no-op.

### The four invariants

1. **The price is recomputed server-side, always.** The configurator lets a customer build an arbitrary product and the browser knows the price. If we charged the posted total, anyone could order a wardrobe for 1 Kč from devtools. `/api/payment/create` accepts *only* an order number and re-runs `quoteDesign()` on the stored design. The client's displayed total is passed for comparison and, on mismatch, the request fails with `price_changed` — never with a charge.

2. **State only moves forward.** `paid`, `refunded` and `cancelled` are terminal. Replaying a webhook cannot move a payment backwards or re-trigger fulfilment.

3. **Fulfilment happens once.** Side effects are guarded by `newlyPaid`, and the database enforces it independently: a partial unique index (`payments_one_paid_per_order`) makes a second successful payment on one order impossible at the storage layer.

4. **The webhook is never the source of truth.** Verify the secret, then ask the API.

### Money handling

Comgate takes **minor units** — haléře, not koruny. CZK 2 490 → `249000`. Getting this wrong charges 100× or 1/100×. Every amount in the database is an integer in minor units; `toMinorUnits` / `fromMinorUnits` are the only conversion points. There are no floats in the money path.

Also: `label` is capped at **16 characters** and is what appears on the payer's bank statement. Your order numbers (`MB-2026-1234`) are 12 characters, so they fit — but the truncation guard is there anyway.

---

## 5. What you get in the admin

You already had a fully built backstage (`app/admin/(backstage)/`, two-gate auth, orders list and detail). This extends it rather than replacing anything.

### New page: `/admin/payments`

**KPI row**
- Captured, net of refunds
- Last 30 days
- **Checkout conversion** — payment attempts that completed. The number that tells you whether the checkout is working.
- **Effective fee rate** — what Comgate actually charged, shown against the 1.80% baked into `pricingConfig.PAYMENT_FEE_PCT`. See §9.3; this is probably costing you money today.

**Payment method mix (actual)** — a bar per method with share and value. This is the most valuable thing on the page. The entire provider decision rested on Czech bank buttons being ~28% of demand. This is where that assumption meets reality, and if bank buttons land below ~10% the analysis should be re-run because the card-only platforms become competitive again.

**Payments table** — order (linked), created, method (humanised: "Bank button · CZ KB", "Apple Pay", "Deferred payment"), masked card, amount, refunded, status, settlement date, and per-row actions:
- **Re-sync from Comgate** — for when something looks stuck
- **Refund** — full or partial, with the outstanding balance shown and a confirm dialog
- **Capture / Release** — pre-auth mode only, hidden otherwise

**Settlements** — Comgate's payouts, matched to payments by variable symbol, with a running "captured but not yet settled" figure.

### On the existing order detail page

Add the payment panel and the review actions (`ReviewActions` component) — Approve → release to production, or Reject → refund customer. Wiring instructions in §7.3.

### Full audit trail

Every webhook, every status poll, every refund attempt, every error is appended to `payment_events` with the raw payload and source IP. Never redacted. **This is your dispute evidence pack** — combined with the design spec, the withdrawal-exclusion acknowledgement and the dispatch record, it's what wins a "goods not as described" chargeback on a custom item.

---

## 6. Files added

All **new files**. Nothing existing was modified.

```
lib/comgate/types.ts                              wire types, status enum, error codes
lib/comgate/config.ts                             env, knobs, CAPTURE_MODE, minor-unit helpers
lib/comgate/client.ts                             typed API client, retry, timeout
lib/payments.ts                                   domain layer — the only mutator of payment state
lib/backstagePayments.ts                          admin reads + aggregates
supabase/migrations/0006_payments.sql             payments, payment_events, payment_settlements,
                                                  orders.payment_status / review_state
app/api/payment/create/route.ts                   start a payment
app/api/payment/notify/route.ts                   Comgate url_push webhook
app/api/payment/return/route.ts                   browser return
app/api/admin/payments/[id]/route.ts              sync / refund / capture / release
app/api/admin/orders/[id]/review/route.ts         design review gate + money branch
app/api/cron/comgate-settlements/route.ts         daily reconciliation
app/admin/(backstage)/payments/page.tsx           the dashboard
components/admin/PaymentActions.tsx               PaymentActions + ReviewActions
```

Verified: `tsc --noEmit` clean, `eslint` clean, against the real repo.

---

## 7. Wiring still to do (3 existing files + config)

### 7.1 `app/order/page.tsx` — make the order call awaited, then redirect to payment

Currently (line ~173):

```ts
void fetch("/api/order", { ... });   // fire-and-forget
router.push(`/order/confirmation?order=${orderNo}`);
```

This must become: await the order POST, then create the payment, then send the browser to Comgate.

```ts
const orderRes = await fetch("/api/order", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const orderJson = await orderRes.json();
if (!orderJson.ok) { /* show error, do not redirect */ return; }

const payRes = await fetch("/api/payment/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orderNo, displayedTotalCzk: quote.total }),
});
const payJson = await payRes.json();
if (!payJson.ok) {
  if (payJson.error === "price_changed") { /* ask the customer to reload */ }
  return;
}
window.location.assign(payJson.redirect);   // not router.push — external URL
```

Needs a submitting state so the Pay button can't be double-clicked, and new i18n keys in `lib/i18n.tsx` (EN ~431, CZ ~870).

### 7.2 `app/order/confirmation/page.tsx` — read `?payment=`

Three states to render, in Czech and English:
- `paid` — order confirmed, we're reviewing your design, you'll hear from us
- `pending` — **not a failure.** Bank transfers legitimately sit pending for hours. "Your order is placed, we're waiting for your bank to confirm."
- `cancelled` — payment not completed, with a link to retry

### 7.3 `app/admin/(backstage)/orders/[id]/page.tsx` and `layout.tsx`

- Add `{ href: "/admin/payments", label: "Payments" }` to the backstage nav in `layout.tsx`.
- On the order detail page: render `fetchPaymentsForOrder(order.id)` in a panel, plus `<ReviewActions orderId={...} reviewState={...} paymentStatus={...} />`.

### 7.4 Environment

```bash
COMGATE_MERCHANT=<from portal.comgate.cz>
COMGATE_SECRET=<from portal.comgate.cz>     # server-only, never NEXT_PUBLIC_
COMGATE_TEST=1                              # remove for live money
COMGATE_CAPTURE_MODE=immediate              # or "preauth"
NEXT_PUBLIC_SITE_URL=https://myble.cz
CRON_SECRET=<random>                        # for the settlement job
```

### 7.5 Comgate portal

- Notification URL → `https://myble.cz/api/payment/notify` (https mandatory)
- Enable: cards, CZ bank buttons, Apple Pay, Google Pay. **Leave deferred/instalments off until the gate.**
- Optionally brand the gateway via `/config.json` (logo, `#4f46e5`, footer text)
- Consider IP whitelisting from `payments.comgate.cz/ips-v4`

### 7.6 `vercel.json`

```json
{ "crons": [{ "path": "/api/cron/comgate-settlements", "schedule": "0 6 * * *" }] }
```

---

## 8. Test matrix

Run every row in `COMGATE_TEST=1` before going live. Comgate's test gateway lets you force each outcome.

| # | Scenario | Expected |
|---|---|---|
| 1 | Card, success | `paid`, order `confirmed`, `review_state` `pending`, one `payment_events` row per source |
| 2 | Bank button, success | same, `method` starts `BANK_` |
| 3 | Customer cancels on the gateway | `cancelled`, order stays `unpaid`, retry works |
| 4 | 3DS failure | `failed`/`cancelled`, `error_reason` populated |
| 5 | **Webhook replay** — POST the same payload 5× | exactly one transition, one fulfilment, 5 audit rows |
| 6 | **Webhook with wrong secret** | 403, nothing written except an error event |
| 7 | **Return URL raced with webhook** | one transition; second is a no-op |
| 8 | **Double-click Pay** | one payment row, same `transId` reused |
| 9 | **Tampered price** — POST a different `displayedTotalCzk` | 409 `price_changed`, no payment created |
| 10 | Partial refund (e.g. 500 of 2 490) | `refunded_minor` 50000, status stays `paid` |
| 11 | Second partial refund exceeding balance | rejected before reaching Comgate |
| 12 | Full refund | status `refunded`, order `payment_status` `refunded` |
| 13 | Reject a paid order in review | auto full refund, order `cancelled`, review recorded |
| 14 | Reject where the refund API fails | review **not** recorded, 502 returned |
| 15 | Payment expiry (30m) | Comgate marks cancelled; sync reflects it |
| 16 | Settlement cron | `payment_settlements` rows, payments matched by VS |
| 17 | Pre-auth mode: authorize → approve | `authorized` → `paid` |
| 18 | Pre-auth mode: authorize → reject | `authorized` → `cancelled`, nothing charged |

Row 5, 7, 8 and 9 are the ones that actually matter. They are also the ones most integrations get wrong.

---

## 9. Things I found in the existing code

Not part of the payment work, but they touch it.

### 9.1 Order numbers are generated in the browser — fix before launch

`app/order/page.tsx:89`:

```ts
const orderNo = `MB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
```

Four random digits, client-side. That's 9 000 possible values per year — by the birthday bound you have a ~50% chance of a collision somewhere around 110 orders, and `orders.order_no` is `unique`, so the insert fails and the customer loses their order.

This mattered less when the order number was just a label. **It is now the payment `refId`** — the key Comgate returns on every status call and every notification. It must be server-generated and guaranteed unique. Move generation into `/api/order` and use a Postgres sequence or `MB-{year}-{6 chars of gen_random_uuid()}`.

### 9.2 The order POST is fire-and-forget

`void fetch("/api/order", ...)` followed immediately by `router.push`. If the insert fails, the customer sees a confirmation page for an order that does not exist. With payments in the flow this becomes a charge with no order behind it. §7.1 fixes it.

### 9.3 `PAYMENT_FEE_PCT = 0.018` is probably too high now

`lib/pricingConfig.ts:46` grosses every price up by 1.8% for processor fees:

```ts
base = (landedCZK * MARKUP) / (1 - PAYMENT_FEE_PCT);
```

On the Comgate Profi tariff and the expected method mix, the blended rate is closer to **0.85%** (cards 0.67% + 1 Kč, bank buttons 0.62%). You are grossing up by roughly 0.95 points more than you pay.

Two ways to read that: it's a margin buffer, or it's making you ~1% more expensive than you need to be at the exact moment you're buying traction. Your call — but make it deliberately. The new `/admin/payments` KPI shows your *measured* effective rate next to this constant so you can decide from data after ~20 orders rather than from an estimate.

### 9.4 Two migrations share the `0003_` prefix

`0003_cookie_consents.sql` and `0003_newsletter_resend_sync.sql`. Ordering is undefined. Rename one before it bites.

### 9.5 `utils/supabase/middleware.ts` appears unwired

There's no root `middleware.ts`, so the Supabase session-refresh helper never runs. Doesn't affect payments (the backstage uses its own cookie gate), but it's probably not what was intended.

### 9.6 `.env.local` holds live secrets on disk

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `AUTH_GOOGLE_SECRET`, `ADMIN_PASSWORD_HASH`, `POSTHOG_PERSONAL_API_KEY`. Gitignored, so not in the repo — but it's plaintext on a laptop. `COMGATE_SECRET` is about to join it, and that one moves money. Worth moving to a password manager and pulling via `vercel env pull` when needed.

---

## 10. Go-live checklist

- [ ] Comgate contract signed; **written reserve terms** obtained (see the provider analysis, §9.1 — you are a "future delivery" merchant)
- [ ] Confirm in writing that BLIK + PLN are available on the same contract
- [ ] Apply `0006_payments.sql` in the Supabase SQL editor
- [ ] Set the six env vars in Vercel (Production + Preview)
- [ ] Notification URL set in the Comgate portal, https
- [ ] Wire §7.1–7.3
- [ ] Run the full test matrix in `COMGATE_TEST=1`
- [ ] **Fix the order-number generator (§9.1)** — this is a launch blocker
- [ ] Update the legal pack: replace GoPay with Comgate in the EN **and binding CZ** Terms & Conditions and Privacy Policy, and in `legal-source/{cz,en}/`
- [ ] Sign the Art. 28 data-processing agreement with Comgate
- [ ] Add PostHog events: `payment_started`, `payment_method_selected`, `payment_completed`, `payment_failed`
- [ ] Remove `COMGATE_TEST`, place one real order with your own card, refund it
- [ ] Schedule the settlement cron
```
