import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * A Button that navigates.
 *
 * Base UI's Button assumes a native <button> unless told otherwise, so
 * rendering a Link through it needs `nativeButton={false}` — without it the
 * element keeps button semantics it does not have. Wrapping that here keeps
 * every call site from having to remember.
 */
export function LinkButton({
  href,
  target,
  rel,
  ...props
}: React.ComponentProps<typeof Button> & {
  href: string;
  /** Anchor attributes, so they go on the Link — a <button> has neither. */
  target?: string;
  rel?: string;
}) {
  return (
    <Button
      {...props}
      nativeButton={false}
      render={<Link href={href} target={target} rel={rel} />}
    />
  );
}
