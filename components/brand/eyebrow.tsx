import { cn } from "@/lib/utils";

/**
 * A small uppercase, letter-spaced label that sits above a serif heading
 * ("ACADEMICS", "ADMISSIONS 2026" on the school's own site).
 *
 * One of the load-bearing brand details: the eyebrow/serif-heading pair is what
 * gives a section its institutional rhythm. `tone` picks between the quiet
 * default and the green used when the eyebrow is doing the accenting itself.
 */
export function Eyebrow({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "green" | "gold" | "on-band";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.18em] uppercase",
        tone === "muted" && "text-muted-foreground",
        tone === "green" && "text-primary",
        tone === "gold" && "text-gold",
        tone === "on-band" && "text-band-muted",
        className
      )}
    >
      {children}
    </p>
  );
}
