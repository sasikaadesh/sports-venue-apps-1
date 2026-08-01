import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, CreditCard, Users, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { CancelBookingButton } from "@/components/public/cancel-booking-button";
import { PayNowButton } from "@/components/public/pay-now-button";
import { requireUser, roleIsAdmin } from "@/lib/auth";
import { latestPaymentForBooking } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";
import { dateToTimeString, formatDate, formatPrice, isFuture } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your booking — Courtside",
};

/**
 * Booking summary, and where payment starts.
 *
 * A `pending` booking holds its hours and shows "Pay now", which opens the
 * PayHere popup. Nothing on this page can confirm the booking: the button only
 * asks the server for checkout parameters, and the flip to `confirmed` happens
 * on the verified `notify_url` webhook (CLAUDE.md).
 */
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment: paymentFlag } = await searchParams;
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
  const isConfirmed = booking.status === "confirmed";
  const holdLive = isPending && isFuture(booking.holdExpiresAt);
  const isOwner = booking.userId === user.id;

  const payment = await latestPaymentForBooking(booking.id);
  const canPay = holdLive && isOwner && booking.totalPrice.greaterThan(0);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
      <div className="flex flex-col items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="text-4xl leading-none">
          {isConfirmed
            ? "Your booking is confirmed"
            : holdLive
              ? "Your slot is held"
              : "Your booking"}
        </h1>
        <p className="max-w-prose text-muted-foreground">
          {isConfirmed
            ? "Payment received — the court is yours. A confirmation email has been sent."
            : holdLive
              ? `We are holding ${booking.durationHours === 1 ? "this hour" : "these hours"} for you. Pay below to make the booking permanent.`
              : "Here is the booking as it stands."}
        </p>
      </div>

      {/* PayHere sends a cancelled checkout back here rather than to the status
          page — nothing was charged and the hold is untouched, so this is a
          notice, not a failure. */}
      {paymentFlag === "cancelled" && isPending && (
        <p
          role="status"
          className="mt-8 flex items-start gap-2.5 rounded-xl border bg-muted px-4 py-3 text-sm"
        >
          <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            Payment was cancelled — nothing has been charged. Your hold is still
            live until it lapses.
          </span>
        </p>
      )}

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
            , after which the hours go back on sale. Paying is what makes it
            permanent.
          </span>
        </p>
      )}

      {canPay && (
        <div className="mt-8">
          <PayNowButton
            bookingId={booking.id}
            amountLabel={formatPrice(booking.totalPrice.toString())}
          />
        </div>
      )}

      {/* Paid, but the booking is not confirmed: the hold lapsed before the
          webhook landed. The user must not be left guessing about money that
          left their account. */}
      {!isConfirmed && payment?.status === "success" && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            A payment for this booking succeeded, but the hours had already been
            released and could not be confirmed. The sports office will contact
            you to rebook or refund.
          </span>
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <LinkButton href="/courts" variant="outline" className="h-10">
          Browse more courts
        </LinkButton>
        {isPending && isOwner && <CancelBookingButton bookingId={booking.id} />}
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
