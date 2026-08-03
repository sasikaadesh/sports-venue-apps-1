import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Five stars, filled to `value`.
 *
 * Read-only and server-renderable — the interactive picker is a separate,
 * client-side control in `conduct-dialog.tsx`. Colour follows the project's
 * one accent (`text-primary`), so it themes itself in both light and dark;
 * "empty" is a `muted-foreground` outline rather than a lighter green, because
 * a low-opacity accent all but vanishes on the near-black dark surface.
 */
export function StarRating({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(value);
  const starSize = size === "md" ? "size-4.5" : "size-3.5";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            starSize,
            n <= rounded
              ? "fill-primary text-primary"
              : "text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  );
}
