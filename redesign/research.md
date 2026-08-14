# Myble Design Research — Benchmarks & Patterns to Steal

**Researcher:** Marketing team (Design Researcher role) · **For:** Mara · **Date:** 2026-06-21
**Question:** What does world-class look like for a premium made-to-measure configurator-commerce site, and what fits Myble (CZ-first, problem-led, premium-minimal)?

> Sourcing note: Tylko's own site blocked direct fetching (HTTP 403), so Tylko specifics below are triangulated from search summaries + public reviews (cited). Kanclik and the CZ/PL competitor patterns were fetched/searched directly. Craft references (Linear/Stripe/etc.) are from established, widely-documented patterns.

---

## TL;DR for Mara — the 10 highest-leverage patterns to steal

1. **Sell "fits to the last centimetre," not "custom furniture."** Tylko's entire wedge is *CustomFit® — down to the last centimetre*. That's our Joiner-Gap hook made concrete. Lead the hero with it.
2. **Configurator is the hero, but entered via presets.** Best-in-class drops you into a *good-looking starting design* you then adjust — never a blank CAD canvas. (We currently do the opposite.)
3. **Instant price, always visible.** Every credible self-serve competitor (Tylko, BRW, Kanclik) shows a live price that updates as you configure. Czech incumbents that *don't* (AMONIT "calculation within 24h", consultation-gated joiners) are exactly who we beat.
4. **AR / "see it in your room."** Tylko's signature trust-closer. We can't ship AR in Wave 1, but a realistic in-room render + a measuring guide is the affordable substitute.
5. **Real reviews, surfaced early and specifically.** Kanclik shows Google + Firmy.cz ratings and *"Zakoupilo již 79 osob"* (79 people bought this). Social proof + scarcity/popularity, localised.
6. **Make delivery & returns a feature, not fine print.** Tylko's #1 review complaints are *delivery damage and slow/length returns* — turn those into our visible promises (courier-proof packaging, honest defects-only returns).
7. **"How it works" in 3 calm steps.** Design → Order → Assemble, each with a one-line reassurance (instant price / fast lead time / 30-min tool-light build).
8. **Premium-minimal craft = restraint.** Linear/Stripe/Vercel/Apple: one accent colour, huge whitespace, a real type scale, soft shadows, subtle motion. No loud gradients, no rustic wood.
9. **Lifestyle proof beats product shots.** Show the awkward space *before* and the fitted unit *after*, in a real Czech-looking flat — not a floating cabinet on black.
10. **Czech-first, end-to-end.** Czech copy, CZK, Czech reviews, Czech delivery names (Zásilkovna/PPL/DPD). The incumbents feel local; a foreign-feeling site loses on trust instantly.

---

## Annotated benchmark table

| Pattern | Best example (URL) | What they do | Verdict | Serves persona / objection |
|---|---|---|---|---|
| **"Down to the cm" value prop** | [Tylko](https://tylko.com/en-ot) · [Design-Milk](https://design-milk.com/create-a-completely-customized-shelving-unit-with-tylko-type02/) | "CustomFit®… right down to the last centimetre" — fit IS the brand | **STEAL** | Tereza · "nothing fits my alcove" |
| **Presets-first configurator** | Tylko, [BRW](https://www.brw.pl/meble-na-wymiar/) | Start from a good design + adjust; never a blank canvas | **STEAL** | All · "<5 min or bounce" |
| **Always-visible instant price** | [Kanclik](https://www.kanclik.cz/nabytek-na-miru), [BRW](https://www.brw.pl/zaprojektuj-sam/) | "Konečná cena se Vám zobrazí ihned" / real-time price | **STEAL** | Tereza, Jakub · "just want a number" |
| **AR "see it in your room"** | Tylko (CustomFit + AR app) | Preview the unit at scale in your space | **ADAPT** (render + measuring guide in Wave 1; AR later) | Tereza · "can't picture it / will it fit" |
| **Reviews surfaced early + local** | [Kanclik](https://www.kanclik.cz/nabytek-na-miru), [Tylko Trustpilot 4★](https://www.trustpilot.com/review/tylko.com) | Google/Firmy.cz stars; "Zakoupilo již 79 osob" | **STEAL** | Jakub · "never heard of Myble" |
| **Delivery/returns as a promise** | Tylko (learning from its [complaints](https://www.trustpilot.com/review/tylko.com)) | — their weakness; we make it a strength | **STEAL the gap** | Jakub · "arrives damaged / non-returnable" |
| **Clear, personalised assembly** | Tylko (praised: "clear, personalized instructions") | Per-design numbered instructions | **STEAL** | Jakub, Marek · "can I assemble it" |
| **3-step "how it works"** | Stripe, Vercel, Apple | Calm 3-up with one-line proof each | **STEAL** | All · comprehension |
| **Hero clarity + restraint** | [Linear](https://linear.app), [Stripe](https://stripe.com) | One idea, huge type, one accent, one CTA | **STEAL** | 5-second test |
| **Lifestyle before/after** | Tylko, IKEA room sets | Real rooms, real fit | **STEAL** | Tereza · proof it looks intentional |
| **Sustainability / made-to-order story** | Tylko (on-demand, no overproduction) | "made only when ordered, ships flat" | **ADAPT** (secondary) | Younger buyers · values |
| **Consultation-gated quotes** | AMONIT (["calculation within 24h"](https://www.amonit.cz/)), Komandor, many CZ joiners | Hide price behind a form/visit | **AVOID** (this is what we beat) | — |
| **Maker/community/remix framing** | (our current site) | "Figma for furniture", remixable sofas | **AVOID** (wrong customer) | — |
| **Loud gradients / rustic wood** | (our current site) | fuchsia radials, brown cabinet on black | **AVOID** (off-brand) | — |

---

## Tylko deep-dive — the category leader, and how to beat it CZ-first

**Their funnel (triangulated):** lifestyle-led hero of shelving in real rooms → enter configurator from a template → personalise size/colour/finish/doors/drawers/back panels *to the cm* (parametric "CustomFit®") → AR preview in your room → made-to-order, ships flat, assemble at home. Trust rests on 4★ Trustpilot (thousands of reviews), praised product quality and *clear, personalised assembly instructions*.

**Where they're beatable (our opening):**
- **Czech-first.** Tylko is pan-EU/English-default; no Czech-native storefront, CZK, or local reviews/couriers. We are local by design.
- **Price & complexity tier.** Tylko skews to larger wall storage/wardrobes at higher prices and **mixed delivery experiences** ([Trustpilot: delivery delays, defects, returns up to ~1.5 months](https://www.trustpilot.com/review/tylko.com)). We start *simpler and smaller* (shelf ~CZK 2,490, side tables), parcel-shippable, with **damage-proofing and honest defects-only returns as headline promises** — directly answering their top complaints.
- **Speed of "aha".** We can be even faster to an instant price on a single awkward-space piece, with a measuring guide that removes the fit anxiety up front.

**What to match (table stakes):** instant price, presets-first, cm-accurate fit language, realistic preview, clear per-design assembly, real reviews.

---

## CZ/PL competitor landscape — weaknesses to exploit

**Czech (our launch market):**
- **Kanclik.cz** — closest model: *"Mít nábytek na míru nebylo nikdy snadnější"*, 3-step (type → rozměry → dekor/kování), **instant CZK price** ("Konečná cena se Vám zobrazí ihned"), social proof ("Zakoupilo již 79 osob"), Google/Firmy.cz reviews, in-stock + delivery dates. **Strong mechanics, utilitarian brand** — we beat it on premium-minimal craft + problem-led storytelling + trust polish. ([source](https://www.kanclik.cz/nabytek-na-miru))
- **AMONIT** — built-in wardrobes; "calculation within 24 hours" = **not instant**, discount-driven. ([source](https://www.amonit.cz/))
- **KOMANDOR** — wardrobes, "immediate pricing offer" but showroom/discount vibe (30% off "until June 2026"). ([source](https://www.skrine-komandor.cz/))
- **Sestav si nábytek**, **SIKO Plánovač**, **Marysko** ("realization within 20 working days"), **Dřevojas** (bathroom) — varying degrees of online planning; mostly bigger built-ins, none own the *small awkward-space, premium, instant* niche. ([sestavsinabytek](https://www.sestavsinabytek.cz/) · [SIKO](https://nabytek-na-miru.siko.cz/) · [Marysko](https://maryskonabyteknamiru.cz/))

**Polish (expansion):**
- **BRW (Black Red White)** — [real-time price configurator, delivery in days](https://www.brw.pl/meble-na-wymiar/); big, mainstream, less premium-minimal.
- **meble.pl**, **Flexmeble**, **Ewodd**, **Kronosfera/Meblosfera**, **MebWay** — configurators / cut-to-size; **mine their reviews** for the top complaints (delivery damage, lead times, confusing configurators, poor instructions) → these become Myble's spec sheet & trust copy. ([meble.pl](https://www.meble.pl/na-wymiar/) · [Flexmeble](https://flexmeble.com/) · [Ewodd](https://ewodd.com/kategoria-produktu/konfigurator-mebli/))

**The white space:** a **Czech-first, premium-minimal, problem-led, instant-price storefront for small parcel-shippable made-to-measure pieces (shelves, alcove units, side tables)** — with trust (samples, measuring guide, reviews, damage-proof packaging, honest returns) as a first-class system. No one owns this exact square.

---

## Pattern shortlist for the Designer (turn these into wireframes)

1. **Hero** — problem-led headline ("Ta 73cm nika, do které se nic nevejde?"), one-line value ("Nábytek na míru přesně na centimetr — navrženo za 5 minut, smontováno za 30"), primary CTA *Navrhnout svůj kus* into the configurator, secondary *Jak to funguje*. Visual: real alcove **before → fitted unit after**, light/airy. From CZK 2,490 visible.
2. **How it works** — 3 calm steps: Navrhni (instant price) → Objednej (rychlé dodání) → Sestav (30 min, bez nářadí).
3. **Configurator entry** — preset gallery first (alcove shelf, side table, slim wardrobe), then "enter your space" cm inputs, decor swatches (white/oak/graphite), **persistent live price**, validation that blocks impossible builds, "fits to the mm" reassurance.
4. **Trust system (cross-cutting)** — review band (Google/Trustpilot + real install photos), swatch-sample CTA (~CZK 99, credited), measuring guide, courier-proof packaging explainer, honest defects-only returns, clear lead time.
5. **Pricing transparency** — per-template "from" prices + a simple, honest checkout breakdown (kit, delivery, VAT incl.).
6. **Checkout** — dimension-confirmation step before pay; render of the *actual* design; trust badges; emotional confirmation moment (order #, timeline, review prompt).

---

## Sources
- Tylko: [tylko.com](https://tylko.com/en-ot) · [Wall storage](https://tylko.com/en-ot/furniture-c/wallstorage) · [FAQ: configurator](https://tylko.com/en-ot/faq/articles/customisation/what-is-the-configurator) · [Design-Milk](https://design-milk.com/create-a-completely-customized-shelving-unit-with-tylko-type02/) · [It's Nice That](https://www.itsnicethat.com/articles/tylko-parametric-furniture-shelving-product-design-021017) · [Trustpilot (4★)](https://www.trustpilot.com/review/tylko.com)
- CZ: [Kanclik](https://www.kanclik.cz/nabytek-na-miru) · [AMONIT](https://www.amonit.cz/) · [KOMANDOR](https://www.skrine-komandor.cz/) · [Sestav si nábytek](https://www.sestavsinabytek.cz/) · [SIKO](https://nabytek-na-miru.siko.cz/) · [Marysko](https://maryskonabyteknamiru.cz/) · [Dřevojas](https://www.drevojas.cz/cs/m-648-nabytek-na-miru)
- PL: [BRW](https://www.brw.pl/meble-na-wymiar/) · [BRW Zaprojektuj sam](https://www.brw.pl/zaprojektuj-sam/) · [meble.pl](https://www.meble.pl/na-wymiar/) · [Flexmeble](https://flexmeble.com/) · [Ewodd](https://ewodd.com/kategoria-produktu/konfigurator-mebli/) · [Kronosfera](https://kronosfera.pl/p/meblosfera-meble-na-wymiar---konfigurator,290) · [MebWay](https://mebway.pl/meble-na-wymiar.html)
- Craft references: [Linear](https://linear.app) · [Stripe](https://stripe.com) · [Vercel](https://vercel.com) · [Framer](https://framer.com) · [Apple](https://apple.com) · [Notion](https://notion.so)
