# Myble — Design Direction (Phase 2)

**For founder approval.** Synthesizes [audit.md](audit.md) + [research.md](research.md) + the Deep Dive. Copy lives in [copy.md](copy.md).
**Do not build until this is approved.**

---

## 1. Design principles
1. **Problem first, in 5 seconds.** Above the fold answers: *Is this for my awkward space? Will it fit? Can I trust it? What does it cost?*
2. **Show the fit.** Every key moment shows a space being filled to the millimetre (before → after, live render, cm inputs).
3. **Trust is a feature, not a footer.** Reviews, samples, measuring, packaging, returns, lead time are designed modules, surfaced early.
4. **Calm premium.** One accent (indigo), generous whitespace, soft shadows, restrained motion. Czech-first, CZK-native.
5. **Self-serve dignity.** Instant price, no consultation wall, no jargon, no CAD.

---

## 2. Information architecture

**Primary nav (CZ):** Jak to funguje · Co nabízíme (Police / Skříňky / Stolky) · Cena · Recenze · *[Navrhnout svůj kus → /design]* (primary button) · Přihlásit
**Conversion path:** `/` → `/design` (presets-first, instant price) → `/order` (login *after* design; guest allowed) → `/order/confirmation`
**Footer:** product links, company, support, trust badges (Trustpilot, secure pay, made in CZ), language switch (CZ ▸ PL/EN later), legal.

### Home page section order
1. Hero — Joiner-Gap hook + live-config CTA + "od 2 490 Kč" + before/after
2. Trust bar — Trustpilot stars · počet objednávek · "Vyrobeno v ČR" · doručení Zásilkovna/PPL
3. How it works — Navrhněte → Objednejte → Sestavte (one proof line each)
4. Configurator teaser — presets + "fits your space to the mm" + Start CTA
5. Awkward-space proof — before/after gallery (alcove, nook, hallway)
6. What we make — Police / Skříňky / Stolky, each "od …Kč"
7. Trust system band — samples · measuring guide · packaging · returns · lead time
8. Reviews — real Czech reviews + install photos
9. Pricing transparency — anchor vs carpenter (not IKEA)
10. FAQ — measuring, lead time, assembly, returns, damage, decors
11. Footer CTA — "Vyřešte svou mezeru ještě dnes"

---

## 3. Visual system (design tokens)

### Color
```
--bg            #FFFFFF   page
--surface       #FAFAFA   zinc-50 cards/sections
--surface-2     #F4F4F5   zinc-100 insets
--border        #E4E4E7   zinc-200 hairlines
--ink           #18181B   zinc-900 headings
--ink-soft      #52525B   zinc-600 body
--ink-mute      #A1A1AA   zinc-400 meta
--brand         #4F46E5   indigo-600 primary action/accent
--brand-ink     #4338CA   indigo-700 hover/active
--brand-wash    rgba(79,70,229,0.08)  tints/rings
--success       #059669   emerald-600 confirmations
--warn          #D97706   amber-600 validation
--star          #F59E0B   amber-500 ratings
```
Decor swatches (3D + UI): **Bílá** #F3F1EC · **Dub** #C9A36B · **Grafit** #3F3F46 (replaces rustic browns).
*Single accent only. No multi-hue gradients. Backgrounds neutral; indigo earns attention.*

### Type
Sans: **Geist** (already loaded — wire it into `--font-sans`; fixes the Arial fallback). Scale (clamp, fluid):
```
Display  48–64px / 1.05 / -0.02em   hero H1
H2       32–40px / 1.1  / -0.01em
H3       20–24px / 1.2
Body-L   18px / 1.6                  hero sub, intros
Body     16px / 1.6
Small    14px / 1.5                  meta, captions
```

### Spacing / radius / shadow / motion
```
space:  4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96   (Tailwind scale)
section padding: py-16 mobile / py-24 desktop; container max-w-6xl
radius: sm 12px · md 16px (rounded-2xl) · lg 24px (rounded-3xl) · pill 9999px
shadow-soft:  0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.12)
shadow-lift:  0 12px 40px -16px rgba(0,0,0,.18)   (hover/hero)
motion: 150–250ms ease-out; fade+rise 8px on scroll; respect prefers-reduced-motion
focus: 2px ring var(--brand) + 2px offset on every interactive element (a11y)
```

### Component inventory (Tailwind components to build)
`Button` (primary/secondary/ghost) · `PriceTag` (live, animated number) · `SwatchPicker` · `DimensionInput` (cm, with min/max validation + helper) · `PresetCard` · `TrustBadge` · `ReviewCard` (real) · `StarRow` · `BeforeAfter` (slider) · `StepCard` · `FAQItem` · `SectionHeader` · `Navbar` (sticky, condensed on scroll) · `Footer`.

---

## 4. Low-fi wireframes (key screens)

### Home — hero
```
┌─────────────────────────────────────────────────────────────┐
│  Myble        Jak to funguje  Co nabízíme  Cena  Recenze  [Navrhnout]│
├─────────────────────────────────────────────────────────────┤
│  ⭐ 4,9/5 na Google · 1 200+ vyřešených mezer · Vyrobeno v ČR │
│                                                              │
│  Nika 73 cm, do které           ┌───────────────────────┐   │
│  se nic nevejde?                 │  BEFORE  │   AFTER     │   │
│                                  │ prázdná  │ police na   │   │
│  Nábytek na míru přesně na cm.   │  nika    │ míru, sedí  │   │
│  Navrhněte za 5 min, sestavte    │  ▢       │ ▦▦▦ na cm   │   │
│  za 30.                          └───────────────────────┘   │
│                                   (interactive before/after) │
│  [ Navrhnout svůj kus ]  Jak to funguje →                    │
│  Police na míru už od 2 490 Kč · doručení po ČR              │
└─────────────────────────────────────────────────────────────┘
```

### /design — presets-first configurator
```
┌───────────────────────────────────────────────────────────────┐
│ ← Myble                                  Vaše cena: 2 690 Kč ▸  │
├───────────────┬───────────────────────────────────────────────┤
│ 1 VYBERTE TYP │                                               │
│ [Police] [Sk.]│              ┌─────────────────────┐          │
│ [Stolek]      │              │   LIGHT 3D PREVIEW   │          │
│               │              │  white studio bg,    │          │
│ 2 ROZMĚRY     │              │  oak/white/graphite  │          │
│ Šířka  [73]cm │              │  unit fitted in a    │          │
│ Výška [180]cm │              │  faint alcove guide  │          │
│ Hloubka[35]cm │              └─────────────────────┘          │
│ ⓘ sedí do niky│   ✓ Sedí do vašeho prostoru na milimetr        │
│               │   ⚠ Max šířka dílu 120 cm (parcel rule)        │
│ 3 DEKOR       │                                               │
│ ◻Bílá ◻Dub ◻Gr│   [ Pokračovat k objednávce → ]               │
│ 4 POLICE  [+] │   Vzorník dekorů poštou za 99 Kč (odečteme)    │
└───────────────┴───────────────────────────────────────────────┘
```
Hide raw X/Y/Z/rotation/hex. Inputs are real cm with live validation; price updates on every change; presets seed a good-looking start.

### /order — trust-forward checkout w/ dimension confirmation
```
┌──────────────────────────────┬────────────────────────────┐
│ KONTAKT  [jméno][e-mail][tel] │  VÁŠ NÁVRH (real render)    │
│ ADRESA   [ulice][město][PSČ]  │  Police · Dub · 73×180×35   │
│ DORUČENÍ ◉Zásilkovna ○PPL     │  ───────────────            │
│                               │  Kit na míru     2 490 Kč   │
│ ✅ POTVRĎTE ROZMĚRY           │  Doručení          199 Kč   │
│  Šířka 73 cm  [potvrzuji]     │  ───────────────            │
│  „Změřeno dle návodu"  ☑      │  Celkem vč. DPH  2 689 Kč   │
│  → odkaz na návod měření      │  [ Závazně objednat ]       │
│                               │  🔒 Bezpečná platba · vady  │
│                               │     řešíme férově           │
└──────────────────────────────┴────────────────────────────┘
```

### /order/confirmation — emotional moment
```
        ✓ (emerald)   Objednávka přijata — č. MB-2026-0427
        „Vaše mezera má řešení."
   Co bude dál:  ▸ potvrzení e-mailem  ▸ výroba 5–8 dní
                 ▸ doručení + sledování  ▸ návod na sestavení
   [ Sledovat objednávku ]   [ Sdílet / ohodnotit nás ]
   Trust strip: vyrobeno v ČR · vady řešíme férově
```

---

## 5. 3D / configurator restyle
- **Light studio environment** (soft neutral), unit on a subtle floor shadow — not zinc-950/black.
- Materials = the three laminated decors (bílá/dub/grafit) with low roughness, no rustic brown.
- Show a faint **alcove guide box** around the unit so "fits your space" is literal.
- **Performance:** `next/dynamic({ ssr:false })` + `<Suspense>` poster image; mount Canvas only when in view; pause auto-rotate offscreen and on `prefers-reduced-motion`. Keep @react-three/fiber + the existing GLB; restyle lights/env/materials only.

## 6. Mobile-first & accessibility
- Single-column stacks; sticky bottom bar on `/design` showing **live price + Continue** (thumb-reachable for Jakub on the phone).
- Tap targets ≥44px; cm inputs use numeric keypad; before/after is swipe on touch.
- WCAG AA: semantic landmarks, visible focus rings, alt text on all proof imagery, labelled inputs, accordion with proper `aria-expanded`, AA contrast (indigo-600 on white passes for large/UI; use ink for body).

## 7. The two directions (pick one)
- **A — Calm Utility (recommended):** clean white, configurator + instant price are the hero's right half (live), trust bar immediately under. Fast to build, maximal trust, lowest photography dependency.
- **B — Editorial Warmth:** full-bleed lifestyle before/after photography, larger display type, magazine spacing. Warmer and more aspirational; needs real install photos to not feel like stock.
- **Recommendation:** **A's structure + B's before/after proof.** Same tokens/IA/copy either way, so approval of A doesn't block borrowing B's imagery later.

## 8. Hand-off notes for Phase 3 (build, after approval)
Set tokens in `globals.css` (@theme), fix Geist font var, add `<html lang="cs">`, Czech metadata. Build shared `components/ui/*`. Restyle existing pages in place; keep routes. Wire CTAs to existing flow (no payments backend) — "Závazně objednat" → `/order/confirmation` with a generated mock order number. Localize all strings (structure for next-intl later).
