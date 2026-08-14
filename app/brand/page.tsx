"use client";

/**
 * /brand — the living Myble brand book. Internal page (not linked from nav).
 * Canonical source: brand/brand-guidelines.md. If the two disagree, fix both.
 */

import Link from "next/link";
import { MybleMark } from "../../components/SiteHeader";
import { Reveal } from "../../components/Reveal";

const INTERFACE_COLORS = [
  { name: "Ink", hex: "#18181B", role: "Headlines, logo, dark surfaces" },
  { name: "Ink soft", hex: "#52525B", role: "Body text" },
  { name: "Ink mute", hex: "#A1A1AA", role: "Meta, captions" },
  { name: "Paper", hex: "#FFFFFF", role: "Page background", border: true },
  { name: "Surface", hex: "#FAFAFA", role: "Cards, alternate sections", border: true },
  { name: "Line", hex: "#E4E4E7", role: "Hairlines, rings", border: true },
  { name: "Myble Indigo", hex: "#4F46E5", role: "The single accent. CTAs, links, the block" },
  { name: "Indigo deep", hex: "#4338CA", role: "Hover / active" },
  { name: "Indigo bright", hex: "#818CF8", role: "Accent on dark surfaces" },
];

const MATERIAL_COLORS = [
  { name: "Niche", hex: "#ECE7DF", role: "3D scene wall, photo backdrop" },
  { name: "Bílá", hex: "#F3F1EC", role: "Decor: white lacquer" },
  { name: "Dub", hex: "#C9A36B", role: "Decor: oak" },
  { name: "Grafit", hex: "#3F3F46", role: "Decor: graphite" },
];

function Swatch({ name, hex, role, border }: { name: string; hex: string; role: string; border?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-200">
      <div className={`h-20 ${border ? "ring-1 ring-inset ring-zinc-200" : ""}`} style={{ background: hex }} />
      <div className="bg-white p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900">{name}</p>
          <p className="font-mono text-xs text-zinc-500">{hex}</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-600">{role}</p>
      </div>
    </div>
  );
}

function SectionTitle({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-t-2 border-zinc-900 pt-6">
      <span className="font-mono text-sm font-medium text-zinc-400">{index}</span>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{children}</h2>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Cover */}
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-zinc-900"><MybleMark className="h-7 w-7" /></span>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">myble</span>
          </Link>
          <span className="font-mono text-xs text-zinc-500">Brand book · v1.0 · 2026</span>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 py-24 sm:py-32">
        <Reveal>
          <span className="text-zinc-900"><MybleMark className="h-20 w-20" /></span>
          <h1 className="mt-10 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            A gap, filled exactly.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            Myble is carpenter-level fit at near-IKEA convenience. Every brand decision expresses one
            image: the 73 cm alcove that defeated three standard units, finally holding a piece that
            looks like the building was designed around it.
          </p>
          <p className="mt-6 font-mono text-sm text-zinc-500">Tagline: „Na milimetr." · EN: "To the millimetre."</p>
        </Reveal>
      </section>

      {/* Logo */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-24">
        <Reveal>
          <SectionTitle index="01">The mark</SectionTitle>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            A shelving frame with offset shelves, the way real Myble pieces are built, and one
            compartment holding a fitted accent block: your piece, in your gap. It reads at once as a
            piece of furniture, a floor plan of a niche, and a map that says "you are here."
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <Reveal>
            <div className="flex h-56 items-center justify-center rounded-3xl bg-white ring-1 ring-zinc-200">
              <span className="text-zinc-900"><MybleMark className="h-24 w-24" /></span>
            </div>
            <p className="mt-3 text-center font-mono text-xs text-zinc-500">myble-mark.svg · light</p>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex h-56 items-center justify-center rounded-3xl bg-zinc-900">
              <span className="text-zinc-50"><MybleMark className="h-24 w-24" accent="#818CF8" /></span>
            </div>
            <p className="mt-3 text-center font-mono text-xs text-zinc-500">myble-mark-dark.svg · dark</p>
          </Reveal>
          <Reveal delay={160}>
            <div className="flex h-56 items-center justify-center rounded-3xl bg-[#ece7df] ring-1 ring-zinc-200">
              <div className="flex items-center gap-3">
                <span className="text-zinc-900"><MybleMark className="h-12 w-12" /></span>
                <span className="text-3xl font-semibold tracking-[-0.02em] text-zinc-900">myble</span>
              </div>
            </div>
            <p className="mt-3 text-center font-mono text-xs text-zinc-500">lockup · wordmark always lowercase</p>
          </Reveal>
        </div>
        <Reveal>
          <ul className="mt-8 grid max-w-3xl gap-2 text-sm leading-6 text-zinc-600 sm:grid-cols-2">
            <li>Clear space: 2× the accent block, all sides.</li>
            <li>Minimum mark size 20 px; below that, use the tile.</li>
            <li>The accent block never moves cells and is the only colored element.</li>
            <li>Never rotate, recolor outside approved pairs, or add effects.</li>
          </ul>
        </Reveal>
      </section>

      {/* Color */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-24">
        <Reveal>
          <SectionTitle index="02">Color: two worlds, one system</SectionTitle>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            A cool, exact interface and a warm material world. The interface stays zinc with a single
            indigo accent; oak, lacquer and graphite belong to imagery and 3D scenes, never to UI chrome.
            The tension between the two is the brand.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h3 className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Interface</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {INTERFACE_COLORS.map((c) => <Swatch key={c.name} {...c} />)}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h3 className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Material world</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {MATERIAL_COLORS.map((c) => <Swatch key={c.name} {...c} />)}
          </div>
        </Reveal>
      </section>

      {/* Type */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-24">
        <Reveal>
          <SectionTitle index="03">Typography</SectionTitle>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <div className="h-full rounded-3xl bg-zinc-50 p-8 ring-1 ring-zinc-200 sm:p-10">
              <p className="font-mono text-xs text-zinc-500">Geist · display &amp; body</p>
              <p className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                Nika 73 cm, do které se nic nevejde?
              </p>
              <p className="mt-6 max-w-md text-base leading-7 text-zinc-600">
                Big and confident, never shouty. Tracking -0.02 to -0.03 em, leading 1.02–1.1 for
                display; 16 px+, leading 1.6 for body.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex h-full flex-col justify-between rounded-3xl bg-zinc-900 p-8 text-white">
              <div>
                <p className="font-mono text-xs text-zinc-400">Geist Mono · the signature</p>
                <p className="mt-6 font-mono text-3xl font-medium tracking-tight">728 mm</p>
                <p className="mt-2 font-mono text-lg text-zinc-300">2 490 Kč · 30 min</p>
              </div>
              <p className="mt-8 text-sm leading-6 text-zinc-400">
                Every measurement renders in mono. Numbers that describe fit are product, and they
                dress like product.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Voice */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-24">
        <Reveal>
          <SectionTitle index="04">Voice</SectionTitle>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            Problem first, product second. Concrete over lyrical. Numbers are claims we keep. Anchor
            against the carpenter, never IKEA. Czech first, sentences short, no exclamation marks,
            no superlatives.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl bg-indigo-50 p-8 ring-1 ring-indigo-100">
              <p className="text-sm font-semibold text-indigo-700">Sounds like us</p>
              <ul className="mt-4 space-y-3 text-base leading-7 text-zinc-800">
                <li>„Nika 73 cm, do které se nic nevejde?"</li>
                <li>„Sedí na milimetr."</li>
                <li>„Cena hned. Bez konzultace, bez čekání."</li>
                <li>„Navrhněte za 5 minut, sestavte za 30."</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="h-full rounded-3xl bg-white p-8 ring-1 ring-zinc-200">
              <p className="text-sm font-semibold text-zinc-500">Never</p>
              <ul className="mt-4 space-y-3 text-base leading-7 text-zinc-500">
                <li className="line-through decoration-zinc-300">„Revoluční nábytek budoucnosti!"</li>
                <li className="line-through decoration-zinc-300">„Nejlepší volba pro váš domov"</li>
                <li className="line-through decoration-zinc-300">„Levnější než IKEA"</li>
                <li className="line-through decoration-zinc-300">Discount theatre, urgency timers</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Motion + surfaces */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-24">
        <Reveal>
          <SectionTitle index="05">Motion &amp; surfaces</SectionTitle>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            Motion means fitting: elements slide into place the way a plank slots into a niche. Never
            bouncy, never floaty. Radius 12 / 16 / 24 px, hairlines over shadows, one dark block per
            page maximum, and 3D scenes always sit in the warm Niche tone.
          </p>
        </Reveal>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Reveal>
            <button className="press rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500">
              Primary, press me
            </button>
          </Reveal>
          <Reveal delay={60}>
            <button className="press rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50">
              Secondary
            </button>
          </Reveal>
          <Reveal delay={120}>
            <span className="rounded-lg bg-zinc-100 px-2.5 py-1 font-mono text-xs font-medium text-zinc-800 ring-1 ring-zinc-900/10">
              73 × 180 × 35 cm
            </span>
          </Reveal>
          <Reveal delay={180}>
            <span className="font-mono text-xs text-zinc-500">ease: cubic-bezier(0.22, 1, 0.36, 1)</span>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-zinc-500">
          <span>Canonical source: <span className="font-mono text-xs">brand/brand-guidelines.md</span></span>
          <Link href="/" className="font-medium text-zinc-900 hover:text-indigo-600">← my-ble.eu</Link>
        </div>
      </footer>
    </div>
  );
}
