"use client";

import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

/**
 * A spinner that appears while the enclosing `<Link>`'s navigation is in
 * flight. Drop it inside a `<Link>`; it renders nothing the rest of the time.
 *
 * `useLinkStatus` reports the pending state of the nearest Link, which is the
 * only way to acknowledge a click on a *dynamic* route before the server
 * answers — there is no cached payload to swap in, so without this the button
 * looks ignored for as long as the query takes.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <LoaderCircle
      aria-hidden
      className={className ?? "size-4 shrink-0 animate-spin"}
    />
  );
}
