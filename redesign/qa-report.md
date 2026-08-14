# Myble Redesign — QA Report (Phase 4)

**Reviewer:** QA role · **For:** Mara · **Date:** 2026-06-21
**Baseline:** [audit.md](audit.md) · **Build:** `next build` ✅ compiled successfully, TypeScript passed, all 9 routes generated, 0 errors / 0 warnings.

## Verdict: **PASS** (Wave 1) with a punch-list of follow-ups (none blocking).

The redesign converts the site from a maker tool to a problem-led, CZ-first, trust-forward storefront. Every primary-persona objection is now visibly answered on the page. Remaining items are content/instrumentation (real photos, real reviews, analytics) and live-environment verification, not code defects.

---

## Re-score vs. baseline

| Surface | Baseline | Now | Notes |
|---|:--:|:--:|---|
| Home `/` | 2/5 | **4/5** | Problem-led Czech hero + before/after, trust bar, fixed products, trust system, honest pricing. −1: reviews module is an honest empty state (no real reviews/photos yet). |
| Configurator `/design` | 1/5 | **4/5** | Presets-first, cm inputs, live price, validation (parcel rule), light 3D. −1: no dedicated measuring-guide page; no in-scene alcove overlay. |
| Checkout `/order` | 3/5 | **4/5** | Reads real design, dimension-confirmation gate, honest line items, guest checkout fixed. −1: no real payment/address validation (intentional). |
| Confirmation | 3/5 | **4/5** | Emotional moment, order #, timeline, review prompt. −1: review prompt not yet wired to a platform. |
| Auth | 2/5 | **4/5** | Guest checkout works, fully localized. −1: Google-only. |
| 5-second test | FAIL | **PASS** | Hero names the problem ("Nika 73 cm…") + before/after + price + CTA. |
| CZ-first | FAIL | **PASS** | `lang="cs"`, Czech copy throughout, CZK via `cs-CZ`. |
| Trust system | 0/6 | **5/6** | Present: samples CTA, measuring (referenced), packaging, returns, lead time, reviews module. Missing: a dedicated measuring-guide page. |
| Pricing transparency | ABSENT | **PASS** | "od" prices on home (live from model), live price in configurator, honest checkout breakdown. |
| Brand fit (premium-minimal) | 2/5 | **5/5** | White/zinc/indigo/oak, one accent, no loud gradients, no rustic 3D. |

---

## Audit issue resolution

**P0 (all resolved):** P0-1 problem-led hero ✅ · P0-2 CZ/CZK + `lang="cs"` ✅ · P0-3 maker framing removed ✅ · P0-4 products = police/skříňky/stolky (parcel rule) ✅ · P0-5 presets-first configurator (no CAD X/Y/Z) ✅ · P0-6 live price ✅ · P0-7 trust system ✅ · P0-8 home pricing ✅ · P0-9 dev placeholder removed ✅

**P1 (resolved / intentional):** P1-1 no fake testimonials (honest module) ✅ · P1-2 FAQ rewritten for personas ✅ · P1-3 dimension-confirmation step ✅ · P1-4 honest line items from model ✅ · P1-5 checkout shows the real design ✅ · P1-6 light 3D, no rustic brown ✅ · P1-7 no loud gradients ✅ · P1-8 3D lazy-loaded (`next/dynamic`, `ssr:false`, loading fallback) ✅

**P2:** P2-1 Geist wired into `--font-sans` ✅ · P2-2 tokens/brand applied ✅ · P2-3 dark-mode inversion removed ✅ · P2-4 nav reworked to new IA ✅ · P2-5 stray Polish comment gone (file removed) ✅ · P2-6 internal nav uses `next/link` ✅

## Persona-objection coverage
- "Measure wrong?" → dimension-confirmation gate + measuring-guide reference ✅ (dedicated guide page = punch-list)
- "Can't touch it?" → swatch CTA (99 Kč, credited) on home + configurator ✅
- "Arrives damaged?" → packaging + defects-handling copy on home + checkout ✅
- "Can I assemble it?" → ~30-min, numbered parts copy ✅
- "Worth it vs IKEA?" → anchored against the carpenter ✅
- "Never heard of Myble?" → honest reviews/Trustpilot module (awaiting real data) ⚠️
- "Non-returnable risk?" → explained honestly in FAQ + trust band ✅

---

## Punch-list (post-Wave-1, none blocking)

**Content**
1. Real before/after **room photography** (unlocks Direction B warmth).
2. Wire **real Google/Trustpilot reviews** + customer install photos into the reviews module.
3. Dedicated **measuring-guide page** (currently a `/#duvera` reference).

**Engineering**
4. **next-intl** scaffolding so PL/EN locales slot in (strings are currently inline Czech).
5. **Analytics + CTA A/B** instrumentation for the variants in [copy.md](copy.md).
6. Optional: in-scene **alcove "fits" overlay** in the 3D viewer.
7. Payments + persistence backend (intentionally out of scope for Wave 1).

**Verification still recommended (live env)**
8. **iPhone Safari** pass (hero, sticky mobile price bar, 3D touch-rotate).
9. **Lighthouse** performance (confirm lazy 3D keeps home LCP fast).
10. **axe / WCAG AA**: verify visible focus-visible rings on all controls, indigo-600 contrast for any small text, decorative SVGs all `aria-hidden`.

## How to verify locally
```
npm --prefix myble-webapp-project run dev
# /  → 5-sec test + trust
# /design → change cm, watch price; set width 130 → order blocks (parcel rule)
# /order → confirm dimensions to enable "Závazně objednat"
# /order/confirmation → order number + timeline
```
