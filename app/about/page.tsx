"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import posthog from "posthog-js";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { Reveal } from "../../components/Reveal";
import { StoryBlock, type OffsetCard } from "../../components/StoryBlock";
import { StoryRail } from "../../components/StoryRail";
import { useI18n, tList } from "../../lib/i18n";

const IMG = "/img/story";

type BlockSpec = {
  key: "b1" | "b2" | "b3" | "b4" | "b5";
  n: string;
  src: string;
  side: "left" | "right";
  /** i18n keys for the chips that sit on the main photo. */
  chipKeys?: readonly string[];
  offsets?: readonly { src: string; altKey: string; pos: string }[];
};

// Offset-card placement hangs off the photo's *outer* edge, into the padding
// the media column reserves there (lg:pr-12 / lg:pl-12), so nothing can push
// past the container and cause a horizontal scrollbar.
const BLOCKS: readonly BlockSpec[] = [
  { key: "b1", n: "01", src: `${IMG}/story-01-need.jpg`, side: "right" },
  {
    key: "b2",
    n: "02",
    src: `${IMG}/story-02-plan.jpg`,
    side: "left",
    chipKeys: ["chip1", "chip2"],
    offsets: [{ src: `${IMG}/story-02b-cutlist.jpg`, altKey: "alt2", pos: "w-[36%] -bottom-10 -left-12 rotate-[3deg]" }],
  },
  {
    key: "b3",
    n: "03",
    src: `${IMG}/story-03-cut.jpg`,
    side: "right",
    offsets: [{ src: `${IMG}/story-03b-carry.jpg`, altKey: "alt2", pos: "w-[36%] -bottom-10 -right-12 rotate-[-4deg]" }],
  },
  {
    key: "b4",
    n: "04",
    src: `${IMG}/story-04-drill.jpg`,
    side: "left",
    chipKeys: ["chip1"],
    offsets: [
      { src: `${IMG}/story-04b-dowels.jpg`, altKey: "alt2", pos: "z-20 w-[31%] -bottom-12 -left-12 rotate-[-6deg]" },
      { src: `${IMG}/story-04c-frame.jpg`, altKey: "alt3", pos: "z-10 w-[31%] -bottom-6 left-[18%] rotate-[4deg]" },
    ],
  },
  {
    key: "b5",
    n: "05",
    src: `${IMG}/story-05-done.jpg`,
    side: "right",
    chipKeys: ["chip1"],
    offsets: [{ src: `${IMG}/story-05b-piece.jpg`, altKey: "alt2", pos: "w-[36%] -bottom-10 -right-12 rotate-[-4deg]" }],
  },
];

type TallyRow = { v: string; l: string };
type MybleStep = { n: string; t: string; b: string };

export default function AboutPage() {
  const { t, locale } = useI18n();
  const railRef = useRef<HTMLDivElement | null>(null);

  const mine = (tList(locale, "about.story.tally.mine") as TallyRow[]) ?? [];
  const myble = (tList(locale, "about.story.tally.myble") as TallyRow[]) ?? [];
  const steps = (tList(locale, "about.story.myble.steps") as MybleStep[]) ?? [];

  return (
    <main className="min-h-screen overflow-x-clip bg-white text-zinc-900">
      <SiteHeader variant="app" />

      {/* Hero — no image, all whitespace */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12 sm:pb-16 sm:pt-20">
        <Link href="/" className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900">
          ← {t("nav.backHome")}
        </Link>
        <Reveal className="mt-10 max-w-3xl sm:mt-14">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-indigo-600">
            {t("about.story.eyebrow")}
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-900 sm:text-6xl">
            {t("about.story.h1")}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
            {t("about.story.lede")}
          </p>
        </Reveal>
      </section>

      {/* Story rail — sticky measuring tape (lg+) beside five alternating blocks */}
      <div className="mx-auto w-full max-w-6xl px-5 pb-8">
        <div className="lg:grid lg:grid-cols-[3.5rem_minmax(0,1fr)] lg:gap-8">
          <StoryRail numbers={BLOCKS.map((b) => b.n)} containerRef={railRef} />
          <div ref={railRef}>
            {BLOCKS.map((b, i) => {
              const base = `about.story.${b.key}`;
              const offsets: OffsetCard[] = (b.offsets ?? []).map((o) => ({
                src: o.src,
                alt: t(`${base}.${o.altKey}`),
                pos: o.pos,
              }));
              return (
                <StoryBlock
                  key={b.key}
                  n={b.n}
                  heading={t(`${base}.h`)}
                  paras={[t(`${base}.p1`), t(`${base}.p2`), t(`${base}.p3`)]}
                  caption={t(`${base}.cap`)}
                  src={b.src}
                  alt={t(`${base}.alt`)}
                  side={b.side}
                  chips={(b.chipKeys ?? []).map((k) => t(`${base}.${k}`))}
                  offsets={offsets}
                  priority={i === 0}
                >
                  {b.key === "b5" ? <DrawnBuilt /> : null}
                </StoryBlock>
              );
            })}
          </div>
        </div>
      </div>

      {/* The turn — the emotional pivot, on dark */}
      <section className="bg-zinc-900 text-white">
        <div className="mx-auto w-full max-w-4xl px-5 py-24">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">{t("about.story.turn.h")}</h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-8 text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{t("about.story.turn.p1")}</p>
            <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{t("about.story.turn.p2")}</p>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-10 text-2xl font-medium leading-tight tracking-[-0.02em] text-zinc-400 sm:text-3xl">
              {t("about.story.turn.big")}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-10 text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{t("about.story.turn.p3")}</p>
          </Reveal>
        </div>
      </section>

      {/* The tally — mono then/now strip */}
      <section className="bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-24">
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-8">
            <div>
              <h3 className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                {t("about.story.tally.mineTitle")}
              </h3>
              <ul className="mt-6 space-y-5">
                {mine.map((row, i) => (
                  <Reveal as="li" key={row.l} delay={i * 70}>
                    <p className="font-mono text-2xl text-zinc-500">{row.v}</p>
                    <p className="mt-1 text-sm text-zinc-500">{row.l}</p>
                  </Reveal>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-white/[0.03] p-6 ring-1 ring-indigo-500/30 sm:p-8">
              <h3 className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-indigo-400">
                {t("about.story.tally.mybleTitle")}
              </h3>
              <ul className="mt-6 space-y-5">
                {myble.map((row, i) => (
                  <Reveal as="li" key={row.l} delay={i * 70}>
                    <p className="font-mono text-2xl text-white">{row.v}</p>
                    <p className="mt-1 text-sm text-zinc-300">{row.l}</p>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Enter Myble — the homepage step-card treatment */}
      <section className="mx-auto w-full max-w-6xl px-5 py-24">
        <Reveal>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-indigo-600">
            {t("about.story.myble.eyebrow")}
          </p>
          <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
            {t("about.story.myble.h")}
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="border-t-2 border-zinc-900 pt-6">
                <span className="font-mono text-sm font-medium text-zinc-400">{s.n}</span>
                <h3 className="mt-4 text-base font-semibold text-zinc-900 sm:text-lg">{s.t}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{s.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <p className="mt-12 max-w-2xl text-base leading-7 text-zinc-600">{t("about.story.myble.close")}</p>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-zinc-200">
        <div className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
              {t("about.story.cta.h")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-600">{t("about.story.cta.p")}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/design"
                onClick={() => posthog.capture("about_cta_clicked", { location: "about_footer" })}
                className="press inline-flex items-center justify-center rounded-xl bg-indigo-600 px-7 py-4 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {t("about.story.cta.primary")}
              </Link>
              <Link
                href="/#jak"
                className="inline-flex items-center justify-center px-1 py-4 text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
              >
                {t("about.story.cta.secondary")} →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

/** Block 05's callback: the final photo is the block-01 sketch, built. */
function DrawnBuilt() {
  const { t } = useI18n();
  return (
    <div className="mt-8 flex items-center gap-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
      <figure className="shrink-0">
        <Image
          src={`${IMG}/story-01-need.jpg`}
          alt={t("about.story.b1.alt")}
          width={787}
          height={1400}
          loading="lazy"
          sizes="96px"
          className="h-auto w-24 rounded-xl object-cover ring-1 ring-zinc-900/10"
        />
        <figcaption className="mt-2 font-mono text-[11px] text-zinc-400">{t("about.story.b5.drawn")}</figcaption>
      </figure>
      <span aria-hidden className="font-mono text-lg text-zinc-300">
        →
      </span>
      <figure className="shrink-0">
        <Image
          src={`${IMG}/story-05-done.jpg`}
          alt={t("about.story.b5.alt")}
          width={787}
          height={1400}
          loading="lazy"
          sizes="96px"
          className="h-auto w-24 rounded-xl object-cover ring-1 ring-zinc-900/10"
        />
        <figcaption className="mt-2 font-mono text-[11px] text-zinc-400">{t("about.story.b5.built")}</figcaption>
      </figure>
    </div>
  );
}
