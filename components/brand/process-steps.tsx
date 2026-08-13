import { cn } from "@/lib/utils";

export type ProcessStep = {
  title: string;
  body: string;
};

/**
 * Signature component 2 — the numbered process row.
 *
 * Large, faint serif numerals (01 / 02 / 03) above a serif step title and a
 * short line of supporting text, as in the school site's "Your move, made
 * simple." section.
 *
 * Only for genuine sequences. The brand skill is explicit about this, and it is
 * a real constraint rather than a stylistic one: numbering a set of unordered
 * features tells the reader to do them in order, which is a lie the design
 * cannot walk back. If the items have no order, use `FeatureCard` instead.
 *
 * Rendered as an <ol> so the sequence is in the markup, not only in the paint.
 * The numerals themselves are aria-hidden — the list already conveys order to a
 * screen reader, and "zero one" read aloud before every heading is noise.
 */
export function ProcessSteps({
  steps,
  className,
}: {
  steps: ProcessStep[];
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-10 sm:grid-cols-3", className)}>
      {steps.map((step, i) => (
        <li key={step.title} className="flex flex-col items-start gap-2">
          <span
            aria-hidden
            className="font-heading text-5xl leading-none font-semibold text-primary/25 tabular-nums"
          >
            {String(i + 1).padStart(2, "0")}
          </span>

          <h3 className="pt-2 text-xl">{step.title}</h3>

          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
