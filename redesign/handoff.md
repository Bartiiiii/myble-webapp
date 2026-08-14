# Myble Website Redesign — Handoff (Wave 1)

**From:** Mara (Marketing Lead) · **Date:** 2026-06-21 · **Status:** Phase 3 built, Phase 4 QA = PASS. `next build` green.

## What changed
We turned a maker-tool-in-English into a **problem-led, CZ-first, trust-forward storefront** for our primary personas (Tereza, Jakub & Lucie). Full reasoning: [brief.md](brief.md).

**Storefront & brand**
- Czech-first everywhere (`lang="cs"`, Czech copy, CZK via `cs-CZ`), Czech-native metadata.
- Premium-minimal brand applied (white/zinc/indigo/oak); loud gradients and rustic-brown 3D removed; Geist wired in.
- Home rebuilt: Joiner-Gap hero + before/after, trust bar, how-it-works, configurator teaser, parcel-rule products, trust system, honest reviews module (no fake testimonials), pricing transparency, Czech FAQ, footer CTA.

**Configurator (`/design`)**
- Presets-first, real cm inputs, decor swatches, **always-on live CZK price**, validation that blocks impossible builds (120 cm parcel rule), light-studio parametric 3D, sticky mobile price bar. The CAD-style X/Y/Z/rotation/hex editor is gone.

**Checkout (`/order` → `/order/confirmation`)**
- Reads the actual configured design, **dimension-confirmation gate**, honest line items from the pricing model, guest checkout (forced-login redirect removed), emotional confirmation with order number + timeline.

## Files
- New: `lib/design.ts`, `components/ShelfViewer.tsx`, `redesign/*`
- Rewritten: `app/page.tsx`, `app/design/page.tsx`, `app/order/page.tsx`, `app/order/confirmation/page.tsx`, `app/login/page.tsx`, `app/order/login/page.tsx`, `components/HomeNavAuth.tsx`, `app/layout.tsx`, `app/globals.css`
- Removed: `components/CabinetViewer.tsx` (unused)

## Deliverables in `redesign/`
`audit.md` · `research.md` · `brief.md` · `design-direction.md` · `copy.md` · `qa-report.md` · `handoff.md`

## What's left (see [qa-report.md](qa-report.md) punch-list)
Real photography, real reviews integration, dedicated measuring-guide page, next-intl for PL/EN, analytics + CTA A/B, payments backend, and live iPhone-Safari / Lighthouse / axe verification.

## Recommended A/B tests (from [copy.md](copy.md))
- Hero headline: "Nika 73 cm…" vs "Mezera, kterou nábytek z obchodu nikdy nevyplní."
- Hero CTA: "Navrhnout svůj kus" vs "Spustit konfigurátor"
- Footer CTA: "Navrhnout svůj kus" vs "Začít zdarma →"

## Not done (by design)
No payments/persistence backend; reviews module intentionally shows an honest empty state until real reviews exist (we will not ship fabricated testimonials).
