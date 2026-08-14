# Myble Website Audit — Current Build vs. Target Customer

**Auditor:** Marketing team (Site Auditor role) · **For:** Mara (Marketing Lead) · **Date:** 2026-06-21
**Scope:** `myble-webapp-project` — Next.js 16 (App Router, TS, Tailwind v4, @react-three/fiber)
**Benchmark:** Does the site make **Tereza** (niche-filler) and **Jakub & Lucie** (new-build family) feel *"this fits my space, and I trust it"*?

---

## Executive summary — the 8 things sabotaging conversion

1. **The site sells to the wrong customer.** Everything is framed as a *maker / community design tool* ("Create your own furniture", "Figma for furniture", "Community Designs", "remix", "34 prototypes by a maker collective"). Our buyer is not a maker — she has a 73 cm alcove and wants it solved. **Zero** of the persona's actual problem (the Joiner Gap) appears anywhere. This is the single biggest issue.
2. **It's in English.** Required market is **CZ-first (Czech copy, CZK)**. `lang="en"`, English nav, English metadata, English everything. A Czech buyer searching *"police na míru"* lands on a foreign-feeling site.
3. **The product catalogue breaks our own model.** Featured "designs" are a **modular sofa, a lounge chair, an extendable dining table** — all anti-persona, all violating the parcel rule (≤120 cm edge, ≤25–30 kg, flat-pack). We should be showing shelves, alcove units, side tables, slim wardrobes.
4. **The configurator is a CAD tool, not a storefront.** `/design` exposes raw `X/Y/Z` position, `Rotation Y`, abstract unit dimensions (`1.8`, `0.12`), per-plank hex color pickers, and a literal dev to-do note. There is **no price, no presets, no "fits your space", no validation**. Tereza bounces in 10 seconds.
5. **The entire trust system is missing.** No reviews/Trustpilot, no swatch samples, no measuring guide, no packaging/damage reassurance, no returns explainer, no honest lead time. For an unknown brand selling non-returnable, can't-touch-it goods, **this is the conversion lever** — and it's absent.
6. **No pricing transparency on the storefront.** The home page never says *"from CZK 2,490."* Pricing only appears at `/order` as a single hardcoded `3 490 CZK`. Our whole wedge vs. Czech incumbents is *instant, visible price* — we're hiding it.
7. **Brand drifts off "premium-minimal."** Loud indigo/fuchsia radial gradients, a yellow→pink→purple footer gradient, and a **rustic brown** 3D model on a near-black viewer background — the opposite of "Scandinavian premium + tech precision" (white/zinc/indigo/oak).
8. **No real trust at checkout.** `/order` has no dimension-confirmation step (our #1 anxiety neutraliser), no trust badges, fabricated price line items ("Production prep 400 CZK"), and the design preview is hardcoded — not the user's actual design.

**5-second test verdict (home hero): FAIL.** "Create your own furniture" + a slowly auto-rotating brown cabinet tells Tereza nothing about *her alcove*. She cannot tell in 5 seconds that this solves her problem, fits her space, or can be trusted.

---

## Prioritized issue list

### P0 — Blocks conversion / speaks to the wrong customer

| # | Issue | Hurts | Evidence | Fix |
|---|-------|-------|----------|-----|
| P0-1 | Hero is product-led & generic ("Create your own furniture") | All personas; 5-sec test | `app/page.tsx:312`, sub-copy `:315` | Lead with the Joiner-Gap problem ("Ta 73cm nika, do které se nic nevejde?") + live-config CTA + before/after of an alcove |
| P0-2 | Whole site in English, `lang="en"` | CZ market | `app/layout.tsx:27`, metadata `:16-19`, all pages | Czech-first copy + CZK; structure for PL/EN locale later |
| P0-3 | Maker/community positioning throughout ("Figma for furniture", "Community Designs", "remix") | Tereza, Jakub | `app/page.tsx:194,369-428,372-379` | Reframe to "made-to-measure that fits your space" for end customers; cut "community/remix" |
| P0-4 | Featured products are anti-persona & break parcel rule (modular sofa, lounge chair, dining table) | Brand/model integrity | `app/page.tsx:159-188` | Replace with shelves, alcove units, side tables, slim wardrobes (≤120 cm, flat-pack) |
| P0-5 | Configurator exposes CAD internals (X/Y/Z, Rotation Y, abstract units, hex pickers) | Tereza, Jakub, Marek | `app/design/page.tsx:465-522` | Presets-first; enter real cm for the space; curated decors (white/oak/black); hide raw transforms |
| P0-6 | No live price anywhere in the configurator | All; core wedge | `app/design/page.tsx` (none present) | Persistent instant-price as dimensions/decor change |
| P0-7 | No trust system (reviews, swatches, measuring guide, packaging, returns, lead time) | Jakub especially | Absent across all pages | Build cross-cutting trust modules (see brief) |
| P0-8 | No pricing transparency on home ("from CZK 2,490") | Tereza | `app/page.tsx` (none) | Pricing-teaser band + per-template "from" prices |
| P0-9 | Dev/placeholder content shipped to prod ("Next useful upgrade… saving projects to a database") | Credibility | `app/design/page.tsx:550-556` | Remove; replace with customer-facing reassurance |

### P1 — Major

| # | Issue | Hurts | Evidence | Fix |
|---|-------|-------|----------|-----|
| P1-1 | Fake placeholder testimonials (Tailwind UI names: Leslie Alexander, Tom Cook…) | "Never heard of Myble" | `app/page.tsx:190-236` | Real Czech reviews/Trustpilot + real install photos from day one |
| P1-2 | FAQ answers the wrong audience ("manufacturing-ready specs", "share a design", "API") | Tereza, Jakub | `app/page.tsx:238-266` | Replace with: measuring, lead time, assembly, returns/defects, damage, decors |
| P1-3 | No dimension-confirmation step at checkout | "What if I measure wrong" | `app/order/page.tsx` (absent) | Add explicit "confirm your dimensions" gate before Place order |
| P1-4 | Checkout price & line items hardcoded/fabricated ("Production prep 400 CZK") | Trust | `app/order/page.tsx:282,290-292` | Derive from the design; honest line items (kit, delivery, VAT) |
| P1-5 | Checkout preview is a hardcoded cabinet, not the user's design | Trust, "looks as good as render" | `app/order/page.tsx:21-110` | Render the actual configured design (or persist + replay) |
| P1-6 | 3D model is rustic brown on near-black viewer | Premium-minimal brand | `components/CabinetViewer.tsx:31`, `app/design/page.tsx:36,131-180` | Light studio bg; white/oak/graphite laminated decors |
| P1-7 | Loud gradients (indigo/fuchsia radials, yellow→pink→purple footer) | Brand | `app/page.tsx:271-272,308,480` | Calm white/zinc; indigo as a single restrained accent |
| P1-8 | 3D mounts eagerly, no lazy-load/Suspense/fallback; auto-rotate always on | Mobile perf (Jakub on phone) | `app/page.tsx:71-73`, `components/CabinetViewer.tsx:32-41` | `next/dynamic` + Suspense + poster image; pause when offscreen |

### P2 — Polish

| # | Issue | Evidence | Fix |
|---|-------|----------|-----|
| P2-1 | Body font falls back to Arial despite Geist being loaded | `app/globals.css:25` vs `app/layout.tsx:6-12` | Wire `--font-geist-sans` into the body font stack |
| P2-2 | No design tokens — globals.css is Next.js boilerplate | `app/globals.css:1-27` | Define color/space/radius/shadow/type tokens (brand system) |
| P2-3 | Dark-mode `prefers-color-scheme` block inverts an all-light design | `app/globals.css:15-20` | Remove or design a real dark theme |
| P2-4 | Anchor nav links (`#product`, `#community`) point at maker sections | `app/page.tsx:285-298` | Rework nav to match new IA |
| P2-5 | Leftover Polish dev comment in shipped component | `components/CabinetViewer.tsx:39` | Remove |
| P2-6 | Mixed `<a>` vs `<Link>` for internal nav (full reloads) | `app/page.tsx:328,497`, etc. | Use `next/link` for internal routes |

---

## Per-page scorecard
*"Does this make Tereza/Jakub feel 'this is for me, and I trust it'?" (1 = no, 5 = absolutely)*

| Page | Score | Why |
|------|:---:|-----|
| **Home `/`** | **2/5** | Polished shell, but wrong story (maker/community), wrong products (sofas/chairs), English, no problem hook, no price, no real trust. Tereza doesn't see her alcove. |
| **Configurator `/design`** | **1/5** | A CAD plank-editor with raw X/Y/Z, abstract units, no price, no presets, no validation, plus a dev to-do note. Actively repels a non-technical buyer. |
| **Checkout `/order`** | **3/5** | Cleanest page; good structure & CZK. But no dimension-confirmation, hardcoded/fabricated pricing, generic preview, no trust signals, English. |
| **Confirmation `/order/confirmation`** | **3/5** | Calm and reassuring; lacks an emotional "moment", order number, real next-steps timeline, and review/photo prompt. English. |
| **Auth (`/login`, `/order/login`)** | **2/5** | Functional NextAuth gate; forcing login before checkout adds friction at the worst moment. Consider guest checkout / login-after-design. |

### Baseline scores (for QA to re-score against)
```
Home:           2/5
Configurator:   1/5
Checkout:       3/5
Confirmation:   3/5
Auth:           2/5
5-second test:  FAIL
CZ-first:       FAIL (English, but CZK present at checkout)
Trust system:   0 of 6 modules present (reviews, swatches, measuring guide, packaging, returns, lead time)
Pricing transparency on home: ABSENT
Brand fit (premium-minimal): 2/5 (loud gradients, rustic 3D)
```
