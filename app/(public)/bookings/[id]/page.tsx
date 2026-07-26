import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, CreditCard, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { CancelBookingButton } from "@/components/public/cancel-booking-button";
import { requireUser, roleIsAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateToTimeString, formatDate, formatPrice, isFuture } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your booking — Courtside",
};

/**
 * Booking summary — the end of the Phase 7 flow.
 *
 * The booking is `pending`: its hours are held, nothing has been paid. Phase 8
 * adds PayHere checkout here, and only the verified `notify_url` webhook will
 * be allowed to move it to `confirmed`.
 */
export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}`);

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      bookingDate: true,
      playerCount: true,
      durationHours: true,
      totalPrice: true,
      status: true,
      holdExpiresAt: true,
      userId: true,
      court: { select: { id: true, name: true } },
      slots: {
        orderBy: { slot: { startTime: "asc" } },
        select: {
          id: true,
          price: true,
          slot: { select: { startTime: true, endTime: true } },
        },
      },
    },
  });

  // Authorization, server-side: your own booking, or you are an admin. A uuid
  // is not a capability.
  if (!booking) notFound();
  if (booking.userId !== user.id && !roleIsAdmin(user.role)) notFound();

  const hours = booking.slots;
  const startTime = hours[0] ? dateToTimeString(hours[0].slot.startTime) : null;
  const endTime = hours.at(-1)
    ? dateToTimeString(hours[hours.length - 1].slot.endTime)
    : null;

  const isPending = booking.status === "pending";
  const holdLive = isPending && isFuture(booking.holdExpiresAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
      <div className="flex flex-col items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="text-4xl leading-none">
          {holdLive ? "Your slot is held" : "Your booking"}
        </h1>
        <p className="max-w-prose text-muted-foreground">
          {holdLive
            ? `We are holding ${booking.durationHours === 1 ? "this hour" : "these hours"} for you. Payment is not wired up yet — that lands in the next release.`
            : "Here is the booking as it stands."}
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <span className="font-heading text-lg font-bold tracking-tight">
            {booking.court.name}
          </span>
          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
            {booking.status}
          </Badge>
        </div>

        <dl className="grid gap-px bg-border sm:grid-cols-3">
          <Detail
            label="Date"
            value={formatDate(booking.bookingDate)}
            icon={<CalendarDays className="size-4 text-muted-foreground" />}
          />
          <Detail
            label="Time"
            value={startTime && endTime ? `${startTime} – ${endTime}` : "—"}
            icon={<Clock className="size-4 text-muted-foreground" />}
          />
          <Detail
            label="Players"
            value={String(booking.playerCount)}
            icon={<Users className="size-4 text-muted-foreground" />}
          />
        </dl>

        {hours.length > 0 && (
          <ul className="flex flex-col divide-y border-t">
            {hours.map((hour) => (
              <li
                key={hour.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {dateToTimeString(hour.slot.startTime)} –{" "}
                  {dateToTimeString(hour.slot.endTime)}
                </span>
                <span className="text-sm tabular-nums">
                  {formatPrice(hour.price.toString())}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-4 border-t bg-muted/40 px-5 py-4">
          <span className="font-heading font-bold tracking-tight">
            Total{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              ({booking.durationHours}{" "}
              {booking.durationHours === 1 ? "hour" : "hours"})
            </span>
          </span>
          <span className="font-heading text-2xl font-bold tabular-nums">
            {formatPrice(booking.totalPrice.toString())}
          </span>
        </div>
      </div>

      {holdLive && (
        <p className="mt-6 flex items-start gap-2.5 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <CreditCard className="mt-0.5 size-4 shrink-0" />
          <span>
            This hold lapses at{" "}
            <span className="font-medium text-foreground">
              {booking.holdExpiresAt?.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Colombo",
              })}
            </span>
            , after which the hours go back on sale. Once PayHere is wired up,
            paying is what will make it permanent.
          </span>
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <LinkButton href="/courts" variant="outline" className="h-10">
          Browse more courts
        </LinkButton>
        {isPending && booking.userId === user.id && (
          <CancelBookingButton bookingId={booking.id} />
        )}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
        {icon}
        {value}
      </dd>
    </div>
  );
}
