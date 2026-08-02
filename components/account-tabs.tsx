"use client";

import { useState } from "react";
import { CalendarDays, UserRound } from "lucide-react";

import { ACCOUNT_TABS, type AccountTab } from "@/lib/account-tab";

const TAB_META = {
  details: { label: "Details", Icon: UserRound },
  bookings: { label: "My bookings", Icon: CalendarDays },
} as const;

/**
 * Details / My bookings.
 *
 * **Both panels are rendered on the server in the one page request and handed
 * in as props**, so switching tabs is a local state change — no navigation, no
 * RSC fetch, no second trip through `getUser()` and the database. It used to be
 * a pair of `<Link href="/account?tab=…">`s, which meant every click was a full
 * dynamic navigation: the proxy's session refresh, `requireUser()`, the booking
 * count and the booking page all re-ran before anything moved on screen.
 *
 * The URL still tracks the tab, via `history.replaceState` rather than the
 * router — Next reads its own history state back, so the address bar stays
 * shareable and `?tab=bookings` still opens on the right panel, without a
 * server round-trip.
 *
 * Both panels stay MOUNTED and are toggled with a class. Unmounting the details
 * panel would throw away whatever the user had typed into the profile form.
 */
export function AccountTabs({
  initialTab,
  bookingCount,
  details,
  bookings,
}: {
  initialTab: AccountTab;
  bookingCount: number;
  details: React.ReactNode;
  bookings: React.ReactNode;
}) {
  const [active, setActive] = useState<AccountTab>(initialTab);

  function select(tab: AccountTab) {
    if (tab === active) return;
    setActive(tab);
    window.history.replaceState(null, "", `/account?tab=${tab}`);
  }

  // Arrow keys move between tabs, as the tablist pattern expects.
  function onKeyDown(event: React.KeyboardEvent) {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;

    event.preventDefault();
    const index = ACCOUNT_TABS.indexOf(active);
    const next = ACCOUNT_TABS[(index + delta + ACCOUNT_TABS.length) % ACCOUNT_TABS.length];
    select(next);
    document.getElementById(`account-tab-${next}`)?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Account sections"
        onKeyDown={onKeyDown}
        className="inline-flex items-center gap-1 rounded-xl border bg-muted/50 p-1"
      >
        {ACCOUNT_TABS.map((tab) => {
          const { label, Icon } = TAB_META[tab];
          const isActive = tab === active;
          const count = tab === "bookings" ? bookingCount : 0;

          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`account-tab-${tab}`}
              aria-selected={isActive}
              aria-controls={`account-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(tab)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                // On a near-black surface a flat tint alone is invisible, so the
                // selected segment carries a ring too (docs/DESIGN.md).
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
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="account-panel-details"
        aria-labelledby="account-tab-details"
        className={active === "details" ? "mt-8" : "hidden"}
      >
        {details}
      </div>

      <div
        role="tabpanel"
        id="account-panel-bookings"
        aria-labelledby="account-tab-bookings"
        className={active === "bookings" ? "mt-8" : "hidden"}
      >
        {bookings}
      </div>
    </>
  );
}
