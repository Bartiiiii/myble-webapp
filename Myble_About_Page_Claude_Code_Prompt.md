# Claude Code prompt — Rebuild the Myble "About us" page as a founder-story page

Copy everything below this line into Claude Code, running in
`~/Desktop/Business/PROJECTS/Myble/myble-webapp/myble-webapp-project`.

---

## TASK

Rebuild `app/about/page.tsx` into a long-form, editorial founder-story page. Today it's a single
heading, one paragraph and a button. It should become the most visually interesting page on the
site after the homepage: an alternating photo/text narrative with scroll animation, a dark "turn"
band, a mono stat strip, and a closing CTA.

All copy is bilingual and **must go through the existing i18n system** (`lib/i18n.tsx`), not be
hardcoded. All ten photos are already optimised and in place at `public/img/story/`.

## HARD CONSTRAINTS

1. **Do not name any retailer.** The board shop is "a shop on the other side of town" / "obchod na
   druhém konci města". Never write OBI or any brand name. This matters — check the final strings.
2. **Reuse existing components and idioms.** `SiteHeader variant="app"`, `SiteFooter`, `Reveal`
   (`components/Reveal.tsx`), `useI18n` / `tList`. Do not introduce a new animation library
   (no framer-motion) — the site animates with CSS + IntersectionObserver and should keep doing so.
3. **Brand vocabulary, unchanged:** indigo-600 `#4f46e5` accent on white/zinc, Geist, `rounded-2xl` /
   `rounded-3xl`, `ring-1 ring-zinc-200`, dark bands are `bg-zinc-900`. The signature detail is
   **measurements dressed as product**: mono type, `DimChip`-style pills. Lift the `DimChip` pattern
   from `app/page.tsx` (line ~112) into a shared component or re-declare it locally.
4. **`prefers-reduced-motion: reduce` must fully disable** parallax, tilt and stagger. `Reveal`
   already handles itself in CSS — any new motion you add must have its own guard.
5. **Images:** use `next/image` with explicit `width`/`height` (all photos are 787 × 1400 portrait,
   except check each), `sizes` set for the two-column layout, `priority` only on the first photo,
   `loading="lazy"` for the rest. Every image needs a real `alt` sourced from i18n.
6. TypeScript strict, no `any`, no new dependencies, `npm run lint` and `npx tsc --noEmit` clean.

## PAGE STRUCTURE

```
SiteHeader (variant="app")
 ├─ Hero            — eyebrow / H1 / lede, generous whitespace, no image
 ├─ Story rail      — sticky ruler index (desktop only) + 5 alternating blocks
 │    01 image right   story-01-need.jpg
 │    02 image left    story-02-plan.jpg  + offset card story-02b-cutlist.jpg
 │    03 image right   story-03-cut.jpg   + offset card story-03b-carry.jpg
 │    04 image left    story-04-drill.jpg + offset cards story-04b-dowels.jpg, story-04c-frame.jpg
 │    05 image right   story-05-done.jpg  + story-05b-piece.jpg + sketch callback
 ├─ The turn        — full-bleed bg-zinc-900 band, large type
 ├─ The tally       — mono two-column then/now strip
 ├─ Enter Myble     — eyebrow + H2 + four numbered steps (reuse the homepage step-card look)
 └─ Closing CTA     — heading, sub, indigo primary button → /design, secondary link → /#jak
SiteFooter
```

## DESIGN DIRECTION — the parts that make it feel designed

**Story block layout.** `max-w-6xl`, 12-col grid on `lg:`. Image column spans 5, text column spans 6
with a 1-col gutter; the two swap order per block via `lg:order-*`. On mobile everything stacks,
image first, and the offset cards collapse into a simple 2-up row under the main photo.

**The ruler rail.** On `lg:` and up, a sticky left rail running the height of the story section,
drawn as a vertical measuring tape: a hairline `border-zinc-300`, tick marks every 8px with a longer
tick and a mono `01`–`05` label at each block's anchor. As the reader scrolls, an indigo segment
fills the tape from the top (scroll progress via a single `requestAnimationFrame`-throttled scroll
listener, or an IntersectionObserver per block — whichever you keep cleaner), and the active block's
number goes from `text-zinc-400` to `text-zinc-900 font-semibold`. This is the page's signature
element — it turns the brand's "measurements as product" idea into the navigation. Hide entirely
below `lg:`.

**Photos.** Main photo: `rounded-3xl`, `ring-1 ring-zinc-900/10`, `shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]`,
and a slow vertical parallax — translate the image roughly −20px → +20px across its time in the
viewport, clamped, transform-only, rAF-throttled. Subtle; if it reads as movement it's too much.

**Offset cards.** Each secondary photo is a smaller card (about 38% of the main photo's width)
absolutely positioned overlapping the main photo's lower outer corner, `rotate-[-4deg]` (or
`rotate-[3deg]` for the alternate side), `rounded-2xl`, white 6px border, its own shadow — like a
print dropped on a desk. On hover/focus it lifts and straightens (`rotate-0 scale-[1.03]`,
200ms ease-out). Block 04 has two of them in a slight fan, rotations `-6deg` and `4deg`.

**Mono chips on photos.** `DimChip`-style, absolutely positioned, animate in with a small
`translate-y` after the block reveals:
- block 02 photo → `73,3 × 35 cm` and `t = 16 mm`
- block 04 photo → `4 · 9 · 9 · 9 · 4 cm`
- block 05 photo → `padne na centimetr` / `fits to the centimetre`

**Block headers.** Match the homepage "how it works" cards: `border-t-2 border-zinc-900 pt-6`, then a
mono `01` in `text-zinc-400`, then the H2. Body copy `text-base leading-7 text-zinc-600`, with the
first sentence of each block in `text-zinc-900 font-medium` as a lead-in.

**Captions.** Under each main photo, mono `text-[11px] text-zinc-400`, prefixed with a small em dash.

**Block 05 callback.** The final photo is the same composition as the block-01 sketch — make the page
say so. Beside the final photo, render a small `story-01-need.jpg` thumbnail (about 96px wide,
rounded-xl, ring) with a mono label `drawn` / `nakresleno`, an arrow `→`, and the final photo labelled
`built` / `postaveno`. Do **not** build a wipe/slider comparison — the two shots are framed
differently and it won't align.

**The turn band.** Full-bleed `bg-zinc-900 text-white`, generous `py-24`. H2 at `text-3xl sm:text-5xl`
`tracking-[-0.03em]`. The line "Weeks of it." / "Týdny." gets its own paragraph at larger size and
`text-zinc-400`. Keep the band tight — this is the emotional pivot, not a feature list.

**The tally.** Immediately under the turn band, still on dark or on `bg-zinc-950`, two columns:
"My way" vs "With Myble". Each row is a mono figure (`text-2xl font-mono`) over a small label. The
Myble column carries the indigo accent and a `ring-1 ring-indigo-500/30` treatment; the left column
is deliberately dimmer (`text-zinc-500`). Stagger the rows in with `Reveal delay={i * 70}`.

**Enter Myble.** Back on white. Eyebrow in `text-indigo-600`, H2, then four cards in a
`sm:grid-cols-2 lg:grid-cols-4` grid using the same `border-t-2 border-zinc-900 pt-6` + mono numeral
treatment as the homepage steps. Closing line under the grid.

**Closing CTA.** Centred, `py-24`, H2, sub, then the primary button (`bg-indigo-600 hover:bg-indigo-500
rounded-xl px-7 py-4 text-sm font-semibold text-white`) linking to `/design`, and a secondary text
link to `/#jak`. Fire a PostHog event on the primary click, matching however the homepage CTA does it.

**Metadata.** The page is `"use client"`, so add a sibling `app/about/layout.tsx` exporting
`metadata` with an English title/description (`About Myble — why we exist`) and an OG image, matching
how the rest of the app handles it.

## COPY — i18n strings to add

Add an `about.story` subtree to **both** `en` and `cs` in `lib/i18n.tsx`, keeping the existing
`about.title` / `about.body` / `about.cta` keys in place (they may be referenced elsewhere — check
before removing; if nothing else uses `about.body`, you may drop it).

### English (`en.about.story`)

```ts
story: {
  eyebrow: "Our story",
  h1: "It started because I couldn't buy it.",
  lede: "Myble didn't start from a business plan. It started from a piece of furniture that didn't exist — and three weekends of my life spent making one.",

  b1: {
    n: "01",
    h: "The thing I couldn't buy",
    p1: "I needed one very specific thing. A speaker at the bottom. Records in the middle. A turntable on top. The right height, the right width, the right depth for the corner it had to live in.",
    p2: "I looked. Nobody makes that. Not in that size, not for that money. The closest thing was always too tall, too shallow, or built for someone else's room.",
    p3: "So I drew it onto a photo of my own wall, and decided to build it myself.",
    cap: "The brief: one drawing, one wall, one very specific gap.",
    alt: "A sketch drawn over a photo of my wall: a speaker at the bottom, records in the middle, a turntable on top.",
  },
  b2: {
    n: "02",
    h: "Two evenings of arithmetic",
    p1: "Then came the part nobody warns you about: the maths.",
    p2: "Every panel, to the millimetre. Which piece overlaps which. How thick the board is, and what that does to every other dimension. Where the dowels go — 4, 9, 9, 9, 4 — and what happens to the whole thing if one of them is 2 mm off.",
    p3: "Two evenings and a notebook later, I had a cut list. Four panels. 73.3 × 35. 40 × 35. 36.7 × 35. Board thickness 1.6 cm.",
    cap: "Two evenings in a notebook, to describe a box.",
    alt: "A hand-drawn elevation of the cabinet with each panel dimensioned.",
    alt2: "A notebook page with the cut list and dowel spacing.",
    chip1: "73,3 × 35 cm",
    chip2: "t = 16 mm",
  },
  b3: {
    n: "03",
    h: "A queue, a saw, and a tram ride",
    p1: "Next: a shop on the other side of town that sells board by the whole sheet.",
    p2: "You don't buy four panels. You buy one big sheet and ask them to cut it into four — at a counter, in a queue, hoping you wrote your numbers down right, because you can't un-cut a board.",
    p3: "Then you carry it home. Raw panels, a plastic bag, a tram. The pieces were finally the right size. I still had nothing that looked like furniture.",
    cap: "Cut to size at a counter. Carried home in a bag.",
    alt: "A freshly cut black panel resting on the counter of a cutting service.",
    alt2: "Cut panels in a plastic bag on the pavement outside.",
  },
  b4: {
    n: "04",
    h: "I don't own a drill",
    p1: "Most people living in a flat don't.",
    p2: "So I booked an hour in a workshop you can rent by the hour, hauled my panels across the city a second time, and drilled every dowel hole myself — square to the face, right depth, right spacing. A couple of millimetres off and the panel doesn't sit flush.",
    p3: "Back home: glue, dowels, and the slow part where you find out whether all that arithmetic was right.",
    cap: "Rented drill, rented hour. Twelve holes that all had to be right.",
    alt: "Drilling dowel holes into a black panel at a rented workbench.",
    alt2: "Dowels and glue laid out on the floor beside two panels.",
    alt3: "The carcass half assembled, dowels standing proud of the edge.",
    chip1: "4 · 9 · 9 · 9 · 4 cm",
  },
  b5: {
    n: "05",
    h: "It fits",
    p1: "It fit. Exactly, to the centimetre, the way it did on paper.",
    p2: "Speaker at the bottom. Records in the middle. Turntable on top. The thing I'd drawn over a photo of my own wall, now standing against that wall.",
    p3: "I was proud of it. I still am.",
    cap: "Left: the drawing. Right: the same thing, three weekends later.",
    alt: "The finished unit in place: speaker underneath, records in the middle, turntable on top.",
    alt2: "The finished piece, assembled and standing on its own.",
    chip1: "fits to the centimetre",
    drawn: "drawn",
    built: "built",
  },

  turn: {
    h: "But look at what it cost",
    p1: "Not the materials. Those were cheap.",
    p2: "The design cost. The measuring, and the re-measuring. A trip across town for boards, another for a drill I don't own, an evening spent deciding whether 1.6 cm of board thickness comes off the shelf or off the sides.",
    big: "Weeks of it. For one piece of furniture that fits one wall.",
    p3: "And that isn't a hobbyist's problem. It's everyone's — anyone with an awkward alcove, a sloped ceiling, a 63 cm gap, or something they own that nothing on a shop floor is built to hold.",
  },

  tally: {
    mineTitle: "My way",
    mybleTitle: "With Myble",
    mine: [
      { v: "3", l: "weekends" },
      { v: "2", l: "trips across town" },
      { v: "1", l: "rented drill" },
      { v: "12", l: "holes drilled by hand" },
      { v: "0", l: "shops that sold it" },
    ],
    myble: [
      { v: "~15", l: "minutes in your browser" },
      { v: "0", l: "trips" },
      { v: "0", l: "tools you don't own" },
      { v: "1", l: "delivery — cut, drilled, labelled" },
    ],
  },

  myble: {
    eyebrow: "And that's where we come in",
    h: "So we built the hard part",
    steps: [
      { n: "01", t: "You draw it", b: "In the browser, in centimetres, in minutes. No notebook, no arithmetic." },
      { n: "02", t: "We do the maths", b: "Thicknesses, joints, dowel positions, whether the shelf will sag. Solved before you order." },
      { n: "03", t: "It arrives cut, drilled and labelled", b: "Every panel to the millimetre, every hole already there." },
      { n: "04", t: "You assemble it", b: "About 30 minutes, almost no tools. The good part of my three weekends, without the rest." },
    ],
    close: "Same result: furniture that fits your space exactly. Without the drawing, the queue, the tram and the borrowed drill.",
  },

  cta: {
    h: "Your wall, your centimetres.",
    p: "You already know what you need. Draw it — we'll handle the rest.",
    primary: "Create your furniture now",
    secondary: "See how it works",
  },
},
```

### Czech (`cs.about.story`)

Same shape, same keys. Formal *Vy/Vaše*, matching the rest of the site.

```ts
story: {
  eyebrow: "Náš příběh",
  h1: "Začalo to tím, že se to nedalo koupit.",
  lede: "Myble nezačalo podnikatelským plánem. Začalo nábytkem, který neexistoval — a třemi víkendy, které jsem strávil tím, že jsem si ho vyrobil sám.",

  b1: {
    n: "01",
    h: "Věc, která se nedala koupit",
    p1: "Potřeboval jsem jednu velmi konkrétní věc. Dole reproduktor. Uprostřed desky. Nahoře gramofon. Přesná výška, přesná šířka, přesná hloubka pro kout, ve kterém to mělo stát.",
    p2: "Hledal jsem. Nikdo to nedělá. Ne v téhle velikosti, ne za tuhle cenu. To nejbližší bylo vždycky moc vysoké, moc mělké, nebo postavené do cizího pokoje.",
    p3: "Tak jsem si to nakreslil do fotky vlastní stěny a rozhodl se, že si to postavím sám.",
    cap: "Zadání: jedna kresba, jedna stěna, jedna velmi konkrétní mezera.",
    alt: "Kresba načrtnutá do fotky mojí stěny: dole reproduktor, uprostřed desky, nahoře gramofon.",
  },
  b2: {
    n: "02",
    h: "Dva večery počítání",
    p1: "Pak přišla část, před kterou vás nikdo nevaruje: počítání.",
    p2: "Každý díl na milimetr. Co překrývá co. Jak silná je deska a co to udělá se všemi ostatními rozměry. Kam přijdou kolíky — 4, 9, 9, 9, 4 — a co se stane s celkem, když je jeden z nich o 2 mm vedle.",
    p3: "Po dvou večerech se sešitem jsem měl rozpis dílů. Čtyři díly. 73,3 × 35. 40 × 35. 36,7 × 35. Tloušťka desky 1,6 cm.",
    cap: "Dva večery v sešitě. Abych popsal krabici.",
    alt: "Ruční nákres skříňky s okótovanými díly.",
    alt2: "Stránka sešitu s rozpisem dílů a roztečemi kolíků.",
    chip1: "73,3 × 35 cm",
    chip2: "t = 16 mm",
  },
  b3: {
    n: "03",
    h: "Fronta, pila a jedna tramvaj",
    p1: "Dál: obchod na druhém konci města, kde se deska prodává jen po celých kusech.",
    p2: "Nekoupíte čtyři díly. Koupíte jednu velkou desku a poprosíte, aby ji nařezali na čtyři — u pultu, ve frontě, s nadějí, že jste si ty rozměry zapsali správně. Řez se vzít zpátky nedá.",
    p3: "Pak to odvezete domů. Syrové desky, igelitka, tramvaj. Díly konečně měly správný rozměr. Pořád jsem ale neměl nic, co by vypadalo jako nábytek.",
    cap: "Nařezáno u pultu. Odneseno domů v tašce.",
    alt: "Čerstvě nařezaná černá deska na pultu formátovací služby.",
    alt2: "Nařezané díly v igelitce na chodníku před obchodem.",
  },
  b4: {
    n: "04",
    h: "Nemám vrtačku",
    p1: "Většina lidí v bytě ji nemá.",
    p2: "Tak jsem si zarezervoval hodinu v dílně, kterou si můžete pronajmout na hodiny, převezl desky přes město ještě jednou a všechny díry na kolíky vyvrtal sám — kolmo, do správné hloubky, ve správných roztečích. Pár milimetrů vedle a díl nedosedne.",
    p3: "Doma pak: lepidlo, kolíky a ta pomalá část, kdy zjišťujete, jestli všechno to počítání sedělo.",
    cap: "Půjčená vrtačka, půjčená hodina. Dvanáct děr, které musely sedět všechny.",
    alt: "Vrtání děr pro kolíky do černé desky v pronajaté dílně.",
    alt2: "Kolíky a lepidlo připravené na podlaze vedle dvou dílů.",
    alt3: "Zpola složená korpusová část, kolíky vyčnívají z hrany.",
    chip1: "4 · 9 · 9 · 9 · 4 cm",
  },
  b5: {
    n: "05",
    h: "Sedí to",
    p1: "Sedělo to. Přesně na centimetr, tak jako na papíře.",
    p2: "Dole reproduktor. Uprostřed desky. Nahoře gramofon. Ta věc, kterou jsem si nakreslil do fotky vlastní stěny, teď stála u té stěny.",
    p3: "Byl jsem na to pyšný. Jsem pořád.",
    cap: "Vlevo kresba. Vpravo totéž, o tři víkendy později.",
    alt: "Hotový kus na svém místě: dole reproduktor, uprostřed desky, nahoře gramofon.",
    alt2: "Hotový kus, složený a stojící sám o sobě.",
    chip1: "padne na centimetr",
    drawn: "nakresleno",
    built: "postaveno",
  },

  turn: {
    h: "Ale podívejte se, co to stálo",
    p1: "Ne materiál. Ten byl levný.",
    p2: "Stál mě to návrh. Měření a přeměřování. Cesta přes město pro desky, další pro vrtačku, kterou nemám, celý večer nad tím, jestli se 1,6 cm tloušťky odečte od police, nebo od boků.",
    big: "Týdny. Kvůli jednomu kusu nábytku, který sedne do jedné stěny.",
    p3: "A to není problém kutila. To je problém každého — kdo má nepraktický výklenek, šikmý strop, mezeru 63 cm, nebo věc, pro kterou se v obchodě nevyrábí nic.",
  },

  tally: {
    mineTitle: "Mojí cestou",
    mybleTitle: "S Myble",
    mine: [
      { v: "3", l: "víkendy" },
      { v: "2", l: "cesty přes město" },
      { v: "1", l: "půjčená vrtačka" },
      { v: "12", l: "děr vyvrtaných ručně" },
      { v: "0", l: "obchodů, kde by to prodávali" },
    ],
    myble: [
      { v: "~15", l: "minut v prohlížeči" },
      { v: "0", l: "cest" },
      { v: "0", l: "nářadí, které nemáte" },
      { v: "1", l: "doručení — nařezané, vyvrtané, očíslované" },
    ],
  },

  myble: {
    eyebrow: "A tady přicházíme my",
    h: "Tak jsme postavili tu těžkou část",
    steps: [
      { n: "01", t: "Navrhnete si to", b: "V prohlížeči, v centimetrech, za pár minut. Žádný sešit, žádné počítání." },
      { n: "02", t: "Spočítáme to za vás", b: "Tloušťky, spoje, pozice kolíků, jestli se police neprohne. Vyřešené dřív, než objednáte." },
      { n: "03", t: "Přijde nařezané, vyvrtané a očíslované", b: "Každý díl na milimetr, každá díra už na svém místě." },
      { n: "04", t: "Složíte to", b: "Asi za 30 minut, skoro bez nářadí. Ta hezká část z mých tří víkendů. Bez zbytku." },
    ],
    close: "Stejný výsledek: nábytek, který přesně padne do Vašeho prostoru. Bez kresby, fronty, tramvaje a půjčené vrtačky.",
  },

  cta: {
    h: "Vaše stěna, Vaše centimetry.",
    p: "Už víte, co potřebujete. Nakreslete to — o zbytek se postaráme my.",
    primary: "Vytvořit svůj nábytek",
    secondary: "Jak to funguje",
  },
},
```

The `tally.mine` / `tally.myble` / `myble.steps` arrays are raw arrays — read them with `tList`, the
same way `app/page.tsx` reads the compare-table rows and FAQ list. Type them so the component
doesn't need a cast.

## IMAGE MANIFEST

All in `public/img/story/`, all portrait, all already optimised:

| file | block | role |
|---|---|---|
| `story-01-need.jpg` | 01 | main — the sketch over the wall photo (also reused as the block-05 callback thumbnail) |
| `story-02-plan.jpg` | 02 | main — elevation drawing |
| `story-02b-cutlist.jpg` | 02 | offset card — cut list page |
| `story-03-cut.jpg` | 03 | main — panel on the cutting counter |
| `story-03b-carry.jpg` | 03 | offset card — panels in the bag |
| `story-04-drill.jpg` | 04 | main — drilling |
| `story-04b-dowels.jpg` | 04 | offset card — dowels and glue |
| `story-04c-frame.jpg` | 04 | offset card — half-assembled carcass |
| `story-05-done.jpg` | 05 | main — finished, in place, in use |
| `story-05b-piece.jpg` | 05 | offset card — the finished piece alone |

## FILES TO TOUCH

- `app/about/page.tsx` — rewrite
- `app/about/layout.tsx` — new, metadata only
- `lib/i18n.tsx` — add `about.story` to `en` and `cs`
- `components/StoryBlock.tsx`, `components/StoryRail.tsx` — new, if it keeps `page.tsx` readable
  (it will; the page is long)
- `app/globals.css` — only if you need a keyframe the existing `.reveal` / `.t-stagger` vocabulary
  doesn't cover

## DEFINITION OF DONE

- `npm run lint` and `npx tsc --noEmit` pass clean.
- `/about` renders correctly in **both** EN and CS — switch the locale in the footer and re-read the
  whole page; no key falls back to a raw key string, no Czech line overflows its container.
- Responsive check at 375, 768, 1280 and 1600 px: no horizontal scroll, offset cards never clip off
  the viewport or cover the main photo's subject, the ruler rail is hidden below `lg`.
- With `prefers-reduced-motion: reduce` forced on, the page is fully static and fully readable.
- Lighthouse-ish sanity: images lazy-loaded below the fold, no layout shift from the photos.
- No retailer brand name anywhere in the diff.
