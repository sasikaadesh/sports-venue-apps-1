"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Background photo carousel for the home hero band.
 *
 * Purely atmospheric: it sits behind the headline (never behind the booking
 * bar, which lives in its own solid band below). A dark overlay keeps the white
 * headline readable over any slide. Slides auto-advance every 4s with a 450ms
 * crossfade, and pause on hover; the dots are the manual control.
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

/** Auto-advance cadence. Must stay comfortably longer than the crossfade. */
const INTERVAL_MS = 4000;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [paused]);

  const pause = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
  };

  return (
    <>
      {/* Background layer: slides + overlay, behind the headline (-z-10). */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-black" {...pause}>
        {SLIDES.map((slide, i) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt=""
            aria-hidden="true"
            fill
            priority={i === 0}
            sizes="100vw"
            className={`object-cover transition-opacity duration-[450ms] ease-in-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Dark overlay — stronger on the left, where the headline sits. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Controls layer: sits above the headline so the dots stay clickable. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center gap-2.5"
        {...pause}
      >
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setIndex(i)}
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
    </>
  );
}
