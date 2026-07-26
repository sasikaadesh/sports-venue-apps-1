"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  CalendarDays,
  Home,
  Inbox,
  LayoutGrid,
  Shapes,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/admin/court-types", label: "Court types", icon: Shapes },
  { href: "/admin/courts", label: "Courts", icon: Home },
  { href: "/admin/blocks", label: "Block slots", icon: Ban },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/messages", label: "Messages", icon: Inbox },
];

/**
 * `unreadMessages` is passed in from the server layout rather than fetched
 * here — this is a client component (it needs `usePathname`), so it has no
 * database access of its own.
 */
export function AdminNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();

  return (
    // `overflow-y-hidden` is load-bearing, not decoration. Per CSS overflow,
    // setting `overflow-x: auto` makes a `visible` overflow-y compute to
    // `auto` as well — and the `-mb-px` that pulls each tab onto the header's
    // bottom border overflows this box by exactly one pixel. That was enough
    // for Windows to paint a real vertical scrollbar, complete with up/down
    // arrow buttons, at the right-hand end of this row. Pinning overflow-y
    // removes it while leaving the horizontal scroll these tabs need on narrow
    // screens.
    <nav className="mx-auto w-full max-w-6xl overflow-x-auto overflow-y-hidden px-6">
      <ul className="flex items-center gap-1">
        {LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
                {href === "/admin/messages" && unreadMessages > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                    {unreadMessages}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
