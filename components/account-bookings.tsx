import Link from "next/link";
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { LinkPending } from "@/components/link-pending";
import { RemoveAccountBookingButton } from "@/components/remove-account-booking-button";
import { prisma } from "@/lib/prisma";
import {
  dateToTimeString,
  formatDate,
  formatPrice,
  isFuture,
} from "@/lib/time";
import type { BookingStatus } from "@/lib/generated/prisma/enums";

/** How many bookings one page of the list shows. */
export const BOOKINGS_PER_PAGE = 10;

/**
 * The rows that belong on a user's own list.
 *
 * `blocked` is excluded: an admin's slot blocks are `Booking`s owned by that
 * admin, and they are not that person's bookings in any sense a user means.
 * `removedAt` is the user's own "clear this out" marker — the row survives as a
 * record (and for its payment attempts), it just leaves this list.
 */
function ownListFilter(userId: string) {
  return {
    userId,
    status: { not: "blocked" as BookingStatus },
    removedAt: null,
  };
}

/** How many bookings the user has — drives the tab badge and the pagination. */
export async function countAccountBookings(userId: string): Promise<number> {
  return prisma.booking.count({ where: ownListFilter(userId) });
}

/**
 * Statuses the owner may remove themselves. Money is the dividing line: a
 * `confirmed` booking has been paid for, so it is released only through the
 * admin-reviewed refund flow, never by deleting a row (docs/ARCHITECTURE.md →
 * the paid/unpaid divide). Mirrored — and actually enforced — server-side in
 * `removeOwnBooking`.
 */
const REMOVABLE_STATUSES: BookingStatus[] = ["pending", "cancelled"];

type StatusView = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  /** Paid bookings are the ones that matter; they get the accent treatment. */
  emphasised: boolean;
};

const STATUS_VIEWS: Record<string, StatusView> = {
  confirmed: { label: "Paid", variant: "default", emphasised: true },
  pending: { label: "Awaiting payment", variant: "outline", emphasised: false },
  cancelled: { label: "Cancelled", variant: "secondary", emphasised: false },
  expired: { label: "Expired", variant: "secondary", emphasised: false },
  blocked: { label: "Blocked", variant: "secondary", emphasised: false },
};

/**
 * The signed-in user's own bookings, newest play date first, ten to a page.
 *
 * **Scoped to `userId` in the query itself.** Prisma connects as `postgres` and
 * bypasses RLS, so the `where` clause is the enforcement here, not a filter on
 * top of one — RLS is the second layer, covering the anon-key path (CLAUDE.md,
 * docs/ARCHITECTURE.md → Security). The id comes from `requireUser()` in the
 * page, never from a parameter, so there is nothing to tamper with.
 */
export async function AccountBookings({
  userId,
  total,
  page,
}: {
  userId: string;
  /** Already counted by the page (it needs the number for the tab badge). */
  total: number;
  /** 1-based, straight off `?page=` — clamped here, not trusted. */
  page: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / BOOKINGS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), pageCount);

  const bookings =
    total === 0
      ? []
      : await prisma.booking.findMany({
          where: ownListFilter(userId),
          orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
          skip: (currentPage - 1) * BOOKINGS_PER_PAGE,
          take: BOOKINGS_PER_PAGE,
          select: {
            id: true,
            bookingDate: true,
            playerCount: true,
            durationHours: true,
            totalPrice: true,
            status: true,
            holdExpiresAt: true,
            court: { select: { name: true } },
            slots: {
              orderBy: { slot: { startTime: "asc" } },
              select: { slot: { select: { startTime: true, endTime: true } } },
            },
          },
        });

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed px-6 py-10">
        <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <CalendarX className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="font-heading text-lg font-bold tracking-tight">
            No bookings yet
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Once you reserve a court it will show up here, with its date, time
            and what you paid.
          </p>
        </div>
        <LinkButton href="/courts" className="h-10">
          Browse courts
        </LinkButton>
      </div>
    );
  }

  const firstShown = (currentPage - 1) * BOOKINGS_PER_PAGE + 1;
  const lastShown = firstShown + bookings.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {bookings.map((booking) => {
          const view = STATUS_VIEWS[booking.status] ?? {
            label: booking.status,
            variant: "secondary" as const,
            emphasised: false,
          };

          const hours = booking.slots;
          const start = hours[0]?.slot;
          const end = hours.at(-1)?.slot;

          // Releasing a booking deletes its BookingSlot rows — that is what
          // frees the hours — so a cancelled or expired booking genuinely no
          // longer knows which hours it held. Say "—" rather than invent one.
          const timeRange =
            start && end
              ? `${dateToTimeString(start.startTime)} – ${dateToTimeString(end.endTime)}`
              : "—";

          const holdLive =
            booking.status === "pending" && isFuture(booking.holdExpiresAt);

          const removable = REMOVABLE_STATUSES.includes(booking.status);

          return (
            <li
              key={booking.id}
              className={`flex flex-col gap-4 rounded-xl border bg-card px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                // A flat accent wash vanishes on a near-black surface, so the
                // emphasis is a border as well as a tint (docs/DESIGN.md).
                view.emphasised
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "hover:border-foreground/20"
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-heading text-lg font-bold tracking-tight">
                    {booking.court.name}
                  </span>
                  <Badge variant={view.variant}>
                    {view.emphasised && <CheckCircle2 />}
                    {view.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    {formatDate(booking.bookingDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {timeRange}
                    <span className="text-muted-foreground/70">
                      ({booking.durationHours}{" "}
                      {booking.durationHours === 1 ? "hr" : "hrs"})
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" />
                    {booking.playerCount}{" "}
                    {booking.playerCount === 1 ? "player" : "players"}
                  </span>
                </div>

                {holdLive && (
                  <p className="text-xs font-medium text-foreground">
                    Held until{" "}
                    {booking.holdExpiresAt?.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Colombo",
                    })}{" "}
                    — pay to confirm it.
                  </p>
                )}
              </div>

              {/* The card is no longer one big link: it now carries a button,
                  and a button inside an anchor is invalid markup. The link is
                  explicit instead. */}
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                <span
                  className={`font-heading text-xl font-bold tabular-nums ${
                    view.emphasised ? "" : "text-muted-foreground"
                  }`}
                >
                  {formatPrice(booking.totalPrice.toString())}
                </span>

                <div className="flex items-center gap-1">
                  <LinkButton
                    href={`/bookings/${booking.id}`}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    View details
                    <ChevronRight />
                    <LinkPending />
                  </LinkButton>

                  {removable && (
                    <RemoveAccountBookingButton
                      bookingId={booking.id}
                      courtName={booking.court.name}
                      holdsHours={holdLive}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <nav
          aria-label="Bookings pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
        >
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {firstShown}–{lastShown} of {total}
          </p>

          <div className="flex items-center gap-2">
            <PageLink page={currentPage - 1} disabled={currentPage === 1}>
              <ChevronLeft />
              Previous
            </PageLink>
            <span className="px-1 text-sm text-muted-foreground tabular-nums">
              Page {currentPage} of {pageCount}
            </span>
            <PageLink
              page={currentPage + 1}
              disabled={currentPage === pageCount}
            >
              Next
              <ChevronRight />
            </PageLink>
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * One pagination step. Disabled ends render as a span, not a dead link — an
 * anchor with no destination is a trap for keyboard and screen-reader users.
 *
 * This is the one control on the page that genuinely must go back to the
 * server: page 2 is a different ten rows. It is prefetched, and it shows a
 * spinner the moment it is clicked, so the wait is acknowledged straight away.
 */
function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const classes =
    "inline-flex h-9 items-center gap-1 border px-3 text-sm font-medium transition-colors [&_svg]:size-4";

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${classes} border-border/60 text-muted-foreground/50`}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/account?tab=bookings&page=${page}`}
      scroll={false}
      className={`${classes} hover:bg-muted hover:text-foreground`}
    >
      {children}
      <LinkPending />
    </Link>
  );
}
