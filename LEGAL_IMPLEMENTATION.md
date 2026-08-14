# Legal & Compliance Implementation — Myble

MVP scope: **Czech Republic only.** Binding legal version: **Czech.** English is a
courtesy translation. The verbatim, lawyer-reviewed text lives in
[`legal-source/`](./legal-source) and is treated as the single source of truth.

## Routing decision (important)

The app uses a **client-side i18n** with no per-locale URL routing — locale lives
in React context (`lib/i18n.tsx`) and is toggled from the footer; it persists in
`localStorage` + the `myble.locale` cookie. To stay consistent with that pattern
(rather than inventing `[locale]` routes), the legal pages use **single,
non-prefixed routes** that render EN or CZ from the locale context:

| Doc | Route | Source |
|---|---|---|
| Terms & Conditions | `/legal/terms-and-conditions` | `legal-source/{en,cz}/terms-and-conditions.md` |
| Privacy Policy | `/legal/privacy-policy` | `.../privacy-policy.md` |
| Cookies Policy | `/legal/cookies-policy` | `.../cookies-policy.md` |
| Withdrawal Form | `/legal/withdrawal-form` | `.../withdrawal-form.md` |
| Complaints Procedure | `/legal/complaints-procedure` | `.../complaints-procedure.md` |
| Product Safety & Assembly | `/legal/product-safety` | `.../product-safety.md` |

- One dynamic route: `app/legal/[doc]/page.tsx` (a Server Component). It reads
  both locale files at build time via `lib/legalServer.ts` and passes them to the
  client `components/LegalDocView.tsx`, which picks the locale from context — so
  the footer language switcher updates the document live.
- Markdown is rendered with `react-markdown` + `remark-gfm` (tables/headings).
  Styling is in `app/globals.css` under `.legal-prose` (no Typography plugin).
- `next.config.ts` → `outputFileTracingIncludes` ships `legal-source/**` with the
  serverless output.

## Part B — compliance mechanics

| # | What | Where |
|---|---|---|
| B1 | "Order with obligation to pay" / "Objednávka zavazující k platbě" final button | `lib/i18n.tsx` → `order.place`; used in `app/order/page.tsx` |
| B2 | Price shown itemized (goods + delivery = total); **no VAT lines** (seller is not a VAT payer) | VAT wording removed across `lib/i18n.tsx`; order summary in `app/order/page.tsx` |
| B3 | Custom §1837 notice + un-prechecked acknowledgement, required before order | `app/order/page.tsx` (`acceptedCustom`) |
| B4 | Un-prechecked Terms/Complaints/Privacy acceptance; blocks submit; consent persisted | `app/order/page.tsx` (`acceptedTerms`) + `lib/legal.ts` versions |
| B5 | Order confirmation on a durable medium (on-screen docs + email TODO) | `app/order/confirmation/page.tsx` + `app/api/order/route.ts` |
| B6 | Cookie consent (opt-in), granular, Reject-all = Accept-all prominence | `lib/consent.tsx`, `components/CookieConsent.tsx`, `components/Analytics.tsx`, `app/layout.tsx` |
| B7 | CZ-only delivery | `app/order/page.tsx` country select |
| B8 | Omnibus reference price | `TODO` comment at the price render in `app/order/page.tsx` |
| B9 | Seller identification / imprint | `app/contact/page.tsx` (`imprint.*` in `lib/i18n.tsx`); linked from the footer's "Contact" item |
| B10 | Complaints intake (prefilled mailto) | `components/LegalDocView.tsx` (complaints page) + confirmation |

### Where consent is stored

- **Cookie/tracking consent (B6):** the `myble_consent` cookie
  (`{ v, analytics, marketing, ts }`, 180-day max-age). Managed by
  `lib/consent.tsx`. Non-essential trackers stay off until opt-in:
  - **PostHog** starts `opt_out_capturing_by_default` (`instrumentation-client.ts`);
    `opt_in_capturing()` fires only on analytics consent.
  - **Google** uses **Consent Mode v2**: defaults set **denied** in
    `app/layout.tsx` before any tag; `gtag.js` is not even loaded until consent
    (`components/Analytics.tsx`); `consent 'update'` is sent on change.
- **Terms-acceptance consent (B4):** recorded per order as
  `{ orderNo, locale, acceptedAt, acceptedDocVersions, acknowledgedCustomWithdrawalExclusion }`.
  Stored client-side under `localStorage["myble.lastOrder"]` and POSTed to
  `/api/order` (currently logs server-side — see TODOs).

### How to update a policy version

1. Edit the file in `legal-source/{en,cz}/<slug>.md` (keep the "Version / Effective
   date" line in sync between EN and CZ).
2. Bump the matching `version` in `lib/legal.ts` (`LEGAL_DOCS`). For the three
   checkout-accepted docs (T&C, Complaints, Privacy) this version is what gets
   recorded with each customer's consent.
3. If the consent *categories* or cookie shape change, bump `CONSENT_VERSION` in
   `lib/consent.tsx` (invalidates stored choices and re-prompts).

## Open TODOs

- **B5 email (durable medium):** no transactional-email provider or datastore
  exists yet. `app/api/order/route.ts` is a stub that logs the consent record.
  Wire an email provider (e.g. Resend/Postmark) to send the confirmation with the
  T&C + withdrawal form, and persist the consent record to a datastore. Until
  then the **confirmation page** is the on-screen durable copy.
- **B8 Omnibus:** no discounts are shown at MVP. A `TODO` marks the price render
  in `app/order/page.tsx`; if a "sale" price is added, also show the lowest price
  of the previous 30 days.
- **Product load limits:** if per-product max load/weight guidance is required by
  the Product Safety doc, surface it on the product/configurator page.

## Legal-text: Custom-only (resolved in T&C v1.2)

Business decision: **all orders are Custom Goods** (everything is made to the
customer's dimensions; there are no standalone "Preset" SKUs for sale). The
lawyer reconciled the binding text on **3 July 2026**; the updated wording was
re-synced into `legal-source/` from the source-of-truth MD folder:

- **T&C → Version 1.2** (effective 3 July 2026): the "Preset Goods" category and
  its voluntary 14-day return (old Art. 9.4/9.5) were removed. Art. 2.3 and 9.2
  now state that starting from a preset **template** and adjusting it still yields
  Custom Goods (the defensive §1837 clause). Art. 4.4 now explicitly says the
  right of withdrawal does not apply.
- **Model withdrawal form** preamble rewritten: applies only in the exceptional
  case where a statutory withdrawal right exists (tracks the T&C release, so its
  version constant in `lib/legal.ts` is set to `1.2`).
- Privacy, Cookies, Complaints, Product Safety unchanged (v1.1 / v1.0).

Operational follow-through from the lawyer, now implemented:
- **§1837 anchor:** each order's consent record captures the customer-set
  specification (confirmed dimensions/colour/thickness) — see
  `consent.customSpecification` in `app/order/page.tsx`.
- **No "returns" promises in UI:** the FAQ states orders are non-returnable; the
  stale "Delivery & returns" footer label was removed. If marketing adds any
  "14-day return" copy later, it must be removed (misleading practice).
