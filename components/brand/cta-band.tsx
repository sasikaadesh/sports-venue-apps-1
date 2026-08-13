import { Eyebrow } from "@/components/brand/eyebrow";
import { LinkButton } from "@/components/link-button";
import { cn } from "@/lib/utils";

/**
 * Signature component 3 — the deep-green CTA band.
 *
 * A full-width `--band` section carrying a white serif heading, a short line of
 * supporting text and up to two actions: one gold (the primary move) and one
 * outlined (the secondary). Modelled on the "Best chapter of your story starts
 * here." section of the school's site, and used to anchor the important call to
 * action at the foot of a page.
 *
 * Everything here reads band tokens rather than page tokens, so the section
 * stays a deep-green anchor in both themes instead of inverting with the page.
 */
export function CtaBand({
  label,
  title,
  children,
  primary,
  secondary,
  className,
}: {
  label?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  className?: string;
}) {
  return (
    // `data-flush-footer` tells the site layout to drop the gap it normally
    // leaves above the footer — see app/(public)/layout.tsx. A CTA band is
    // always the last thing on its page, so it meets the footer directly and
    // the two greens read as one grounded base.
    <section
      data-flush-footer
      className={cn("bg-band text-band-foreground", className)}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:px-8 lg:py-20">
        {label && <Eyebrow tone="on-band">{label}</Eyebrow>}

        <h2 className="max-w-2xl text-3xl sm:text-4xl">{title}</h2>

        {children && (
          <p className="max-w-xl leading-relaxed text-band-muted">{children}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <LinkButton href={primary.href} variant="gold" size="lg">
            {primary.label}
          </LinkButton>

          {secondary && (
            <LinkButton href={secondary.href} variant="on-band" size="lg">
              {secondary.label}
            </LinkButton>
          )}
        </div>
      </div>
    </section>
  );
}
