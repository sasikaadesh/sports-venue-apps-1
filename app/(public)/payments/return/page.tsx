import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { PaymentStatusPoller } from "@/components/public/payment-status-poller";
import { PayNowButton } from "@/components/public/pay-now-button";
import { requireUser, roleIsAdmin } from "@/lib/auth";
import { latestPaymentForBooking } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";
import { formatDate, formatPrice, isFuture } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment status",
};

/**
 * PayHere `return_url` — where the browser lands after checkout.
 *
 * **This page confirms nothing.** It is reached by a redirect the user
 * controls, so it has no write path at all: it reads the booking and the
 * payment row and reports what it finds. The booking became `confirmed`
 * because the verified `notify_url` webhook said so, or it did not
 * (CLAUDE.md).
 *
 * That is also why "still pending" is a first-class state here rather than an
 * error — the user can beat the webhook back to the site by a second or two.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;

  if (!bookingId) redirect("/account");

  const user = await requireUser(`/payments/return?booking=${bookingId}`);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      userId: true,
      bookingDate: true,
      totalPrice: true,
      durationHours: true,
      holdExpiresAt: true,
      court: { select: { name: true } },
    },
  });

  // Same rule as the booking page: your own booking, or you are an admin.
  if (!booking) notFound();
  if (booking.userId !== user.id && !roleIsAdmin(user.role)) notFound();

  const payment = await latestPaymentForBooking(booking.id);

  const holdLive =
    booking.status === "pending" && isFuture(booking.holdExpiresAt);

  const view = describe(booking.status, payment?.status, holdLive);

  // A declined card leaves the booking exactly as it was — pending, still
  // holding its hours — so the retry belongs right here, on the page the user
  // was just dropped on. Same component and same checkout as everywhere else;
  // an admin looking at someone else's booking does not get a Pay button.
  const canRetry =
    view.retryable &&
    booking.userId === user.id &&
    booking.totalPrice.greaterThan(0);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-8">
      <div className="flex flex-col items-start gap-3">
        <span
          className={`grid size-11 place-items-center rounded-xl ${view.iconClass}`}
        >
          {view.icon}
        </span>
        <h1 className="text-4xl leading-none">{view.title}</h1>
        <p className="max-w-prose text-muted-foreground">{view.body}</p>
      </div>

      <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        <Cell label="Court" value={booking.court.name} />
        <Cell label="Date" value={formatDate(booking.bookingDate)} />
        <Cell
          label="Amount"
          value={formatPrice(booking.totalPrice.toString())}
        />
      </dl>

      {view.polling && (
        <div className="mt-6">
          <PaymentStatusPoller />
        </div>
      )}

      {canRetry && (
        <div className="mt-8">
          <PayNowButton
            bookingId={booking.id}
            amountLabel={formatPrice(booking.totalPrice.toString())}
          />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <LinkButton
          href={`/bookings/${booking.id}`}
          variant={view.tone === "success" ? "default" : "outline"}
          className="h-10"
        >
          View your booking
        </LinkButton>
        <LinkButton href="/courts" variant="outline" className="h-10">
          Browse more courts
        </LinkButton>
      </div>
    </div>
  );
}

type View = {
  title: string;
  body: string;
  icon: React.ReactNode;
  iconClass: string;
  tone: "success" | "waiting" | "failed";
  polling: boolean;
  /** The attempt failed but the hold survived it, so another card can be tried. */
  retryable: boolean;
};

/**
 * Booking status, payment status and whether the hold is still live — all
 * three, because any one alone misleads. Two cases carry the weight:
 *
 *  - money taken for hours the booking no longer holds, which must say so
 *    plainly rather than read as a plain failure; and
 *  - a declined card, which is *not* the end of the booking. The hold is
 *    untouched by a failed attempt, so this reads as "try again", not as
 *    "those hours are gone".
 */
function describe(
  bookingStatus: string,
  paymentStatus: string | undefined,
  holdLive: boolean
): View {
  if (bookingStatus === "confirmed") {
    return {
      title: "Payment received",
      body: "Your booking is confirmed and the court is yours. A confirmation email is on its way.",
      icon: <CheckCircle2 className="size-6" />,
      iconClass: "bg-primary text-primary-foreground",
      tone: "success",
      polling: false,
      retryable: false,
    };
  }

  if (paymentStatus === "success") {
    return {
      title: "Payment received — booking needs review",
      body: "Your payment went through, but the hold on these hours had already lapsed, so we could not confirm them automatically. The sports office will contact you to rebook or refund. Nothing further is needed from you.",
      icon: <AlertCircle className="size-6" />,
      iconClass: "bg-destructive/15 text-destructive",
      tone: "failed",
      polling: false,
      retryable: false,
    };
  }

  if (paymentStatus === "cancelled" || paymentStatus === "failed") {
    const cancelled = paymentStatus === "cancelled";

    // The hold outlived the failed attempt: nothing was charged, nothing was
    // released, and the only thing that went wrong was the card.
    if (holdLive) {
      return {
        title: cancelled
          ? "Payment cancelled — please try again"
          : "Payment failed — please try again",
        body: cancelled
          ? "Nothing was charged. Your slot is still held for you — you can pay for it now, or with a different card, until the hold lapses."
          : "Your card was declined and nothing was charged. Your slot is still held for you — try again below, with the same card or a different one, until the hold lapses.",
        icon: <AlertCircle className="size-6" />,
        iconClass: "bg-muted text-foreground",
        tone: "failed",
        polling: false,
        retryable: true,
      };
    }

    return {
      title: cancelled ? "Payment cancelled" : "Payment failed",
      body: "Nothing was charged, and the hold on these hours has since lapsed. Pick a slot again to rebook.",
      icon: <XCircle className="size-6" />,
      iconClass: "bg-muted text-muted-foreground",
      tone: "failed",
      polling: false,
      retryable: false,
    };
  }

  if (bookingStatus === "expired" || bookingStatus === "cancelled") {
    return {
      title: "This hold has lapsed",
      body: "The hours went back on sale before the payment completed. Nothing was charged — pick a slot again to rebook.",
      icon: <Clock className="size-6" />,
      iconClass: "bg-muted text-muted-foreground",
      tone: "failed",
      polling: false,
      retryable: false,
    };
  }

  // Still pending on both sides: the webhook has not landed yet.
  return {
    title: "Waiting for confirmation",
    body: "PayHere is letting us know how the payment went. This usually takes a few seconds — this page updates itself.",
    icon: <Clock className="size-6" />,
    iconClass: "bg-muted text-foreground",
    tone: "waiting",
    polling: true,
    retryable: false,
  };
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
