# Myble — Brand Guidelines v1.0

**July 2026 · CZ-first, PL/EN ready.** The single source of truth for how Myble looks, sounds and moves. Everything here serves one buyer: the design-aware urban 25–45 with an awkward space nothing standard fits.

---

## 1. Brand strategy

### What Myble is
A web platform where you design furniture for your exact space in a 3D configurator, see the price instantly, and receive a precision-cut flat-pack kit you assemble in ~30 minutes.

### The one-line thesis
**Carpenter-level fit at near-IKEA convenience.**

### Positioning
Between mass furniture (cheap, fixed sizes, leaves gaps) and bespoke carpentry (perfect fit, 2–4× price, 8–16 weeks, opaque quotes). We are the self-serve, instant-price middle that the Czech market does not have.

### Core metaphor — "The Exact Fit"
Every brand decision expresses one image: **a gap, filled exactly.** The 73 cm alcove that defeated three IKEA units, finally holding a piece that looks like the building was designed around it.

### Personality (in order)
1. **Precise** — millimetres are our product. Numbers are exact, never rounded for effect.
2. **Calm** — no urgency tricks, no discount theatre. Confidence whispers.
3. **Self-serve dignity** — the customer is smart. No consultation walls, no jargon, no upsell pressure.
4. **Warm underneath** — the product lives in real homes. Material warmth belongs to imagery; the interface stays cool and exact.

### What Myble is not
Not a DIY tool shop. Not rustic carpentry romance. Not a luxury atelier. Not an IKEA clone. Never cluttered, never loud, never salesy.

---

## 2. Logo

### The mark
A shelving frame with **offset shelves** (the way real Myble designs are built) and one compartment holding a **fitted accent block** — your piece, in your gap. It is simultaneously: a piece of Myble furniture, a floor plan of a niche, and a map with "you are here."

Files: `public/brand/myble-mark.svg` (light surfaces) · `myble-mark-dark.svg` (dark surfaces) · `myble-tile.svg` (app icon / avatar) · favicon at `app/icon.svg`.

### The wordmark
**myble** — always lowercase, Geist SemiBold, tracking `-0.02em`, ink (`#18181B`) on light / `#FAFAFA` on dark. The lockup is the mark + wordmark with a gap of 0.45× mark height, rendered by the `<Logo />` component (`components/SiteHeader.tsx`).

### Rules
- Clear space around the lockup: minimum = height of the accent block × 2.
- Minimum mark size 20 px; below that use the tile.
- Never recolor the mark outside the approved pairs, never rotate, never add shadows or gradients to it.
- The accent block is the only colored element. It never moves cells.

---

## 3. Color

Two worlds, one system: a **cool, exact interface** and a **warm material world** (photography, 3D scenes, decors). The tension between them is the brand.

### Interface palette (cool, zinc-based)
| Token | Hex | Role |
|---|---|---|
| `--ink` | `#18181B` | Headlines, logo, primary dark surfaces |
| `--ink-soft` | `#52525B` | Body text |
| `--ink-mute` | `#A1A1AA` | Meta, captions |
| `--paper` | `#FFFFFF` | Page background |
| `--surface` | `#FAFAFA` | Cards, alternate sections |
| `--surface-2` | `#F4F4F5` | Insets, wells |
| `--line` | `#E4E4E7` | Hairlines, rings |
| `--brand` | `#4F46E5` | Myble Indigo — the single accent. CTAs, links, the accent block |
| `--brand-deep` | `#4338CA` | Hover / active |
| `--brand-soft` | `#EEF2FF` | Tints, washes |
| `--brand-bright` | `#818CF8` | Accent on dark surfaces |

One accent only. Indigo earns attention; it never decorates.

### Material world (warm — imagery and 3D only, never UI chrome)
| Name | Hex | Role |
|---|---|---|
| Niche | `#ECE7DF` | 3D scene wall / photography backdrop |
| Bílá (white lacquer) | `#F3F1EC` | Decor |
| Dub (oak) | `#C9A36B` | Decor |
| Grafit (graphite) | `#3F3F46` | Decor |

### Semantic
Success `#059669` · Warning `#D97706` · Ratings `#F59E0B`. Used only for state, never decoration.

---

## 4. Typography

| Use | Face | Notes |
|---|---|---|
| Display & headlines | **Geist** SemiBold | Tracking -0.02em to -0.03em, leading 1.02–1.1. Big and confident, never shouty |
| Body & UI | **Geist** Regular/Medium | 16 px+, leading 1.6 |
| **Dimensions, prices, part counts** | **Geist Mono** Medium | The brand signature. Every measurement renders in mono: `728 mm`, `2 490 Kč`, `30 min` |

The mono-dimension rule is what makes a Myble layout recognisably Myble. Numbers that describe fit are product, and they dress like product.

Type scale (fluid): Display 44–68 px · H2 30–40 px · H3 20–24 px · Body-L 18 px · Body 16 px · Small 14 px · Mono-meta 13 px.

---

## 5. Voice

**Problem first, product second.** Open on the gap ("Nika 73 cm, do které se nic nevejde?"), not on "custom furniture."

- **Concrete over lyrical.** "Sedí na milimetr" beats "dokonalý domov."
- **Numbers are claims.** 5 minut návrh, 30 minut montáž, od 2 490 Kč. Only say numbers we can keep.
- **Anchor against the carpenter, never IKEA.** We are 50–60 % cheaper and 4–8× faster than truhlář; we are not a cheaper shelf.
- **Objections answered in daylight.** Made-to-order return rules, measuring anxiety, courier damage: address them plainly where the customer feels them, not in footnote legalese.
- Czech first; sentences short; no exclamation marks; no superlatives ("nejlepší", "revoluční" are banned).

Tagline: **„Na milimetr."** (EN: *"To the millimetre."*)

---

## 6. Motion

Motion means **fitting**: elements slide into place the way a plank slots into a niche. Never bouncy, never floaty.

- Ease: `cubic-bezier(0.16, 1, 0.3, 1)` ("precision ease") for entrances; `ease-in` 150–200 ms for exits.
- Durations: micro 150–200 ms · component 250–350 ms · scene 450–600 ms.
- Scroll reveals: fade + 12–16 px rise, once, staggered ≤ 60 ms.
- Live numbers (price) tick, they do not spin.
- `prefers-reduced-motion` collapses everything to opacity or nothing. Non-negotiable.

---

## 7. Surfaces & shape

- Radius scale: 12 px (small controls) · 16 px (cards) · 24 px (feature panels) · pill for chips. One system, no exceptions.
- Shadows are rare and tinted: `0 1px 2px rgba(24,24,27,.04), 0 8px 24px -12px rgba(24,24,27,.12)`. Prefer hairline rings (`--line`) and spacing over elevation.
- The page is light. **One deliberate dark block per page maximum** (ink `#18181B`) used as the color-block moment (pricing).
- 3D scenes and product photography always sit in the warm Niche tone with soft inner shading — the "alcove" framing.

---

## 8. Applications quick-reference

- **Buttons:** primary = brand fill, white text, radius 12, active state compresses 1 px. Secondary = white, ink text, `--line` ring. One label per intent sitewide.
- **Dimension chips:** mono, 13 px, `--surface-2` fill, used on 3D scenes and product cards to certify exactness.
- **Trust modules:** samples, measuring guide, packaging, returns are designed content, not footer links.
- **Email/social avatar:** `myble-tile.svg`.

*Maintained in-repo. The living version of this document is the `/brand` page.*
