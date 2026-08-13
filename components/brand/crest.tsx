import Image from "next/image";
import Link from "next/link";

import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The school crest.
 *
 * A transparent PNG, so it sits directly on any surface — including the
 * deep-green footer — without a white plate behind it. Never recoloured and
 * never stretched: it is rendered square, at whatever size the caller asks for,
 * and given clear space by the layouts that use it.
 */
export function Crest({
  size = 32,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={BRAND.logo}
      alt={`${BRAND.name} crest`}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Crest + name, as the clickable identity in a header or footer.
 *
 * `subdued` is for dark bands (the footer), where the surrounding text is
 * already light and the wordmark should not shout.
 */
export function Wordmark({
  href = "/",
  size = 36,
  className,
  subdued = false,
  priority = false,
}: {
  href?: string | null;
  size?: number;
  className?: string;
  subdued?: boolean;
  priority?: boolean;
}) {
  const inner = (
    <>
      <Crest size={size} priority={priority} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "truncate font-heading text-[0.95rem] font-semibold",
            subdued ? "text-band-foreground" : "text-foreground"
          )}
        >
          {BRAND.name}
        </span>
        <span
          className={cn(
            "mt-1 truncate text-[0.6rem] font-medium tracking-[0.16em] uppercase",
            subdued ? "text-band-muted" : "text-muted-foreground"
          )}
        >
          Sports Booking
        </span>
      </span>
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-2.5 transition-opacity hover:opacity-80",
    className
  );

  if (href === null) {
    return <span className={classes}>{inner}</span>;
  }

  return (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  );
}
