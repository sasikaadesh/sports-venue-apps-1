"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { BRAND } from "@/lib/brand";

/**
 * The home hero band: photo carousel, headline copy, a per-slide CTA and the
 * dots, as one component (never extending behind the booking bar, which lives
 * in its own solid band below). A dark overlay keeps the white copy readable
 * over any slide. Photos auto-advance every 4s with a 450ms crossfade and
 * pause on hover; the headline and CTA swap instantly alongside them, since
 * both are tied to the same slide index. The dots are the manual control.
 *
 * Placeholders are Unsplash sports photos (docs/DESIGN.md), whitelisted in
 * next.config.ts and served through next/image. The client swaps these for
 * real court photography later.
 */

const SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1920&q=80",
    alt: "Floodlit tennis court at dusk",
  },
  {
    src: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1920&q=80",
    alt: "Cricketer batting under stadium lights",
  },
  {
    src: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1920&q=80",
    alt: "Empty indoor basketball court",
  },
  {
    src: "https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=1920&q=80",
    alt: "Table tennis paddle and ball on a blue table",
  },
];

/**
 * One call to action per slide, cycled by index. Three distinct destinations
 * for four slides — the fourth repeats the first, which is deliberate: of the
 * three, booking a court is the single most important action on the whole
 * page, so it is the one allowed to reappear and the only one in gold (the
 * brand's rare accent, reserved for exactly that).
 */
const CTAS = [
  { label: "Book a Court", href: "#book", variant: "gold" as const },
  { label: "Rules & Info", href: "/rules", variant: "outline" as const },
  { label: "Contact Us", href: "/contact", variant: "outline" as const },
];

/**
 * Two headline/copy sets, alternating A/B/A/B across the four slides. Short
 * and punchy on purpose — this sits over a photo at a glance, not read like
 * body copy. Keeping it to two sets (rather than one per slide) means the
 * copy repeats often enough to actually register with someone who only
 * glances at the hero once or twice before scrolling past.
 */
const HERO_CONTENT = [
  {
    title: (
      <>
        The courts are
        <br />
        <span className="text-photo-gold italic">open to you.</span>
      </>
    ),
    text: "Cricket nets, tennis, table tennis and more. Check what's free, reserve your slot, and pay online — no phone calls, no clipboard.",
  },
  {
    title: (
      <>
        Play on
        <br />
        <span className="text-photo-gold italic">your schedule.</span>
      </>
    ),
    text: "Evening slots, weekend sessions — find an open court, book it, and you're set.",
  },
];

/** Auto-advance cadence. Must stay comfortably longer than the crossfade. */
const INTERVAL_MS = 4000;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  /**
   * Whether the slides past the first two are in the DOM yet.
   *
   * All four used to mount at once, so the landing page downloaded four
   * full-bleed hero photos before it was interactive — and the three the
   * visitor would not see for another four seconds competed for bandwidth with
   * the one they were looking at. Only the first two are needed to paint the
   * hero and run the first crossfade; the rest mount as soon as anything moves,
   * by which time the page has settled.
   *
   * Nothing un-mounts: once a photo is fetched, keeping it costs nothing and
   * fading back to it stays instant.
   */
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
      // The first advance is also the cue to bring in the remaining slides —
      // see `showAll` below.
      setShowAll(true);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused]);

  const pause = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
  };

  const cta = CTAS[index % CTAS.length];

  return (
    <div className="relative isolate overflow-hidden">
      {/* Background layer: slides + overlay, behind the content (-z-10). */}
      <div
        className="absolute inset-0 -z-10 overflow-hidden bg-black"
        {...pause}
      >
        {SLIDES.map((slide, i) =>
          i > 1 && !showAll ? null : (
            <Image
              key={slide.src}
              src={slide.src}
              alt=""
              aria-hidden="true"
              fill
              // Only the slide actually on screen is worth blocking on. The
              // second one loads normally, in time for the first crossfade.
              priority={i === 0}
              sizes="100vw"
              className={`object-cover transition-opacity duration-[450ms] ease-in-out ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          )
        )}

        {/* Dark overlay — stronger on the left, where the headline sits. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Headline + CTA, in normal flow so the button sits a fixed, natural
          gap below the copy no matter how many lines it wraps to — an
          absolutely-positioned button pinned to the band's bottom edge would
          either crowd the dots or the text depending on viewport height. */}
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 lg:py-28">
        <div className="flex max-w-2xl flex-col items-start gap-5">
          {/* Fixed light-on-photo, as with the CTA below it — this sits on
              photography, not a themed surface, so it stays literal white in
              both themes. Shared across both copy sets (identical either
              way), so it stays outside the height-matched stack below. */}
          <p className="text-xs font-semibold tracking-[0.18em] text-white/75 uppercase">
            {BRAND.name} &middot; Established {BRAND.established}
          </p>

          {/* Both copy sets are mounted at once, stacked in the same grid
              cell (`col-start-1 row-start-1`) — the hidden one stays
              `invisible` rather than unmounted, so it still occupies layout
              space. A CSS grid cell auto-sizes to its *tallest* occupant, so
              this row is always exactly as tall as set A or set B, whichever
              wraps to more lines — no jump as the carousel swaps between
              them, at any viewport width, without a guessed pixel height. */}
          <div className="grid w-full">
            {HERO_CONTENT.map((set, i) => {
              const active = i === index % HERO_CONTENT.length;
              return (
                <div
                  key={i}
                  aria-hidden={!active}
                  className={`col-start-1 row-start-1 flex flex-col gap-5 ${active ? "" : "invisible"}`}
                >
                  <h1 className="font-display text-5xl leading-[1.1] text-white sm:text-6xl">
                    {set.title}
                  </h1>
                  <p className="max-w-lg text-lg leading-relaxed text-white/80">
                    {set.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* The CTA layer: one button per slide. The left column is also
              where the overlay above is darkest, so it keeps full contrast
              against any photo underneath. */}
          <LinkButton
            key={index}
            href={cta.href}
            variant={cta.variant}
            size="lg"
            className={
              cta.variant === "outline"
                ? // Literal white, not theme tokens — like the headline
                  // above it, this sits on photography in both themes, never
                  // on a themed page surface, so it must not invert in dark
                  // mode.
                  "mt-1 h-11 border-white/70 bg-black/10 px-6 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white dark:border-white/70 dark:bg-black/10 dark:hover:bg-white/15"
                : "mt-1 h-11 px-6 shadow-md shadow-black/30"
            }
          >
            {cta.label}
            <ArrowRight />
          </LinkButton>
        </div>
      </div>

      {/* Controls layer: sits above everything so the dots stay clickable. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center gap-2.5"
        {...pause}
      >
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => {
              // Mount the rest before jumping, so a dot press cannot land on a
              // slide that is not in the DOM yet.
              setShowAll(true);
              setIndex(i);
            }}
            aria-label={`Show slide ${i + 1}: ${slide.alt}`}
            aria-current={i === index}
            className={`pointer-events-auto h-1.5 rounded-full transition-all ${
              i === index
                ? "w-7 bg-white"
                : "w-2.5 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
