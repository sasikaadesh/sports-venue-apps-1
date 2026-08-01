import "server-only";

import { prisma } from "@/lib/prisma";
import { fromAddress, resendClient } from "@/lib/email/client";
import { BookingConfirmationEmail } from "@/lib/email/templates";
import { siteOrigin } from "@/lib/site-url";
import { dateToTimeString, formatDate, formatPrice } from "@/lib/time";

/**
 * The "your booking is confirmed" email, sent from the verified PayHere
 * webhook once — and only once — a booking flips to `confirmed`.
 *
 * **This never throws and never reports failure to its caller**, exactly like
 * `sendContactEmails` (docs/ARCHITECTURE.md → Transactional email). The
 * database is the record of the booking and the money; email is a notification
 * on top of it. A Resend outage must not make the webhook return non-2xx,
 * because PayHere would then retry a notification we have already acted on.
 * The worst case here is a confirmed, paid booking that nobody was emailed
 * about — visible in the account area and the admin panel either way.
 *
 * It is `await`ed rather than fired and forgotten: a serverless function can be
 * frozen the instant it responds, which would kill a floating promise.
 */
export async function sendBookingConfirmationEmail(
  bookingId: string
): Promise<void> {
  try {
    const resend = resendClient();

    if (!resend) {
      console.warn(
        `[booking-email] RESEND_API_KEY is not set — booking ${bookingId} confirmed, no email sent.`
      );
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingDate: true,
        playerCount: true,
        durationHours: true,
        totalPrice: true,
        court: { select: { name: true } },
        user: { select: { email: true, name: true } },
        slots: {
          orderBy: { slot: { startTime: "asc" } },
          select: { slot: { select: { startTime: true, endTime: true } } },
        },
      },
    });

    if (!booking?.user?.email) {
      console.warn(
        `[booking-email] booking ${bookingId} has no addressable user — no email sent.`
      );
      return;
    }

    const first = booking.slots[0]?.slot;
    const last = booking.slots.at(-1)?.slot;
    const timeRange =
      first && last
        ? `${dateToTimeString(first.startTime)} – ${dateToTimeString(last.endTime)}`
        : "—";

    const props = {
      name: booking.user.name?.split(/\s+/)[0] ?? "there",
      courtName: booking.court.name,
      date: formatDate(booking.bookingDate),
      timeRange,
      durationHours: booking.durationHours,
      playerCount: booking.playerCount,
      total: formatPrice(booking.totalPrice.toString()),
      bookingUrl: `${await siteOrigin()}/bookings/${booking.id}`,
    };

    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: booking.user.email,
      subject: `Booking confirmed — ${props.courtName}, ${props.date}`,
      react: BookingConfirmationEmail(props),
      text: confirmationText(props),
    });

    // Resend reports a rejected address or a quota breach in `error` without
    // throwing, so this branch is not redundant with the catch below.
    if (error) {
      console.error(
        `[booking-email] confirmation for ${bookingId} rejected by Resend:`,
        error
      );
    }
  } catch (error) {
    console.error(
      `[booking-email] confirmation for ${bookingId} failed to send:`,
      error
    );
  }
}

/** Plain-text alternative — text-only clients render it, and it lowers spam score. */
function confirmationText(props: {
  name: string;
  courtName: string;
  date: string;
  timeRange: string;
  durationHours: number;
  playerCount: number;
  total: string;
  bookingUrl: string;
}): string {
  return [
    `Hi ${props.name},`,
    "",
    "Your payment went through and your booking is confirmed.",
    "",
    `Court:   ${props.courtName}`,
    `Date:    ${props.date}`,
    `Time:    ${props.timeRange} (${props.durationHours} ${props.durationHours === 1 ? "hour" : "hours"})`,
    `Players: ${props.playerCount}`,
    `Paid:    ${props.total}`,
    "",
    `View your booking: ${props.bookingUrl}`,
    "",
    "Please arrive a few minutes early. To change or cancel a paid booking, contact the sports office.",
  ].join("\n");
}
