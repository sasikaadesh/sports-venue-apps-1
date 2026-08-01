import Link from "next/link";
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { prisma } from "@/lib/prisma";
import { dateToTimeString, formatDate, formatPrice, isFuture } from "@/lib/time";

/** How many to show before pointing at the venue rather than paginating. */
const LIMIT = 25;

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
 * The signed-in user's own bookings, newest play date first.
 *
 * **Scoped to `userId` in the query itself.** Prisma connects as `postgres` and
 * bypasses RLS, so the `where` clause is the enforcement here, not a filter on
 * top of one — RLS is the second layer, covering the anon-key path (CLAUDE.md,
 * docs/ARCHITECTURE.md → Security). The id comes from `requireUser()` in the
 * page, never from a parameter, so there is nothing to tamper with.
 *
 * `blocked` rows are excluded: an admin's slot blocks are `Booking`s owned by
 * that admin, and they are not that person's bookings in any sense a user
 * means.
 */
export async function AccountBookings({ userId }: { userId: string }) {
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { userId, status: { not: "blocked" } },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      take: LIMIT,
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
    }),
    prisma.booking.count({ where: { userId, status: { not: "blocked" } } }),
  ]);

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

  return (
    <div className="flex flex-col gap-3">
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

          return (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className={`group flex flex-col gap-4 rounded-xl border bg-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                  // A flat accent wash vanishes on a near-black surface, so the
                  // emphasis is a border as well as a tint (DESIGN.md).
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

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
                  <span
                    className={`font-heading text-xl font-bold tabular-nums ${
                      view.emphasised ? "" : "text-muted-foreground"
                    }`}
                  >
                    {formatPrice(booking.totalPrice.toString())}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground">
                    View details
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {total > LIMIT && (
        <p className="text-sm text-muted-foreground">
          Showing your {LIMIT} most recent bookings of {total}. Contact the
          sports office for anything older.
        </p>
      )}
    </div>
  );
}
