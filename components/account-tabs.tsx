import Link from "next/link";
import { CalendarDays, UserRound } from "lucide-react";

export const ACCOUNT_TABS = ["details", "bookings"] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** Whatever arrives in `?tab=`, narrowed to a tab we actually render. */
export function parseAccountTab(value: string | undefined): AccountTab {
  return value === "bookings" ? "bookings" : "details";
}

/**
 * Details / My bookings.
 *
 * Links, not client state: the tab lives in the URL, so a bookings page is
 * shareable and bookmarkable, the back button steps through it, and the whole
 * account page stays a server component — which matters because the bookings
 * list is a database read that must never be cached (the PayHere webhook
 * changes a booking's status without the browser being involved).
 *
 * The active segment carries a background AND a ring: on a near-black surface a
 * flat tint alone is invisible (docs/DESIGN.md).
 */
export function AccountTabs({
  active,
  bookingCount,
}: {
  active: AccountTab;
  bookingCount: number;
}) {
  const tabs = [
    { key: "details" as const, label: "Details", Icon: UserRound, count: 0 },
    {
      key: "bookings" as const,
      label: "My bookings",
      Icon: CalendarDays,
      count: bookingCount,
    },
  ];

  return (
    <nav
      aria-label="Account sections"
      className="inline-flex items-center gap-1 rounded-xl border bg-muted/50 p-1"
    >
      {tabs.map(({ key, label, Icon, count }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={`/account?tab=${key}`}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
              isActive
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
            {count > 0 && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                  isActive
                    ? "bg-primary/15 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
