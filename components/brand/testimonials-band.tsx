import { Crest } from "@/components/brand/crest";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

export type Testimonial = {
  quote: string;
  /** Who said it. Rendered in gold — the one accent this band spends. */
  name: string;
  /** Their relation to the school: "Parent", "Old Boy", "Coach". */
  role: string;
};

/**
 * The testimonials band — a compact sibling of signature component 3.
 *
 * Same deep-green `--band` ground as the CTA band, deliberately shorter: an
 * eyebrow, one serif line and two or three quotes in a row. It is a quiet
 * closing note above the footer, not another full section, so the vertical
 * padding stays well under the CTA band's and the quotes are separated by
 * hairlines rather than sitting in cards.
 *
 * Everything reads band tokens rather than page tokens, so the band stays a
 * deep-green anchor in both themes instead of inverting with the page. Gold is
 * spent exactly twice — the eyebrow and the attribution names (4.69:1 on the
 * band in light, and lifted after dark) — which is the most the brand skill
 * allows outside the footer.
 */
export function TestimonialsBand({
  label = "What people say",
  title,
  testimonials,
  className,
}: {
  label?: string;
  title: React.ReactNode;
  testimonials: Testimonial[];
  className?: string;
}) {
  return (
    // `data-flush-footer`, like the CTA band: this is the last block on the
    // page, so it meets the footer directly and the two greens read as one
    // grounded base rather than being split by a strip of white.
    <section
      data-flush-footer
      className={cn(
        "relative isolate overflow-hidden bg-band text-band-foreground",
        className
      )}
    >
      {/* Watermark. The crest at a whisper of opacity, bled off the bottom
          right — an institutional touch that costs nothing and never competes
          with the quotes. Hidden on small screens, where it would sit under the
          text instead of beside it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -bottom-16 -z-10 hidden opacity-[0.07] md:block"
      >
        <Crest size={300} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:py-14">
        <div className="flex max-w-xl flex-col gap-2.5">
          <Eyebrow tone="gold">{label}</Eyebrow>
          <h2 className="text-2xl sm:text-3xl">{title}</h2>
        </div>

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 md:mt-10 md:gap-8 lg:grid-cols-3">
          {testimonials.map((t) => (
            <li
              key={t.name}
              // A hairline above each quote rather than a card: on a coloured
              // band a bordered box would read as a second surface. Top rules
              // (not column rules) so the grid stays correct at every
              // breakpoint without per-column nth-child exceptions.
              className="flex flex-col gap-4 border-t border-band-border pt-5"
            >
              <blockquote className="text-[0.9375rem] leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* `mt-auto` keeps the attributions on one line across the row
                  even when the quotes differ in length. */}
              <div className="mt-auto flex flex-col gap-1">
                <span className="font-heading text-sm font-semibold text-gold">
                  {t.name}
                </span>
                <span className="text-[0.7rem] font-medium tracking-[0.16em] text-band-muted uppercase">
                  {t.role}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
