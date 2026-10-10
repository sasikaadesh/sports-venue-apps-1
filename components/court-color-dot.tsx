import { courtColorName } from "@/lib/court-colors";
import { cn } from "@/lib/utils";

/**
 * A court's colour, as a small dot — never the only thing that identifies the
 * court. Every caller renders the court's name right next to this, same as
 * every other row in this app that carries a status: colour is a fast visual
 * aid for scanning a list, not the signal itself (CLAUDE.md-equivalent
 * accessibility rule stated in the court-colour request).
 *
 * `aria-hidden`: the colour is decorative to a screen reader — the name beside
 * it is the actual information, so this never needs its own label and never
 * needs the palette name read aloud.
 */
export function CourtColorDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      title={courtColorName(color)}
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/20",
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}
