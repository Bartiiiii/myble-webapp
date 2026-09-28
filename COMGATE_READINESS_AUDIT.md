# Comgate merchant-approval readiness audit

**Date:** 17 August 2026 · **Repo:** `myble-webapp/myble-webapp-project` · **Site:** https://my-ble.eu

---

## Summary

### Ready

The public site already meets most of Comgate's published checklist. All six legal
documents render at `/legal/[doc]` in both locales, are linked from every page footer
and from checkout, contain no placeholders, and are structurally parallel CZ↔EN. The
Czech T&C carries the ČOI out-of-court dispute reference. Products and prices are
visible without signing in. The order flow completes end to end. HTTPS is enforced
with HSTS. Supabase is RLS deny-all on every table, every `/api/admin/*` route calls
`backstageApiStatus()` first, and no secret is reachable from the browser.

### Fixed in this pass

| Fix | Where |
|---|---|
| GoPay → Comgate in binding CZ + EN T&C §5 and Privacy §2/§4 | `legal-source/{cz,en}/{terms-and-conditions,privacy-policy}.md` |
| Payment methods rewritten: card/Apple Pay/Google Pay/bank buttons/QR, no COD, no instalments, transitional bank-transfer-on-invoice, price due + production starts after payment | T&C §5.1–5.5 |
| T&C 1.2 → **1.3**, Privacy 1.1 → **1.2**, withdrawal-form 1.2 → **1.3**, effective 17 Aug 2026 | `lib/legal.ts:33-36` + all four markdown files |
| Seller identification (name, IČO, address, sole-trader status, VAT status) now on **every page**, not only `/contact` | `components/SiteFooter.tsx:70-84` |
| Checkout delivery line showed a hardcoded 199 Kč that was not in the total | `app/order/page.tsx:441-447` |
| Checkout gate while payments are off (Part C) | `lib/comgate/config.ts:47`, `app/order/page.tsx`, `app/order/confirmation/page.tsx:51` |
| Lead time made consistent across all six touchpoints + a binding 28-day delivery cap (T&C §6.2a); T&C 1.3 → **1.4** | `lib/i18n.tsx`, `legal-source/{cz,en}/terms-and-conditions.md`, `lib/legal.ts` |
| Checkout now states the delivery estimate the option subtitles refer to | `app/order/page.tsx:276-279`, `lib/i18n.tsx` (`order.deliveryEstimate`) |
| Backstage flags paid-but-unshipped orders before they breach the 28-day deadline | `lib/deliveryDeadline.ts`, `lib/backstageData.ts`, `app/admin/(backstage)/orders/` |

### Blocks the Comgate application

~~1. Lead time is stated two different ways.~~ **Fixed 18 Aug 2026.** Every surface now
   states the same thing: production **10–15 business days** from confirmed dimensions +
   payment, total **3–4 weeks**, hard cap **28 days**. See "Lead time" below.
~~2. `npx eslint` fails with 16 pre-existing errors.~~ **Fixed 17 Aug 2026** — 0 errors.
   See A5.
~~3. The "in-room delivery +100 Kč" option is never charged.~~ **Fixed 17 Aug 2026** — the
   surcharge is now threaded through `quoteDesign()` and, critically, through the server-side
   payment authority. See "In-room delivery surcharge" below.

### Deferred (explicitly out of scope for this pass)

- Wiring `lib/payments.ts` / `app/api/payment/*` into the checkout.
- Order numbers generated client-side with `Math.random()`; fire-and-forget `POST /api/order`
  (A3 — belong to the payment-wiring task).
- Content-Security-Policy (recommended below, deliberately not added: an untested CSP
  breaks react-three-fiber).

---

## A1. Comgate's stated requirements

### A1.1 Company identification — **was PARTIAL, now PASS**

| | Before | After |
|---|---|---|
| `/contact` | Name, IČO, address present (`app/contact/page.tsx:110-117`, verified live) | unchanged |
| Every page (footer) | **Absent** — `components/SiteFooter.tsx` carried no seller block; confirmed live (`curl https://my-ble.eu/` → 0 hits for `24439673`) | Present |
| Sole-trader / trade-register statement | **Absent everywhere** | Present |

Fix applied: seller identification block added to `components/SiteFooter.tsx:70-84`, backed by
new i18n keys `imprint.tradeRegister` / `imprint.notVatPayer` in both locales
(`lib/i18n.tsx`). The footer now reads, on every page:

> Bartłomiej Karol Kwaśnica · Business ID (IČO): 24439673 · Uralská 689/7, 160 00 Praha 6 – Bubeneč, Czech Republic
> Sole trader entered in the Czech Trade Register. Not registered for VAT. myble.eu@gmail.com

Wording matches `legal-source/cz/terms-and-conditions.md:7` and the Privacy Policy controller
block exactly.

### A1.2 Contact information — **PARTIAL**

E-mail is present and prominent (`app/contact/page.tsx:102`, footer, every legal document,
order confirmation). A working contact form posts to `/api/contact`
(`app/contact/page.tsx:13-78`).

**No phone number anywhere on the site.** Comgate's checklist says "contact information";
Czech distance-selling practice expects a phone or a clear statement of the contact channel.
The T&C mitigate this — CZ §1.2 states the Seller communicates primarily by e-mail — so this
is a weakness rather than a failure. Adding a phone number is the cheapest single improvement
to the application.

### A1.3 Products with prices, no sign-in — **PASS**

- `/design` renders the configurator with a live price; verified on the live site
  (`curl https://my-ble.eu/design` returns Kč amounts) and locally (3 690 Kč for the default design).
- `/library` lists curated designs; `/#nabidka` on the homepage lists product categories.
- `app/order/login/page.tsx` exists but sign-in is optional — `lib/i18n.tsx:363-366`
  ("Don't want to register? / Continue as guest"), and `/order` is reachable directly.
- No route requires authentication except `/admin`.

### A1.4 Order capability — **PASS (preserved)**

The flow `/design` → `/order` → `/order/confirmation` completes end to end. Verified in the
browser preview with `NEXT_PUBLIC_PAYMENTS_ENABLED` unset: form filled, consent ticked,
interstitial shown and confirmed, `POST /api/order` fired once, redirect to
`/order/confirmation?order=MB-2026-2207`. Part C **does not block submission** — see C below.

### A1.5 Terms and conditions — **PASS**

`/legal/terms-and-conditions` (live 200). Twelve articles, versioned, effective-dated, linked
from the footer, from `/contact`, from checkout (`app/order/page.tsx:430`) and from the order
confirmation. Now version 1.3 / 17 Aug 2026.

### A1.6 Returns / complaints — **PASS**

`/legal/complaints-procedure` (live 200), eight sections, 24-month defect liability, 30-day
handling, e-mail claim route with a prefilled subject/body helper
(`lib/i18n.tsx:401-403`). It is accepted explicitly at checkout alongside the T&C
(`lib/legal.ts:49-53`).

Checked specifically for the risk called out in the brief: the §1837 exclusion is confined to
the **14-day withdrawal** (T&C §9), and §9.4 states in terms that the absence of a withdrawal
right *does not* affect rights from defective performance or transport damage. Nothing on the
site reads as "no returns at all". The customer-facing checkout notice
(`lib/i18n.tsx:433`) is likewise scoped to the withdrawal right only.

### A1.7 Privacy information — **PASS**

- `/legal/privacy-policy` (now 1.2) and `/legal/cookies-policy` (1.1), both live 200.
- Opt-in consent banner with granular analytics/marketing toggles, persistent
  "Cookie settings" re-entry in the footer (`components/SiteFooter.tsx:62-64`), consent
  records persisted via `POST /api/consent` (`supabase/migrations/0003_cookie_consents.sql`).
- PostHog is lazy-initialised only after consent (`lib/posthogClient.ts`).

### A1.8 Delivery and payment terms — **PASS**

| Item | State |
|---|---|
| Delivery methods | PASS — Zásilkovna / PPL to address, chosen at checkout (`app/order/page.tsx:241-242`); T&C §6.3 names Zásilkovna |
| Delivery cost | **Was FAIL, now PASS** — `DELIVERY_CZK = 199` (`lib/model.ts:49`), free at/above `FREE_SHIP_CZK = 3000` (`lib/pricingConfig.ts:52`). The checkout summary hardcoded `fmt(DELIVERY_CZK)` while the total used `quote.customerCZK`, so for every order ≥ 3 000 Kč (which, given `PRICE_FLOOR_CZK = 1490` and typical designs, is most of them) the lines did not add up: 3 690 + 199 was displayed as a 3 690 total. Fixed at `app/order/page.tsx:441-447` — the row now shows `quote.deliveryCZK`, or "Free"/"Zdarma". |
| In-room delivery upcharge | **Was FAIL, now PASS** — see "In-room delivery surcharge" below. |
| Lead time | **Was FAIL, now PASS** — one consistent set of numbers everywhere, plus a contractual 28-day ceiling in T&C §6.2a. See "Lead time" below. |
| Payment methods | **Was FAIL, now PASS** — T&C §5.1 previously named GoPay. Now names Comgate a.s. with the exact method list, and §5.2 rules out COD and instalments. |
| Payment before commitment | PASS — T&C §3.1 lists the pre-contractual disclosures; the button carries the "Objednávka zavazující k platbě" label mandated by §4.2 when payments are live. |

### A1.9 HTTPS — **PASS**

`curl -I https://my-ble.eu/` → HTTP/2 200, `strict-transport-security: max-age=63072000`
(Vercel default, 2 years). No mixed content: the only external origins are proxied through
the same origin via the `/ingest/*` rewrites in `next.config.ts:4-19`. HTTP is redirected by
the platform.

---

## A2. Legal document completeness

| Check | Result |
|---|---|
| Unfilled placeholders (`[`, `]`, `TODO`, `XXX`, `TBD`, `{{`, `Lorem`) | **PASS** — zero hits across all twelve files |
| CZ/EN structurally parallel | **PASS** — heading counts match exactly: T&C 12/12, privacy 8/8, complaints 8/8, product-safety 6/6, cookies 4/4, withdrawal-form 0/0 (no headings by design). Numbering matches clause for clause. |
| Version + effective date match `LEGAL_DOCS` | **PASS before and after.** Every in-file "Version / Effective date" line matched `lib/legal.ts` before the change, and does after it. The B4 consent proof is intact. |
| Renders at `/legal/[doc]` in both locales | **PASS** — all six return 200 live; `app/legal/[doc]/page.tsx` statically generates all six from `LEGAL_SLUGS`, `LegalDocView` picks the locale client-side |
| Linked from footer and checkout | **PASS** — footer lists all six (`components/SiteFooter.tsx:46-52`); checkout links the three accepted docs (`app/order/page.tsx:429-441`); `/contact` links the same three |
| Seller identification matches the footer | **PASS** — identical name/IČO/address in T&C §1.2, Privacy §1, Complaints §1.1 and the new footer block |
| ODR / ČOI reference in CZ T&C | **PASS** — `legal-source/cz/terms-and-conditions.md:68-69`, Article 11, names Česká obchodní inspekce and coi.gov.cz. EN mirrors it. |
| GPSR product safety | **PASS** — `product-safety.md` exists in both locales, six sections, covers assembly, wall anchoring and load limits, and is linked in the footer as "Product Safety & Assembly" |

**Note on the withdrawal form:** it carries no version line of its own and tracks the T&C release
by the convention documented at `lib/legal.ts:29-31`, so it was bumped 1.2 → 1.3 alongside the
T&C. The DOCX files served from `/legal/withdrawal-form-*.docx` were not regenerated — they
contain no payment-processor reference, but confirm they still match the markdown before launch.

---

## A3. Checkout and consent mechanics

| Check | Result |
|---|---|
| Explicit acceptance of `CHECKOUT_ACCEPTED_DOCS` | **PASS** — `app/order/page.tsx:421-443`, un-prechecked (`useState(false)` at line 43) |
| Explicit §1837 acknowledgement | **PASS** — separate, un-prechecked checkbox (`app/order/page.tsx:409-417`, state at line 44); submission is blocked until both are ticked (`canPlace`, line 82) |
| Both stored | **PASS** — `accepted_doc_versions` and `acknowledged_custom_withdrawal_exclusion` written in `app/api/order/route.ts:147-148` |
| Full order specification captured | **PASS** — the complete `Design` (every part) plus a `custom_specification` summary, `app/api/order/route.ts:142,149` |
| Price matches `quoteDesign()` | **PASS** — `kit`/`total` read from the same `quoteDesign(design)` memo used for display (`app/order/page.tsx:51-53`) and posted as `kit_price_czk`/`total_price_czk` |
| Delivery shown as a separate line | **PASS after the fix** — see A1.8 |
| Server re-validates the rules report | **PASS** — `app/api/order/route.ts:95-116` never trusts the client's report |

### Known defects — reported, not fixed (belong to the payment-wiring task)

1. **`app/order/page.tsx:145`** — order numbers are generated in the browser with
   `Math.random()`: `MB-${year}-${1000..9999}`. Four digits per year means collisions are a
   near-certainty by a few hundred orders (birthday bound ≈ 1 in 2 at ~106 orders), and a client
   can pick its own. Once payments are wired, the order number is the payment reference and the
   idempotency key — it must be allocated server-side.
2. **`app/order/page.tsx:213`** — `void fetch("/api/order", …).catch(() => {})` fires and forgets,
   then navigates immediately. If the request fails or the tab closes first, the customer sees a
   confirmation for an order that was never recorded. This must become an awaited request whose
   failure keeps the customer on the form before money is involved.

---

## A4. Security review

| Check | Result |
|---|---|
| Secrets reachable from the browser | **PASS** — every `NEXT_PUBLIC_*` in use is a URL or a publishable token (`lib/i18n.tsx` n/a; `utils/supabase/client.ts:3-4`, `lib/posthogClient.ts:26`, `lib/comgate/config.ts:36`, `lib/pricingConfig.ts:87`). `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `ADMIN_PASSWORD_HASH`, `COMGATE_SECRET` are read server-side only. |
| `utils/supabase/admin.ts` / `lib/payments.ts` client imports | **PASS** — all 20 importers are route handlers or server modules; none carries `"use client"`. `lib/comgate/config.ts` is now imported by two client components for `PAYMENTS_ENABLED`, which is intentional and safe: the file has no imports, and the credential getters read `process.env` inside function bodies, so nothing secret is inlined into the bundle. |
| `/api/admin/*` gated | **PASS** — `export`, `messages/[id]`, `orders/[id]`, `orders/[id]/review`, `payments/[id]` all call `backstageApiStatus()` as the first statement. `login` and `logout` are the gate itself: `login` is double-gated (Google owner session → 404 stealth, then scrypt password) and throttled to 5 attempts per IP per 15 min (`app/api/admin/login/route.ts:9,46`). |
| `/api/cron/*` gated | **PASS** — `Authorization: Bearer $CRON_SECRET` (`app/api/cron/comgate-settlements/route.ts:24-26`) |
| Supabase RLS | **PASS** — every table runs `enable row level security` with **no policies at all**, so anon/authenticated are denied and only the service role reaches data: `orders`, `newsletter_subscribers`, `contact_messages`, `designs`, `cookie_consents`, `design_reactions`, `payments`, `payment_events`, `payment_settlements`. No permissive policy exists anywhere in `supabase/migrations/`. |
| `.env.local` gitignored | **PASS** — `.gitignore` has `.env*` with an `!.env.example` exception; `git status` shows no env file tracked, and no secret is committed anywhere in the repo. |
| Security headers | **PARTIAL** — see below |
| Input validation on public POSTs | **PARTIAL** — see below |
| `utils/supabase/middleware.ts` unwired | **Confirmed, and it does not matter** — there is no root `middleware.ts`, so the helper is dead code. Nothing depends on it: sessions come from NextAuth (`auth.ts`), and the backstage gate runs per-route via `requireBackstage()`/`backstageApiStatus()`. It should be deleted to stop it reading as a security control that exists. It is also the source of two eslint warnings. |

### Security headers — `next.config.ts` has no `headers()` block

| Header | State |
|---|---|
| `Strict-Transport-Security` | **Present** (Vercel platform default, `max-age=63072000`) — not set by the app, so it would disappear on a different host |
| `X-Content-Type-Options: nosniff` | **Absent** |
| `X-Frame-Options` / `frame-ancestors` | **Absent** — the checkout is clickjackable |
| `Referrer-Policy` | **Absent** |

Recommended, and safe to add without touching the configurator:

```ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ],
  }];
}
```

**CSP recommendation (not added, per the brief).** react-three-fiber and the PostHog snippet
both need `script-src 'unsafe-eval'`/`'unsafe-inline'` in practice, so a naive policy breaks the
3D configurator silently. Roll one out as `Content-Security-Policy-Report-Only` first, over a
week of real traffic, before enforcing. Start from: `default-src 'self'; img-src 'self' data:
blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';
connect-src 'self' https://*.supabase.co; frame-ancestors 'self'`. Once Comgate is wired, its
gateway origin must be added to `form-action`/`connect-src`.

### Public POST route validation

| Route | Validation | Gaps |
|---|---|---|
| `/api/contact` | name ≤ 200, email ≤ 320 + regex, message ≤ 5000 | No rate limiting |
| `/api/newsletter` | email ≤ 320 + regex | No rate limiting |
| `/api/consent` | type checks on `analytics`/`marketing`, `policyVersion` sliced to 20 | No rate limiting |
| `/api/designs` | shape check + 100 KB cap on the design JSON | No rate limiting |
| `/api/reactions` | design id validated against the curated library | No rate limiting |
| `/api/order` | **Weakest.** Only `orderNo` + consent presence are checked (`app/api/order/route.ts:78-80`). No length cap on any customer string, no e-mail format check, no cap on `design` size, no rate limiting. | Any client can insert unbounded rows into `orders`. |

**Recommendation:** add length caps and an e-mail regex to `/api/order` mirroring `/api/contact`,
and put a shared IP throttle in front of all six — the in-memory limiter already written for
`/api/admin/login` is the obvious model, though it should move to a shared store before it runs
on more than one Vercel instance.

---

## A5. Build health

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** — clean |
| `npx vitest run` | **PASS** — 248 tests in 16 files (7 checkout-interstitial + 5 in-room-surcharge tests are ours) |
| `npm run build` | **PASS with a caveat** — see below |
| `npx eslint .` | **PASS** — 0 errors, 15 warnings (warnings pre-date this work) |

### eslint — all 16 errors fixed (17 Aug 2026)

All five files were fully committed at the time of the fix (re-checked live against
`git status`), so none of the in-flight Wave 1 work was touched.

| File | Count | Rule | Fix |
|---|---|---|---|
| `app/brand/page.tsx:80,91,200-213` | 12 | `react/no-unescaped-entities` | Straight `"` was being used to close quotes opened with `„`. Replaced with the correct typographic pairs (CZ `„…“`, EN `“…”`), which fixes a real typography bug on the brand page rather than escaping the symptom. |
| `app/page.tsx:431` | 1 | `react-hooks/set-state-in-effect` | Same lazy-WebGL-mount pattern in all three: an effect read `ref.current`, and called `setVisible(true)` when `IntersectionObserver` was missing. Rewritten as a React 19 ref callback with a returned cleanup — the node arrives at commit time, so there is no ref read and no state set from an effect. Behaviour is identical, including the no-observer fallback. |
| `app/design/page.tsx:554` | 1 | `react-hooks/set-state-in-effect` | as above |
| `app/library/page.tsx:53` | 1 | `react-hooks/set-state-in-effect` | as above |
| `instrumentation.ts:19` | 1 | `@typescript-eslint/no-explicit-any` | `(globalThis as any).__posthogLogger` → a named `PosthogGlobal` type deriving the logger type from `ReturnType<LoggerProvider["getLogger"]>`. |

**Judgment call worth knowing about:** the three `set-state-in-effect` sites could not be fixed
by moving the fallback into `useState`'s initialiser — `IntersectionObserver` is undefined during
SSR, so a lazy initialiser would render visible on the server and hidden on the client, producing
a hydration mismatch. The ref-callback rewrite is the fix that keeps SSR output identical. No
error was suppressed.

The 15 remaining **warnings** (unused eslint-disable directives, `<img>` vs `next/image`, unused
vars in the dead `utils/supabase/middleware.ts`) pre-date this work and are non-blocking.

### `npm run build` — fails locally, passes with valid env

The build fails on `.env.local` as it stands, not on the code:

```
TypeError: Invalid URL … input: 'https://[SENSITIVE]'
Export encountered an error on /_not-found/page
```

`.env.local` contains the literal string `[SENSITIVE]` as the value of **16 variables**,
including `NEXTAUTH_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_POSTHOG_HOST` — a
redacted `vercel env pull` dump was saved verbatim. `next-auth` calls `new URL()` on
`NEXTAUTH_URL` at module evaluation, which throws and takes down every page importing
`SiteHeader`. Re-running the same build with real URLs succeeds:

```
✓ Compiled successfully · ✓ Generating static pages (32/32)
```

**No real secrets are in that file**, so nothing is leaked — but local dev is broken until it is
re-pulled with `vercel env pull --environment=development`. Production is unaffected (Vercel
injects the real values).

### Duplicate migration prefix

`supabase/migrations/0003_cookie_consents.sql` and `0003_newsletter_resend_sync.sql` share the
`0003_` prefix. Ordering between the two is undefined under `supabase db push`; they happen to be
independent today, so nothing is broken, but rename one to `0007_` (never renumber an applied
migration in place if the remote history table already records it — check `supabase migration list`
first).

---

## PART B — GoPay → Comgate (applied)

### Files changed

| File | Change |
|---|---|
| `legal-source/cz/terms-and-conditions.md:29-33` | §5 rewritten: Comgate a.s. + entity block, method list, COD/instalments excluded, transitional invoice payment, price due, production starts after payment |
| `legal-source/en/terms-and-conditions.md:29-33` | Mirrors the CZ text |
| `legal-source/cz/privacy-policy.md:20,37` | Card data processed by Comgate; processor list now "**Comgate a.s.**, IČO 279 24 505 (Česká republika) — zpracování plateb" |
| `legal-source/en/privacy-policy.md:21,38` | Mirrors the CZ text |
| `lib/pricingConfig.ts:45` | Stale "Stripe/GoPay/Comgate" comment → "Comgate" |
| `lib/legal.ts:33,34,36` | T&C 1.3, Privacy 1.2, withdrawal-form 1.3 |

Czech was written first and the English follows it clause for clause. Numbering was extended
within §5 (5.1–5.5) rather than restructured; every other article is untouched.

**Zero GoPay references remain** outside `COMGATE_INTEGRATION_SPEC.md` (historical) and this
pass's own prompt file.

### Comgate entity block used

> **Comgate a.s.**, IČO 279 24 505, Gočárova třída 1754/48b, 500 02 Hradec Králové, Czech Republic

Used verbatim, nothing invented around it. **Verify it against the signed contract before this
text goes live** — it is reproduced from the brief, not from a Comgate document.

---

## PART C — Checkout gate (applied)

`PAYMENTS_ENABLED` (`lib/comgate/config.ts:47`) reads `NEXT_PUBLIC_PAYMENTS_ENABLED === "1"`.
Unset ⇒ false ⇒ the honest state is the default.

**With payments off** (`app/order/page.tsx`):

1. Submit button reads "Odeslat objednávku" / "Submit order" instead of the
   payment-obligation label (line 509).
2. A notice sits in the payment section above the button, not only in the modal (line 494).
3. Submitting opens a modal the customer must actively confirm — `role="dialog"`,
   `aria-modal="true"`, labelled by its heading, focus moved to the confirm button, Tab trapped,
   Escape cancels, backdrop click cancels, focus returned to the submit button on cancel, confirm
   disabled while the request is in flight.
4. Confirming runs the existing submission unchanged and continues to `/order/confirmation`.
5. The confirmation page replaces the "we're sending it to production" framing with the
   invoice/bank-transfer explanation and repeats the lead time
   (`app/order/confirmation/page.tsx:51-63`).

**With payments on**, none of it renders and the flow is byte-for-byte the old one.

Copy lives under `checkout.paymentsOff.*` in `lib/i18n.tsx`, Czech and English, hand-written
in the existing register.

### Tests

`app/order/paymentsOff.test.tsx` — 7 cases: button label, in-form notice, dialog opens instead
of submitting, cancel submits nothing, Escape cancels, confirm submits exactly once under a
double-click, and nothing renders with `PAYMENTS_ENABLED === true`. This is the repo's first
DOM test, so `jsdom` + `@testing-library/react` were added as devDependencies and
`vitest.config.ts` now includes `app/**/*.test.tsx` (the file opts into jsdom with a
`// @vitest-environment jsdom` docblock; the pure-logic `lib/` suites still run in node).

### Verified in the browser

With `NEXT_PUBLIC_PAYMENTS_ENABLED` unset: filled the form, ticked consent, saw the notice and
the "Submit order" label, opened the modal, cancelled (dialog closed, field values intact, focus
back on the button, nothing sent), re-submitted, confirmed, landed on
`/order/confirmation?order=MB-2026-2207` showing "Payment by bank transfer". The
`PAYMENTS_ENABLED === true` path is covered by the unit test and the production build; it could
not be exercised through the local preview because the dev server ignores per-config env
overrides.

---

## Lead time (fixed 18 August 2026)

The site advertised **5–8 business days** in six places while the checkout interstitial said
**2–4 weeks** — two different promises inside the same purchase. Now one set of numbers:

| Surface | `lib/i18n.tsx` | Reads |
|---|---|---|
| Hero trust bar | 82 / 608 | "Ready in weeks, not months" · "Hotovo za týdny, ne za měsíce" |
| Comparison table, "when you get it" | 116 / 642 | "3–4 weeks" · "3–4 týdny" (carpenter column stays 8–16 weeks) |
| FAQ, "how long does it take" | 163 / 687 | 10–15 business days production, 3–4 weeks total, always within 28 days |
| Checkout delivery estimate | 298 / 823 | "Total delivery: 3–4 weeks from payment, always within 28 days." — rendered directly under the "Delivery" heading, above the two options |
| Checkout delivery options | 300,302 / 825,827 | "Included in your total delivery estimate above" — refers to the line above; no transit number asserted |
| Payment interstitial + confirmation | 517,523 / 1040,1046 | "3–4 week delivery estimate … (always within 28 days)" |
| Confirmation "what happens next" | 346 / 870 | "production usually 10–15 business days" |

The delivery-option subtitles previously repeated the **production** figure as if it were the
**transit** figure, which was wrong twice over. There is no verified PL→CZ transit SLA from the
manufacturing partner, so no number is asserted there.

**T&C §6.2a (new, both locales):** the Seller delivers no later than **28 days** from the start
of production (i.e. from receipt of payment, per §5.5), unless a longer period is agreed in
writing. This is a binding commitment, not marketing copy, so T&C went **1.3 → 1.4** (effective
18 Aug 2026) in the markdown and in `lib/legal.ts`; `withdrawal-form` tracked it to 1.4 per the
convention at `lib/legal.ts:29-31`. Consent proof for orders placed under 1.3 is unaffected —
they keep recording 1.3.

Verified against the built output, not just the source: the prerendered homepage contains
"Ready in weeks, not months", "3–4 weeks", "10 to 15 business days" and "within 28 days"; the
prerendered T&C page contains §6.2a and "Version 1.4"/"Verze 1.4" in both locales; and the
strings `5–8 business days` and `2–4 week lead time` appear nowhere in `.next/`.

---

## Ops safeguard: the 28-day deadline (added 18 August 2026)

§6.2a is a contractual ceiling, so the risk is no longer that the customer is misinformed — it is
that an order quietly runs past 28 days. The schema supports catching that: `orders.payment_status`
and `orders.paid_at` come from `0006_payments.sql`, and `orders.status` already has real terminal
values (`shipped`, `delivered`, `cancelled`, per `0002_newsletter_contact_designs.sql:83`). **No
schema gap — nothing had to be invented.**

`lib/deliveryDeadline.ts` (pure, dependency-free, 11 unit tests) classifies an order:

- The clock runs only when `payment_status = 'paid'`, `paid_at` is set, and the status is not
  terminal. Everything else is untracked and renders as "—".
- `daysElapsed ≥ 21` → **due** (amber). `daysElapsed ≥ 28` → **overdue** (rose).
- 21 was chosen for a week of headroom: roughly the shortest window in which a panel order can
  still be re-cut and shipped.

Where Barti sees it:

| Surface | What appears |
|---|---|
| `/admin/orders` | A **Deadline** column: "14 d left" in grey while safe, an amber "5 d left" pill from day 21, a rose "3 d overdue" pill past day 28. Flagged rows get a tinted background and **sort to the top**, ahead of the usual newest-first order. |
| `/admin/orders` (banner) | When anything is at risk, a banner above the status filters: "2 orders are past the 28-day delivery deadline" (rose) or "3 orders approaching the 28-day delivery deadline" (amber), explaining that they are paid, unshipped and listed first. |
| `/admin/orders/[id]` | The same badge beside the order number, plus "paid 3 Aug 2026, delivery due 31 Aug 2026 (T&C §6.2a)" in the subheading. |

The badge's tooltip carries the exact due date. No cron, no e-mail, no new dependency — the
classification happens inside the existing service-role read (`fetchOrdersWithDeadlines`), which
also keeps `Date.now()` out of the render path so the whole list is measured against one instant.

---

## In-room delivery surcharge (fixed 17 Aug 2026)

The checkout offered "PPL to address" at `DELIVERY_CZK + 100` as a hardcoded label, but nothing
downstream knew about it. Three layers had to move together, and the third is the one that
mattered:

1. **`lib/quote.ts`** had no concept of a delivery method at all. `PriceOptions` now carries
   `deliveryMethod?: "curbside" | "in-room"`, and `priceFromMeble` adds
   `IN_ROOM_DELIVERY_SURCHARGE_CZK` (new, `lib/model.ts`) on top of the base fee. The
   empty-design branch of `quoteDesign` was patched to match.
2. **`app/order/page.tsx`** read the delivery radio only at submit time, via `FormData`, so the
   selection never reached the live quote. The radios are now controlled by a `deliveryMethod`
   state that feeds `quoteDesign(design, { deliveryMethod })` — one source of truth, so the
   displayed price and the submitted field cannot disagree. The `name`/`value` attributes are
   unchanged, so `readCustomer()` still works.
3. **The server-side payment authority.** `authoritativePrice()` in `lib/payments.ts`
   recomputes the charge from the stored design alone, and `app/api/payment/create/route.ts`
   was not even selecting `delivery_method` from the row. `assertPriceMatches()` is
   zero-tolerance, so fixing only the client would have made **every in-room order fail at
   checkout** the moment Comgate went live: client says total + 100, server says total, hard
   error. `deliveryMethod` is now selected from the order row and threaded through
   `startPaymentForOrder` → `authoritativePrice` → `quoteDesign`, so both sides compute the
   same number from the same stored fact.

**Business rule chosen:** the surcharge applies *even when base delivery is free* (an order
above `FREE_SHIP_CZK`) — it is a service fee, not transport cost. That is the revenue-preserving
default, flagged in a comment in `priceFromMeble` and listed as an open question below.

Covered by five tests in `lib/quote.test.ts` ("quoteDesign — in-room delivery surcharge"):
curbside and omitted charge nothing extra, the surcharge stacks on a charged base fee, it still
applies when base delivery is free, it reaches `customerCZK` and not just the delivery line, and
the empty-design branch honours it.

Verified in the browser: selecting in-room on a 3 690 Kč design moved the delivery line from
"Free" to "100 Kč" and the total from 3 690 Kč to 3 790 Kč, with `FormData.get("delivery")`
still returning `"in-room"`.

---

## Open questions — need Bartek

1. **Can you actually hit 28 days?** T&C §6.2a is now a contractual ceiling, not an estimate.
   It needs to hold for the slowest realistic case (PL panel production + cross-border transit +
   your own accessory shipment). If the partner has no committed SLA, this is the clause that
   turns a late order into a breach.
2. **Confirm the Comgate legal entity** against the signed contract before launch.
3. **In-room surcharge vs. free shipping** — the surcharge now applies even when the order
   qualifies for free curbside delivery (treated as a service fee, not transport cost). That is a
   revenue-preserving default, not a decision you made; confirm it. It is one comparison in
   `priceFromMeble` (`lib/quote.ts`) and a test named "still applies when base delivery is free".
4. **Phone number** — is there one to publish? It would materially strengthen A1.2.
5. **Bank details for the transitional invoice flow** — T&C §5.3 now promises an invoice by
   e-mail. Nothing in the codebase generates one; today it is a manual step. Confirm that is
   the intent for the interim period.
6. **`utils/supabase/middleware.ts`** — safe to delete? It is unwired dead code.
