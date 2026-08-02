/**
 * Which section of the account page is open.
 *
 * Deliberately its own module, with no `server-only` and no imports: the tab
 * bar is a client component, and every export of a `"use client"` file becomes
 * a client reference that a Server Component cannot call. The page needs to
 * parse `?tab=` on the server, so the parser lives here where both sides can
 * reach it.
 */

export const ACCOUNT_TABS = ["details", "bookings"] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** Whatever arrives in `?tab=`, narrowed to a tab we actually render. */
export function parseAccountTab(value: string | undefined): AccountTab {
  return value === "bookings" ? "bookings" : "details";
}
