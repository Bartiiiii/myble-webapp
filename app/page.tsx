"use client";

import Image from "next/image";

import Link from "next/link";

import { CabinetViewer } from "../components/CabinetViewer";
import { HomeNavAuth } from "../components/HomeNavAuth";

import React, { useMemo, useState } from "react";

type Step = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

type DesignCard = {
  title: string;
  story: string;
  tag: string;
};

type Testimonial = {
  quote: string;
  name: string;
  handle: string;
  rating: number; // 1-5
};

type FAQ = {
  q: string;
  a: string;
};

function IconBox(props: { children: React.ReactNode }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
      <div className="text-indigo-700">{props.children}</div>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < rating);
  return (
    <div className="flex items-center gap-1">
      {stars.map((filled, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${filled ? "text-amber-400" : "text-white/20"}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 17.27l-5.18 3.04 1.4-5.95-4.62-4 6.08-.52L12 4.2l2.32 5.64 6.08.52-4.62 4 1.4 5.95L12 17.27z" />
        </svg>
      ))}
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="relative rounded-[2.25rem] bg-zinc-900 p-4 shadow-2xl ring-1 ring-black/10">
        
        <div className="rounded-[1.75rem] bg-zinc-950 p-4">
         

             <div className="mt-4 w-full">
              <CabinetViewer />
             </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-indigo-500/20 blur-2xl" />
      <div className="pointer-events-none absolute -top-10 -right-6 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-2xl" />
    </div>
  );
}

function FAQAccordion({ items }: { items: FAQ[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="divide-y divide-white/10 rounded-2xl bg-white/5 ring-1 ring-white/10">
        {items.map((it, idx) => {
          const isOpen = open === idx;
          return (
            <div key={idx} className="px-6 py-5">
              <button
                className="flex w-full items-center justify-between gap-6 text-left"
                onClick={() => setOpen(isOpen ? null : idx)}
                aria-expanded={isOpen}
              >
                <span className="text-base font-semibold text-white">{it.q}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <span className="text-white/80">{isOpen ? "—" : "+"}</span>
                </span>
              </button>

              <div
                className={`grid transition-all duration-300 ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="mt-3 text-sm leading-6 text-white/70">{it.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const steps: Step[] = useMemo(
    () => [
      {
        title: "Design your furniture",
        description:
          "Start from a template or a blank canvas. Customize dimensions, layout, and materials to fit your space and style. See changes instantly as you design.",
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M11.622 1.602a.75.75 0 0 1 .756 0l2.25 1.313a.75.75 0 0 1-.756 1.295L12 3.118 10.128 4.21a.75.75 0 1 1-.756-1.295l2.25-1.313ZM5.898 5.81a.75.75 0 0 1-.27 1.025l-1.14.665 1.14.665a.75.75 0 1 1-.756 1.295L3.75 8.806v.944a.75.75 0 0 1-1.5 0V7.5a.75.75 0 0 1 .372-.648l2.25-1.312a.75.75 0 0 1 1.026.27Zm12.204 0a.75.75 0 0 1 1.026-.27l2.25 1.312a.75.75 0 0 1 .372.648v2.25a.75.75 0 0 1-1.5 0v-.944l-1.122.654a.75.75 0 1 1-.756-1.295l1.14-.665-1.14-.665a.75.75 0 0 1-.27-1.025Zm-9 5.25a.75.75 0 0 1 1.026-.27L12 11.882l1.872-1.092a.75.75 0 1 1 .756 1.295l-1.878 1.096V15a.75.75 0 0 1-1.5 0v-1.82l-1.878-1.095a.75.75 0 0 1-.27-1.025ZM3 13.5a.75.75 0 0 1 .75.75v1.82l1.878 1.095a.75.75 0 1 1-.756 1.295l-2.25-1.312a.75.75 0 0 1-.372-.648v-2.25A.75.75 0 0 1 3 13.5Zm18 0a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.372.648l-2.25 1.312a.75.75 0 1 1-.756-1.295l1.878-1.096V14.25a.75.75 0 0 1 .75-.75Zm-9 5.25a.75.75 0 0 1 .75.75v.944l1.122-.654a.75.75 0 1 1 .756 1.295l-2.25 1.313a.75.75 0 0 1-.756 0l-2.25-1.313a.75.75 0 1 1 .756-1.295l1.122.654V19.5a.75.75 0 0 1 .75-.75Z" />
          </svg>
        ),
      },
      {
        title: "Order your custom kit",
        description:
          "Once you’re happy with the design, place your order in one click. We produce your furniture as a flat-pack kit, tailored exactly to your specifications.",
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.2 14h9.9c.8 0 1.5-.5 1.8-1.2l2.9-6.5A1 1 0 0 0 21 5H6.2L5.8 3.6A1 1 0 0 0 4.9 3H2v2h2.1l2.1 8.4-.8 1.5A2 2 0 0 0 7.2 18H20v-2H7.2l1-2z" />
          </svg>
        ),
      },
      {
        title: "Assemble it at home",
        description:
          "Receive your kit with everything included. Follow clear, step-by-step instructions and assemble your furniture easily at home. No special tools required.",
        icon: (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
            <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
          </svg>
        ),
      },
    ],
    []
  );

  const designs: DesignCard[] = useMemo(
    () => [
      {
        title: "The Minimal Oak Table",
        story:
          "Designed for small kitchens—extends to seat six. Inspired by Scandinavian joinery and built with repairability in mind.",
        tag: "Dining • Extendable",
      },
      {
        title: "Cloud Modular Sofa",
        story:
          "A community remix of a classic modular: deeper seats, washable covers, and hidden storage for living-room life.",
        tag: "Sofa • Modular",
      },
      {
        title: "Wall Grid Shelving",
        story:
          "A flexible grid system that grows with your collection—add bays, doors, and cable routing as your needs change.",
        tag: "Shelving • System",
      },
      {
        title: "Lounge Chair V2",
        story:
          "Iterated through 34 prototypes by a maker collective—optimized lumbar curve and arm height for long reading sessions.",
        tag: "Chair • Ergonomic",
      },
      
    ],
    []
  );

  const testimonials: Testimonial[] = useMemo(
    () => [
      {
        quote:
          "The editor feels like Figma for furniture. We went from idea to specs our workshop could build in a single afternoon.",
        name: "Leslie Alexander",
        handle: "@lesliealexander",
        rating: 5,
      },
      {
        quote:
          "Community designs are gold. We started from a sofa template, tweaked dimensions, and the preview was spot-on.",
        name: "Lindsay Walton",
        handle: "@lindsaywalton",
        rating: 5,
      },
      {
        quote:
          "Ordering and material validation removed so much friction. The system caught structural issues before we wasted time.",
        name: "Whitney Francis",
        handle: "@whitneyfrancis",
        rating: 4,
      },
      {
        quote:
          "Finally—an end-to-end workflow. Shareable links made client feedback painless, and revisions stayed organized.",
        name: "Courtney Henry",
        handle: "@courtneyhenry",
        rating: 5,
      },
      {
        quote:
          "The templates are tasteful and modern, but still flexible. Our custom table came out exactly as planned.",
        name: "Tom Cook",
        handle: "@tomcook",
        rating: 5,
      },
      {
        quote:
          "We used it for a full apartment fit-out. The consistency across pieces saved us from mismatched finishes.",
        name: "Floyd Miles",
        handle: "@floydmiles",
        rating: 4,
      },
    ],
    []
  );

  const faqs: FAQ[] = useMemo(
    () => [
      {
        q: "Can I design from scratch or do I need a template?",
        a: "You can do both. Templates are optional starting points—choose one to move faster, or begin with a blank canvas and define dimensions, materials, and components step-by-step.",
      },
      {
        q: "Do you generate manufacturing-ready specs?",
        a: "Yes—our export includes dimensions, material notes, and assembly references. For now, the exact format is evolving, but the goal is to be workshop-friendly from day one.",
      },
      {
        q: "Can I share a design with others for feedback?",
        a: "Absolutely. Each design can be shared via a link with view or comment access, so collaborators can review changes without emailing files back and forth.",
      },
      {
        q: "What materials do you support?",
        a: "We focus on common, maker-friendly materials: hardwoods, plywood, metal frames, and upholstery options. The library will expand as we add more manufacturing partners.",
      },
      {
        q: "How does pricing work?",
        a: "You’ll see estimated pricing as you select materials and dimensions. Final pricing depends on manufacturing and delivery options, which you’ll confirm before ordering.",
      },
      {
        q: "Can I order directly through the platform?",
        a: "That’s the plan. The homepage includes the workflow now; ordering will roll out as we connect more production partners and logistics options.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Subtle grid background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(24,24,27,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(24,24,27,0.06)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_70%_20%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(900px_520px_at_20%_10%,rgba(217,70,239,0.10),transparent_55%)]" />

      {/* Top nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-700" fill="currentColor">
              <path d="M3 12c3-6 8-9 14-9 2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2zm0 8.8C6 14.8 11 12 17 12c2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">Myble</span>
        </div>

        <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
          <a className="hover:text-zinc-900" href="#product">
            Product
          </a>
          <a className="hover:text-zinc-900" href="#how">
            How it works
          </a>
          <a className="hover:text-zinc-900" href="#community">
            Community
          </a>
          <a className="hover:text-zinc-900" href="#faq">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <HomeNavAuth />
        </div>
      </header>

      {/* 1) HERO: mixed “A better way…” + rounded rectangle like “Close every deal.” */}
<section id="product" className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pb-10">
  <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.6))] p-5 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.35)] ring-1 ring-zinc-900/10 sm:rounded-[2.5rem] sm:p-8 md:p-12">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_70%_20%,rgba(99,102,241,0.20),transparent_55%),radial-gradient(900px_520px_at_20%_40%,rgba(217,70,239,0.14),transparent_55%)]" />
    <div className="relative grid items-start gap-8 md:grid-cols-2 md:gap-10">
      <div className="min-w-0">
        <h1 className="mt-2 max-w-[12ch] text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:mt-4 sm:text-5xl md:mt-7 md:text-6xl">
          Create your own furniture
        </h1>

        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:mt-6 sm:text-lg">
          Create custom furniture with a fast, structured workflow: choose a base,
          tweak dimensions, validate materials, order and assemble at home.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/design"
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:w-auto"
          >
            Start designing
          </Link>

          <a
            href="#how"
            className="inline-flex w-full items-center justify-center rounded-xl bg-white/70 px-5 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-900/10 hover:bg-white sm:w-auto"
          >
            Learn more →
          </a>
        </div>
      </div>

            <div className="relative">
              <PhoneMock />
            </div>
          </div>
        </div>
      </section>

      {/* 2) HOW IT WORKS: like “Stay on top…” */}
      <section id="how" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
            How it works
          </h2>
          <p className="mt-4 text-lg leading-7 text-zinc-600">
            A modern way to create fully personalized furniture, designed to 
            fit your space, your needs, and your lifestyle.
          </p>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((s, idx) => (
            <div key={idx} className="group">
              <IconBox>{s.icon}</IconBox>
              <h3 className="mt-5 text-lg font-semibold text-zinc-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{s.description}</p>
             
            </div>
          ))}
        </div>
      </section>

      {/* 3) COMMUNITY DESIGNS: like “Know more…” */}
      <section id="community" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-widest text-zinc-500">COMMUNITY</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
              Community Designs
            </h2>
            <p className="mt-4 text-lg leading-7 text-zinc-600">
              Browse designs and the stories behind them. Start from a proven build, then
              remix dimensions, materials, and details to match your space.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-900/10 hover:bg-zinc-900/5">
              Filter
            </button>
            <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              View all
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {designs.map((d, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white/60 p-6 shadow-sm ring-1 ring-zinc-900/10 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">{d.title}</h3>
                  <p className="mt-1 text-xs font-medium text-zinc-500">{d.tag}</p>
                </div>
                <span className="rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/20">
                  Remix
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="relative h-40 overflow-hidden rounded-xl bg-[radial-gradient(600px_240px_at_40%_30%,rgba(99,102,241,0.20),transparent_60%),radial-gradient(520px_220px_at_80%_70%,rgba(217,70,239,0.14),transparent_60%)] ring-1 ring-zinc-900/10">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(24,24,27,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(24,24,27,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
                  <div className="absolute bottom-3 left-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-900/10">
                    Preview
                  </div>
                </div>

                <div className="flex flex-col">
                  <p className="text-sm leading-6 text-zinc-600">{d.story}</p>
                  <div className="mt-auto pt-4">
                    <button className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
                      Open in editor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4) TESTIMONIALS: dark section like screenshot */}
      <section className="bg-zinc-950 py-20 text-white">
        <div className="mx-auto w-full max-w-6xl px-6">
          <p className="text-center text-xs font-semibold tracking-widest text-white/60">
            TESTIMONIALS
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center text-4xl font-semibold tracking-tight md:text-5xl">
            We have worked with many amazing people
          </h2>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
              >
                <StarRow rating={t.rating} />
                <p className="mt-4 text-sm leading-6 text-white/80">“{t.quote}”</p>

                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/10 ring-1 ring-white/10" />
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-white/60">{t.handle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5) FAQ: accordion */}
      <section id="faq" className="bg-zinc-950 py-20 text-white">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="text-center text-4xl font-semibold tracking-tight md:text-5xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-6 text-white/70">
            Everything you need to know about designing, sharing, and turning a custom
            idea into a real piece of furniture.
          </p>

          <div className="mt-12">
            <FAQAccordion items={faqs} />
          </div>
        </div>
      </section>

      {/* 6) FOOTER: “Ready to dive in?” style CTA */}
      <footer className="bg-[linear-gradient(135deg,rgba(255,243,210,1),rgba(250,210,250,1),rgba(167,139,250,1))]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="rounded-[2.5rem] bg-white/55 p-10 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.35)] ring-1 ring-zinc-900/10 md:p-14">
            <div className="text-center">
              <p className="text-xs font-semibold tracking-widest text-zinc-500">
                GET STARTED
              </p>
              <h3 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
                Ready to dive in?
                <br />
                Start your first design today.
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
                Explore community templates, customize every detail, order and assemble your furniture at home.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="/design"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Start designing
                </a>
              </div>
            </div>

            <div className="mt-12 grid gap-10 border-t border-zinc-900/10 pt-10 md:grid-cols-5">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-indigo-700"
                      fill="currentColor"
                    >
                      <path d="M3 12c3-6 8-9 14-9 2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2zm0 8.8C6 14.8 11 12 17 12c2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold">Myble</span>
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  Design furniture from scratch. Faster, cleaner, and with community-driven
                  starting points.
                </p>
                <p className="mt-6 text-xs text-zinc-500">© {new Date().getFullYear()} Myble Inc.</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-900">Product</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li><a className="hover:text-zinc-900" href="#product">Editor</a></li>
                  <li><a className="hover:text-zinc-900" href="#community">Community designs</a></li>
                  <li><a className="hover:text-zinc-900" href="#">API</a></li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-900">Company</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li><a className="hover:text-zinc-900" href="#">About</a></li>
                  <li><a className="hover:text-zinc-900" href="#">Careers</a></li>
                  <li><a className="hover:text-zinc-900" href="#">Blog</a></li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-900">Support</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li><a className="hover:text-zinc-900" href="#">Help center</a></li>
                  <li><a className="hover:text-zinc-900" href="#">Community</a></li>
                  <li><a className="hover:text-zinc-900" href="#">Privacy</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pb-10" />
        </div>
      </footer>
    </div>
  );
}