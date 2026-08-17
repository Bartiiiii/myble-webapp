# Claude Code — Comgate merchant-approval readiness pass

Repo root: `myble-webapp/myble-webapp-project`. Three jobs, in this order: **audit**, **swap GoPay → Comgate**, **gate the checkout until payments are live**.

## Context

Myble is applying for a Comgate payment gateway. Before Comgate approves live traffic they review the public website. Their published requirements are:

> company registration details · contact information · product descriptions with pricing · order capability · terms and conditions · returns/complaints policy · privacy information · delivery and payment terms · HTTPS

Seller: **Bartłomiej Karol Kwaśnica, IČO 24439673, Praha. Not a VAT payer.** CZ-only at MVP. Czech legal text is **binding**; English is a courtesy translation.

The Comgate payment code already exists (`lib/comgate/`, `lib/payments.ts`, `app/api/payment/*`) but is **not wired into the checkout**. Do not wire it in this pass — that is a separate task. This pass makes the public site pass review and stops customers from reaching a dead end.

---

# PART A — Readiness audit

Produce `COMGATE_READINESS_AUDIT.md` in the repo root. For every item: **PASS / FAIL / PARTIAL**, the file and line where it is (or should be) implemented, and — where it fails — the exact fix. Do not fix things silently in this part; report first, then fix in Parts B and C plus a final fix list.

## A1. Comgate's stated requirements

Walk the real rendered pages, not just source. Check each of these appears on the **public site** (a document in `legal-source/` that isn't reachable from the UI does not count):

1. **Company identification** — trading name, full legal name, IČO, registered address, and the fact that Bartłomiej is a sole trader entered in the trade register. Must be reachable from every page (normally the footer) and on a contact page. Check `components/SiteFooter.tsx`, `app/contact/page.tsx`.
2. **Contact information** — email and, ideally, phone. A contact form alone is weaker; note if that's all there is.
3. **Products with prices** — a visitor must be able to see what is sold and what it costs *without* signing in. Check `app/page.tsx`, `app/library/page.tsx`, `app/design/page.tsx`.
4. **Order capability** — a working end-to-end order flow. **Critical: Part C must not break this.** Comgate needs to be able to walk the flow.
5. **Terms and conditions** — reachable, complete, versioned.
6. **Returns / complaints** — `complaints-procedure` (Reklamační řád). Note that T&C v1.2 excludes the 14-day withdrawal because every item is custom under §1837; make sure the *complaints* route (defects) is still clearly available and not accidentally worded as "no returns at all".
7. **Privacy information** — privacy policy + cookies policy, plus a working consent mechanism (`components/CookieConsent.tsx`).
8. **Delivery and payment terms** — delivery methods, delivery cost (`DELIVERY_CZK = 199`, free at/above `FREE_SHIP_CZK = 3000`), lead time, and accepted payment methods. **Lead time is a specific risk item**: made-to-order with a 2–4 week wait must be stated plainly before the customer commits, or it becomes chargeback material later.
9. **HTTPS** — confirm enforced, no mixed content, HSTS present or noted as missing.

## A2. Legal document completeness

For each of the six docs in `legal-source/cz/` and `legal-source/en/`:

- No unfilled placeholders — search for `[`, `]`, `TODO`, `XXX`, `TBD`, `{{`, `Lorem`.
- CZ and EN are **structurally parallel** (same sections, same numbering). Report any section present in one and missing in the other.
- Version and effective-date lines inside each file match `LEGAL_DOCS` in `lib/legal.ts`. **A mismatch here breaks the B4 consent proof** — flag it as high severity.
- Every doc renders at `/legal/[doc]` in both locales and is linked from the footer and from checkout.
- Seller identification inside the documents matches the footer exactly (name, IČO, address).
- ODR / consumer dispute resolution: Czech law expects a reference to the Czech Trade Inspection Authority (Česká obchodní inspekce) as the out-of-court dispute body. Report whether it is present in the CZ T&C.
- GPSR: `product-safety.md` should carry safety and assembly information. Check it exists and is linked.

## A3. Checkout and consent mechanics

Read `app/order/page.tsx`, `app/api/order/route.ts`, `lib/legal.ts`.

- The customer explicitly accepts the `CHECKOUT_ACCEPTED_DOCS` and the §1837 custom-goods withdrawal exclusion, and both are stored (`accepted_doc_versions`, `acknowledged_custom_withdrawal_exclusion`). Verify the acknowledgement is a **deliberate action** (unticked checkbox), never pre-ticked.
- The full order specification is captured per order (T&C requirement for custom goods).
- Price shown at checkout matches `quoteDesign()`; delivery is shown as a separate line.
- **Report (do not fix here) the two known defects**: order numbers generated client-side with `Math.random()` at `app/order/page.tsx:89`, and the fire-and-forget `void fetch("/api/order", …)` at ~line 173.

## A4. Security review

- No secret reachable from the browser. Grep for any `NEXT_PUBLIC_` variable holding a key, and confirm `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `AUTH_SECRET`, `ADMIN_PASSWORD_HASH` are server-only. Confirm `utils/supabase/admin.ts` and `lib/payments.ts` are never imported into a client component.
- Every `/api/admin/*` route calls `backstageApiStatus()` **before** doing anything. List any that don't.
- Supabase RLS: confirm every table has RLS enabled and no permissive policy on `orders`, `payments`, `payment_events`.
- Security headers in `next.config.ts`: report presence/absence of `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. Recommend a CSP but **do not add one in this pass** — an untested CSP breaks the 3D configurator.
- Input validation on every public POST route (`/api/order`, `/api/contact`, `/api/newsletter`, `/api/consent`, `/api/designs`, `/api/reactions`): report missing length caps, missing type checks, and absent rate limiting.
- `.env.local` is gitignored — confirm, and confirm no secret is committed anywhere in the repo.
- Report that `utils/supabase/middleware.ts` appears unwired (no root `middleware.ts`) and whether that matters.

## A5. Build health

Run and report: `npx tsc --noEmit`, `npx eslint`, `npx vitest run`, `npm run build`. Any failure is a blocker. Also flag the duplicate `0003_` migration prefix.

---

# PART B — GoPay → Comgate

Comgate's legal entity, for the processor disclosure:

> **Comgate a.s.**, IČO 279 24 505, Gočárova třída 1754/48b, 500 02 Hradec Králové, Czech Republic

**Verify this against the contract documents Comgate sends before you finalise the Czech text. Do not invent or "improve" any other detail about them.**

### B1. Files to change

Exactly these four, plus version metadata:

| File | Line | Change |
|---|---|---|
| `legal-source/cz/terms-and-conditions.md` | 29 (§5.1) | GoPay → Comgate |
| `legal-source/cz/privacy-policy.md` | 20, 37 | GoPay → Comgate (processor list + card-data sentence) |
| `legal-source/en/terms-and-conditions.md` | 29 (§5.1) | mirror the CZ change |
| `legal-source/en/privacy-policy.md` | 21, 38 | mirror the CZ change |

Also update the stale comment at `lib/pricingConfig.ts:45`.

### B2. Version bumps — do not skip this

The versions in `lib/legal.ts` are recorded with every customer's consent as legal proof of which wording they accepted. **Changing binding text without bumping the version silently corrupts that proof.**

- `terms-and-conditions`: `1.2` → `1.3`
- `privacy-policy`: `1.1` → `1.2`

Update `LEGAL_DOCS` in `lib/legal.ts` **and** the "Version / Effective date" line inside each of the four markdown files. Use a real effective date (today or later), consistent across CZ and EN. The `withdrawal-form` tracks the T&C release — check `lib/legal.ts` comments and bump it if that convention requires it.

### B3. Payment-methods wording

While editing §5.1, make the payment section accurate for **both** the current state and the post-launch state:

- List the methods Comgate will actually offer: payment card, Apple Pay, Google Pay, online bank transfer (bank buttons), QR payment.
- **Do not** mention deferred payment or instalments — those are switched off.
- **Do not** mention cash on delivery — it will not be offered.
- Add that during the current phase payment may be arranged by **bank transfer on the basis of an issued invoice**, because Part C means orders are taken before the gateway is live. This must be true and stated, not glossed over.
- State when the price is due and that the goods are made to order after payment/confirmation.

Czech is binding: write the Czech first, then translate to English. Match the existing register and numbering exactly; do not restructure the documents.

### B4. Fix anything Part A found

Apply the fixes for A1 and A2 failures — missing company identification in the footer, missing ODR reference, unfilled placeholders, CZ/EN structural gaps, broken legal links. Leave the A3 order-number and fire-and-forget defects alone; they belong to the payment-wiring task.

---

# PART C — Gate the checkout until payments are live

### C1. The constraint that shapes this

**Comgate must still be able to walk the order flow end to end.** A hard block that stops the form from submitting would fail their review. So this is not a block — it is an honest interstitial that lets the order complete while making clear no card payment happens yet.

Equally: the customer must not be misled. They are placing a real order that creates a real contract. The wording must say so.

### C2. Implementation

Add a single flag:

```ts
// lib/comgate/config.ts
/** Online card payment is live. While false, orders are taken and settled by
 *  invoice/bank transfer — see the checkout interstitial. Flip to true when the
 *  Comgate contract is signed and the gateway is wired into the checkout. */
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "1";
```

Use `NEXT_PUBLIC_` here — this one is a UI state, not a secret. Default (unset) is **false**, so the safe state is the default.

When `PAYMENTS_ENABLED === false`, in `app/order/page.tsx`:

1. **Relabel the submit button** — it must not say "Pay" or "Zaplatit" when nothing is charged. Use "Odeslat objednávku" / "Submit order".
2. **Show a notice in the payment section of the form**, before the button, not only in a modal: online card payment is being activated; the order will be confirmed by email and payment arranged by bank transfer against an invoice.
3. **On submit, open a modal** the customer must actively confirm:
   - Heading: online payment not yet active
   - Body: their order will be recorded and they will be contacted by email to arrange payment by bank transfer; production starts after payment is received; the 2–4 week lead time runs from then
   - Buttons: **"Rozumím, odeslat objednávku"** (proceeds) and **"Zpět"** (cancels, returns to the form with data intact)
4. **On confirm**, run the existing order submission and continue to `/order/confirmation`.
5. **On the confirmation page**, when payments are disabled, replace the "payment received" framing with the invoice/bank-transfer explanation and repeat the lead time. Do not show a fake success state.

When `PAYMENTS_ENABLED === true`, none of the above renders and the flow is unchanged — ready for the payment wiring task to plug into.

### C3. Requirements for the modal

- Accessible: focus trap, `role="dialog"`, `aria-modal="true"`, labelled by the heading, closable with Escape, focus returns to the button.
- Not dismissible by accident — a backdrop click cancels (does not submit).
- Copy in `lib/i18n.tsx` under a new `checkout.paymentsOff.*` namespace, **Czech and English**, matching the existing key style. Czech copy must read naturally; do not machine-translate.
- Match the existing design language: Tailwind v4, indigo-600 accents, zinc neutrals, rounded-2xl, ring-1 ring-zinc-200.
- Guard against double submission — disable the confirm button while the request is in flight.

### C4. Test it

Add to `app/order/page.tsx`'s test coverage (or a new test file) the cases: modal appears when disabled, cancel does not submit, confirm submits exactly once, and nothing renders when `PAYMENTS_ENABLED` is true.

---

# Definition of done

- [ ] `COMGATE_READINESS_AUDIT.md` exists, every item PASS/FAIL/PARTIAL with file:line evidence
- [ ] Zero GoPay references outside `COMGATE_INTEGRATION_SPEC.md` history
- [ ] T&C 1.3 and Privacy 1.2 bumped in `lib/legal.ts` **and** inside all four markdown files, CZ and EN consistent
- [ ] Every A1 requirement passes, or is listed as a blocker with the reason
- [ ] Checkout completes end to end with `NEXT_PUBLIC_PAYMENTS_ENABLED` unset, showing the interstitial
- [ ] Checkout is visually and functionally unchanged with it set to `1`
- [ ] `npx tsc --noEmit`, `npx eslint`, `npx vitest run`, `npm run build` all clean
- [ ] A short summary at the top of the audit: what is ready, what blocks the Comgate application, what is deferred

# Do not

- Do not wire `lib/payments.ts` or `app/api/payment/*` into the checkout — separate task.
- Do not touch `lib/pricing.ts`, `lib/quote.ts` or `lib/rules-engine/`.
- Do not add a Content-Security-Policy in this pass — recommend one in the audit instead. An untested CSP breaks react-three-fiber.
- Do not invent legal text, dispute-body names, registration numbers or any Comgate detail beyond the entity block above. If a fact is needed and not supplied, list it as an open question in the audit.
- Do not change the §1837 custom-goods position — it is deliberate and lawyer-pending.
- Do not weaken or bypass `requireBackstage()` / `backstageApiStatus()` anywhere.
- Do not make the checkout impossible to complete. Comgate has to be able to walk it.
