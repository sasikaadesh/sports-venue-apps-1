import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

/**
 * Signature component 1 — the labelled feature card.
 *
 * A mint card with a hairline border carrying a green eyebrow, a serif
 * sub-heading, a short paragraph of supporting text and an optional green text
 * link. Modelled on the "Academics that build character" box on the school's
 * own site. Use it to highlight a feature or a section; do not use it as a
 * generic container (that is what `components/ui/card.tsx` is for).
 */
export function FeatureCard({
  label,
  title,
  children,
  href,
  linkLabel = "Learn more",
  className,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // The reference card, element for element: a soft --mint ground, a
        // hairline --border (no shadow — the tint is what lifts it off the
        // white section), generous padding, and a slightly tightened radius so
        // it reads refined rather than bubbly.
        "flex h-full flex-col items-start gap-2.5 rounded-lg border border-border bg-tint-strong p-7",
        className
      )}
    >
      <Eyebrow tone="green">{label}</Eyebrow>

      {/* Serif sub-heading — the eyebrow/serif pair is the whole point of this
          card, so the heading stays in the heading face at a normal weight. */}
      <h3 className="mt-0.5 text-xl leading-snug">{title}</h3>

      <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
        {children}
      </p>

      {href && (
        <Link
          href={href}
          className="group mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {linkLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
