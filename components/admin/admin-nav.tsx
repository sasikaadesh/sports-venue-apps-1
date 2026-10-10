"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  CalendarDays,
  ChevronDown,
  Home,
  Inbox,
  LayoutGrid,
  Menu as MenuIcon,
  MessageSquarePlus,
  Shapes,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The tab bar's two groups.
 *
 * `PRIMARY` is what fits on one line at every width this panel is actually
 * used at (a desk or a tablet) without wrapping or scrolling. `SECONDARY` is
 * everything reached far less often — moved into the "More" menu rather than
 * onto a second row, which (tried first) just produced a ragged two-line bar
 * with the same items-per-screen-width problem one row down.
 */
const PRIMARY = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  {
    href: "/admin/court-types",
    label: "Court types",
    icon: Shapes,
    exact: false,
  },
  { href: "/admin/courts", label: "Courts", icon: Home, exact: false },
  { href: "/admin/blocks", label: "Block slots", icon: Ban, exact: false },
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: CalendarDays,
    exact: false,
  },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/messages", label: "Messages", icon: Inbox, exact: false },
] as const;

const SECONDARY = [
  {
    href: "/admin/special-requests",
    label: "Special requests",
    icon: MessageSquarePlus,
    exact: false,
  },
  // Not nested under /admin — this links out to the standalone shell security
  // staff also use (app/bookings/layout.tsx), so `active` below never matches
  // it via `startsWith`, which is deliberate: it is a different page family.
  {
    href: "/bookings",
    label: "Bookings overview",
    icon: CalendarDays,
    exact: false,
  },
  {
    href: "/admin/security-staff",
    label: "Security staff",
    icon: ShieldCheck,
    exact: false,
  },
] as const;

const ALL_LINKS = [...PRIMARY, ...SECONDARY];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

/**
 * `unreadMessages` and `newRequests` are passed in from the server layout
 * rather than fetched here — this is a client component (it needs
 * `usePathname`), so it has no database access of its own.
 */
export function AdminNav({
  unreadMessages = 0,
  newRequests = 0,
}: {
  unreadMessages?: number;
  newRequests?: number;
}) {
  const pathname = usePathname();
  const counts: Record<string, number> = {
    "/admin/messages": unreadMessages,
    "/admin/special-requests": newRequests,
  };

  const secondaryActive = SECONDARY.some((link) =>
    isActive(pathname, link.href, false)
  );
  const secondaryCount = SECONDARY.reduce(
    (sum, link) => sum + (counts[link.href] ?? 0),
    0
  );

  return (
    <nav className="mx-auto w-full max-w-6xl px-6">
      {/* Desktop/tablet: one row, never scrolls. The seven most-used tabs
          plus a "More" menu for the rest — see PRIMARY/SECONDARY above. */}
      <ul className="hidden items-center gap-1 md:flex">
        {PRIMARY.map(({ href, label, icon: Icon, exact }) => (
          <TabLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(pathname, href, exact)}
            count={counts[href] ?? 0}
          />
        ))}

        <li>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none",
                secondaryActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              More
              <ChevronDown className="size-3.5" />
              <CountBadge count={secondaryCount} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SECONDARY.map(({ href, label, icon: Icon }) => (
                <DropdownMenuLinkItem
                  key={href}
                  render={<Link href={href} />}
                  className={cn(
                    isActive(pathname, href, false) &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                  <span className="ml-auto">
                    <CountBadge count={counts[href] ?? 0} />
                  </span>
                </DropdownMenuLinkItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>

      {/* Phone: the whole tab bar collapses into one menu button rather than
          wrapping or scrolling. */}
      <div className="py-2 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground outline-none">
            <MenuIcon className="size-4" />
            {ALL_LINKS.find((l) => isActive(pathname, l.href, l.exact))
              ?.label ?? "Menu"}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {PRIMARY.map(({ href, label, icon: Icon, exact }) => (
              <DropdownMenuLinkItem
                key={href}
                render={<Link href={href} />}
                className={cn(
                  isActive(pathname, href, exact) &&
                    "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
                <span className="ml-auto">
                  <CountBadge count={counts[href] ?? 0} />
                </span>
              </DropdownMenuLinkItem>
            ))}
            <DropdownMenuSeparator />
            {SECONDARY.map(({ href, label, icon: Icon }) => (
              <DropdownMenuLinkItem
                key={href}
                render={<Link href={href} />}
                className={cn(
                  isActive(pathname, href, false) &&
                    "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
                <span className="ml-auto">
                  <CountBadge count={counts[href] ?? 0} />
                </span>
              </DropdownMenuLinkItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

function TabLink({
  href,
  label,
  Icon,
  active,
  count,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  count: number;
}) {
  return (
    <li>
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
        <CountBadge count={count} />
      </Link>
    </li>
  );
}
