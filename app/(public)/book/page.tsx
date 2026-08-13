import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  LogIn,
  Pencil,
  TriangleAlert,
  Users,
} from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { ConfirmBookingForm } from "@/components/public/confirm-booking-form";
import { RemoveBookingButton } from "@/components/public/remove-booking-button";
import { getCurrentUser } from "@/lib/auth";
import { quoteBooking, HOLD_MINUTES } from "@/lib/booking-service";
import { dateStringToDate, formatDate, formatPrice } from "@/lib/time";
import { createBookingSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review your booking",
};

/**
 * Review step.
 *
 * The selection arrives in the URL from the hero bar, but nothing here is
 * taken on trust: the page re-validates it and re-prices it server-side via
 * `quoteBooking`, which is the same function the booking service calls just
 * before it writes. So the total shown is the total that gets stored.
 *
 * Nothing is reserved yet — the hold starts when the user confirms.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    courtId?: string;
    date?: string;
    slotId?: string;
    duration?: string;
    players?: string;
  }>;
}) {
  const query = await searchParams;

  const parsed = createBookingSchema.safeParse({
    courtId: query.courtId,
    bookingDate: query.date,
    startSlotId: query.slotId,
    durationHours: query.duration,
    playerCount: query.players,
  });

  if (!parsed.success) {
    return (
      <BookingProblem message="That booking link is incomplete. Start again from the home page." />
    );
  }

  const quote = await quoteBooking({
    courtId: parsed.data.courtId,
    bookingDate: dateStringToDate(parsed.data.bookingDate),
    startSlotId: parsed.data.startSlotId,
    durationHours: parsed.data.durationHours,
    playerCount: parsed.data.playerCount,
  });

  if (!quote.ok) {
    return (
      <BookingProblem
        message={quote.error}
        courtId={parsed.data.courtId}
        date={parsed.data.bookingDate}
      />
    );
  }

  const booking = quote.data;
  const user = await getCurrentUser();

  // Where to come back to after signing in — the whole selection is in the URL,
  // so nothing is lost on the round trip.
  const returnTo = `/book?courtId=${booking.courtId}&date=${booking.dateString}&slotId=${booking.hours[0].slotId}&duration=${booking.durationHours}&players=${booking.playerCount}`;

  // "Change" goes back to the court's availability with every field preserved,
  // so the user can adjust date, start time, duration or players and come back.
  const changeHref = `/courts/${booking.courtId}?date=${booking.dateString}&slotId=${booking.hours[0].slotId}&duration=${booking.durationHours}&players=${booking.playerCount}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
      <Link
        href={`/courts/${booking.courtId}?date=${booking.dateString}`}
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to {booking.courtName}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">Review your booking</h1>
          <p className="text-muted-foreground">
            Nothing is reserved until you confirm.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RemoveBookingButton
            backHref={`/courts/${booking.courtId}?date=${booking.dateString}`}
          />
          <LinkButton href={changeHref} variant="outline" className="h-10">
            <Pencil />
            Change
          </LinkButton>
        </div>
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border bg-card">
        <dl className="grid gap-px bg-border sm:grid-cols-3">
          <Detail label="Court" value={booking.courtName} />
          <Detail
            label="Date"
            value={formatDate(dateStringToDate(booking.dateString))}
            icon={<CalendarDays className="size-4 text-muted-foreground" />}
          />
          <Detail
            label="Players"
            value={String(booking.playerCount)}
            icon={<Users className="size-4 text-muted-foreground" />}
          />
        </dl>

        <div className="flex items-center justify-between gap-4 border-t px-5 py-4">
          <span className="flex items-center gap-2.5">
            <Clock className="size-4 text-primary" />
            <span className="font-mono text-sm font-medium">
              {booking.startTime} – {booking.endTime}
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            {booking.durationHours}{" "}
            {booking.durationHours === 1 ? "hour" : "consecutive hours"}
          </span>
        </div>

        {/* Every hour priced individually — the total is their sum, and each
            of these becomes its own protected row. */}
        <ul className="flex flex-col divide-y border-t">
          {booking.hours.map((hour) => (
            <li
              key={hour.slotId}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <span className="font-mono text-sm text-muted-foreground">
                {hour.startTime} – {hour.endTime}
              </span>
              <span className="text-sm tabular-nums">
                {formatPrice(hour.price)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-4 border-t bg-muted/40 px-5 py-4">
          <span className="font-heading font-bold tracking-tight">Total</span>
          <span className="font-heading text-2xl font-bold tabular-nums">
            {formatPrice(booking.totalPrice)}
          </span>
        </div>
      </div>

      <div className="mt-8">
        {user ? (
          <ConfirmBookingForm
            input={{
              courtId: booking.courtId,
              bookingDate: booking.dateString,
              startSlotId: booking.hours[0].slotId,
              durationHours: booking.durationHours,
              playerCount: booking.playerCount,
            }}
            holdMinutes={HOLD_MINUTES}
          />
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed px-5 py-6">
            <p className="text-sm text-muted-foreground">
              Sign in to hold these hours. Your selection is kept.
            </p>
            <LinkButton
              href={`/login?next=${encodeURIComponent(returnTo)}`}
              size="lg"
              className="h-10"
            >
              <LogIn />
              Sign in to confirm
            </LinkButton>
          </div>
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

/** Shown when the selection no longer makes sense — taken, expired, malformed. */
function BookingProblem({
  message,
  courtId,
  date,
}: {
  message: string;
  courtId?: string;
  date?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8">
      <div className="flex flex-col items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-6">
        <TriangleAlert className="size-5 text-destructive" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">We could not hold that</h1>
          <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {courtId && (
            <LinkButton
              href={`/courts/${courtId}${date ? `?date=${date}` : ""}`}
              className="h-10"
            >
              See what is free
            </LinkButton>
          )}
          <LinkButton href="/" variant="outline" className="h-10">
            Start again
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
