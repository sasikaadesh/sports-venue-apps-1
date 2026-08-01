import "server-only";

import { prisma } from "@/lib/prisma";
import {
  confirmPaidBooking,
  extendHoldForPayment,
  releaseUnpaidBooking,
  type BookingResult,
} from "@/lib/booking-service";
import { sendBookingConfirmationEmail } from "@/lib/email/booking";
import {
  checkoutHash,
  outcomeForStatusCode,
  payhereConfig,
  verifyNotificationSignature,
  PAYHERE_CURRENCY,
} from "@/lib/payhere";
import { siteOrigin } from "@/lib/site-url";
import { dateToDateString, dateToTimeString, isFuture } from "@/lib/time";

/**
 * The payment service — the only module that writes `Payment`, and the only
 * caller of the booking service's payment transitions.
 *
 * Two entry points, and the asymmetry between them is the whole design:
 *
 *  - `startCheckout` runs for a signed-in user and produces the parameters the
 *    popup needs. It writes a `pending` payment and hands out a hash. It never
 *    confirms anything.
 *  - `applyPayHereNotification` runs for an unauthenticated server-to-server
 *    POST from PayHere and is the ONLY path that can confirm a booking. Its
 *    authority comes entirely from `md5sig`, which cannot be produced without
 *    the merchant secret.
 *
 * The `return_url` the browser lands on has no code path into either of these
 * (CLAUDE.md) — it only reads status.
 */

/** Paths PayHere is pointed at. Exported so the docs and the report can cite them. */
export const PAYHERE_NOTIFY_PATH = "/api/payhere/notify";
export const PAYHERE_RETURN_PATH = "/payments/return";

/**
 * PayHere requires a city on every checkout, and the app does not collect one
 * (the profile has a single free-text address). The venue's own city is the
 * honest default: everyone booking a school court is local, and PayHere uses
 * this only for the receipt.
 */
const DEFAULT_CITY = "Colombo";
const DEFAULT_COUNTRY = "Sri Lanka";

/** Exactly the fields handed to `payhere.startPayment()` in the browser. */
export type PayHereCheckoutParams = {
  sandbox: boolean;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  hash: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
};

type CheckoutUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
};

/** PayHere wants the name in two fields; the app stores one. */
function splitName(name: string | null, fallback: string): [string, string] {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [fallback, "-"];
  if (parts.length === 1) return [parts[0], "-"];
  return [parts.slice(0, -1).join(" "), parts.at(-1)!];
}

/**
 * Prepare a checkout for a pending booking.
 *
 * The amount is read from `Booking.totalPrice` — the total frozen when the
 * hours were held — and is never accepted from the caller. That is what stops
 * someone paying for one hour and reserving six (docs/ARCHITECTURE.md →
 * Payment flow, step 2).
 */
export async function startCheckout(
  bookingId: string,
  user: CheckoutUser
): Promise<BookingResult<PayHereCheckoutParams>> {
  const config = payhereConfig();

  if (!config) {
    return {
      ok: false,
      error: "Online payment is not configured yet. Please contact the office.",
      reason: "invalid",
    };
  }

  if (!user.phone?.trim() || !user.address?.trim()) {
    return {
      ok: false,
      error:
        "Add your phone number and address on your account page before paying.",
      reason: "invalid",
    };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      holdExpiresAt: true,
      totalPrice: true,
      bookingDate: true,
      court: { select: { name: true } },
      slots: {
        orderBy: { slot: { startTime: "asc" } },
        select: { slot: { select: { startTime: true, endTime: true } } },
      },
    },
  });

  // Ownership is checked here, in the service, not only in the page that draws
  // the button: knowing a booking's uuid is not authority to pay for it — or,
  // more to the point, to read the payer's details back out of it.
  if (!booking || booking.userId !== user.id) {
    return { ok: false, error: "Booking not found.", reason: "notfound" };
  }

  if (booking.status === "confirmed") {
    return {
      ok: false,
      error: "This booking is already paid for.",
      reason: "invalid",
    };
  }

  if (booking.status !== "pending") {
    return {
      ok: false,
      error: "This booking is no longer held. Pick your slot again.",
      reason: "invalid",
    };
  }

  if (!isFuture(booking.holdExpiresAt)) {
    return {
      ok: false,
      error: "This hold has lapsed. Pick your slot again.",
      reason: "invalid",
    };
  }

  const amount = booking.totalPrice.toFixed(2);

  if (booking.totalPrice.lessThanOrEqualTo(0)) {
    return {
      ok: false,
      error: "There is nothing to pay on this booking.",
      reason: "invalid",
    };
  }

  // Give the user room to actually complete the payment before the sweep can
  // take the hours back.
  const extended = await extendHoldForPayment(booking.id, user.id);
  if (!extended.ok) return extended;

  // Reuse the pending payment if there is one for the same amount: dismissing
  // the popup and clicking Pay again should not litter a row per click, and
  // PayHere is happy to be shown the same never-completed order id twice. A
  // stale row at a different amount (the booking changed) is left alone as
  // history and a fresh one is created.
  const existing = await prisma.payment.findFirst({
    where: { bookingId: booking.id, status: "pending", amount: booking.totalPrice },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderId: true },
  });

  const payment =
    existing ??
    (await prisma.payment.create({
      data: {
        bookingId: booking.id,
        // The payment's own uuid is the merchant order id: unique by
        // construction, and `Payment.orderId` is uniquely indexed, so the
        // webhook resolves it with one lookup and cannot match two rows.
        orderId: crypto.randomUUID(),
        amount: booking.totalPrice,
        currency: PAYHERE_CURRENCY,
        status: "pending",
      },
      select: { id: true, orderId: true },
    }));

  const origin = await siteOrigin();
  const [firstName, lastName] = splitName(user.name, "Customer");

  const first = booking.slots[0]?.slot;
  const last = booking.slots.at(-1)?.slot;
  const timeRange =
    first && last
      ? `${dateToTimeString(first.startTime)}-${dateToTimeString(last.endTime)}`
      : "";

  return {
    ok: true,
    data: {
      sandbox: config.sandbox,
      merchant_id: config.merchantId,
      // The browser is sent to this page afterwards. It only READS status —
      // confirmation happens on notify_url or not at all.
      return_url: `${origin}${PAYHERE_RETURN_PATH}?booking=${booking.id}`,
      cancel_url: `${origin}/bookings/${booking.id}?payment=cancelled`,
      notify_url: `${origin}${PAYHERE_NOTIFY_PATH}`,
      order_id: payment.orderId,
      items: `${booking.court.name} ${dateToDateString(booking.bookingDate)} ${timeRange}`.trim(),
      amount,
      currency: PAYHERE_CURRENCY,
      // The one value derived from the merchant secret that is allowed out of
      // the server — and it is a one-way digest of it.
      hash: checkoutHash({
        merchantId: config.merchantId,
        orderId: payment.orderId,
        amount,
        currency: PAYHERE_CURRENCY,
        secret: config.secret,
      }),
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      phone: user.phone.trim(),
      address: user.address.trim(),
      city: DEFAULT_CITY,
      country: DEFAULT_COUNTRY,
    },
  };
}

/** What the webhook route should answer with. */
export type NotificationResult = {
  status: number;
  message: string;
};

/**
 * Process one `notify_url` callback from PayHere.
 *
 * Order of business, and none of it is negotiable:
 *  1. the merchant id must be ours;
 *  2. `md5sig` must verify against the merchant secret;
 *  3. the order must exist, and the amount and currency PayHere reports must
 *     match what we stored for it;
 *  4. only then does the status code get to mean anything.
 *
 * Everything that is merely *unknown* (an order id we have never issued, a
 * status code we do not recognise) answers 200 with a log line: PayHere retries
 * non-2xx responses, and retrying will not make an unknown order known. A
 * request that fails 1 or 2 is not from PayHere at all and gets a 403.
 */
export async function applyPayHereNotification(
  form: Record<string, string>
): Promise<NotificationResult> {
  const config = payhereConfig();

  if (!config) {
    console.error("[payhere] notification received but PayHere is not configured");
    return { status: 500, message: "Not configured" };
  }

  const merchantId = form.merchant_id ?? "";
  const orderId = form.order_id ?? "";
  const amount = form.payhere_amount ?? "";
  const currency = form.payhere_currency ?? "";
  const statusCode = form.status_code ?? "";
  const md5sig = form.md5sig ?? "";
  const paymentId = form.payment_id ?? "";

  if (!orderId || !md5sig || !statusCode) {
    console.warn("[payhere] notification missing required fields");
    return { status: 400, message: "Missing fields" };
  }

  if (merchantId !== config.merchantId) {
    console.warn(`[payhere] notification for a foreign merchant id: ${merchantId}`);
    return { status: 403, message: "Bad merchant" };
  }

  if (
    !verifyNotificationSignature({
      merchantId,
      orderId,
      amount,
      currency,
      statusCode,
      md5sig,
      secret: config.secret,
    })
  ) {
    // The only thing standing between a POST and a confirmed booking.
    console.warn(`[payhere] INVALID md5sig for order ${orderId} — ignored`);
    return { status: 403, message: "Invalid signature" };
  }

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      bookingId: true,
    },
  });

  if (!payment) {
    console.warn(`[payhere] notification for unknown order ${orderId}`);
    return { status: 200, message: "Unknown order" };
  }

  // The signature already binds the amount, so a mismatch here means our own
  // record and PayHere's disagree — a bug or a tampered checkout, never
  // something to confirm a booking on.
  if (
    currency !== payment.currency ||
    !payment.amount.equals(amount === "" ? "0" : amount)
  ) {
    console.error(
      `[payhere] amount/currency mismatch on order ${orderId}: charged ${amount} ${currency}, expected ${payment.amount.toFixed(2)} ${payment.currency}`
    );
    return { status: 200, message: "Amount mismatch" };
  }

  const outcome = outcomeForStatusCode(statusCode);

  switch (outcome) {
    case "success":
      return settleSuccess(payment.id, payment.bookingId, paymentId, payment.status);

    case "cancelled":
    case "failed":
      return settleUnpaid(
        payment.id,
        payment.bookingId,
        paymentId,
        outcome === "cancelled" ? "cancelled" : "failed"
      );

    case "chargedback":
      // Money that was taken has been reversed, on a booking that is most
      // likely already confirmed. Releasing the hours automatically is the
      // wrong call — that is an admin decision with a refund trail
      // (docs/ARCHITECTURE.md → the paid/unpaid divide). Record and escalate.
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed", payhereRef: paymentId || undefined },
      });
      console.error(
        `[payhere] CHARGEBACK on order ${orderId} (booking ${payment.bookingId}) — needs admin review`
      );
      return { status: 200, message: "Chargeback recorded" };

    case "pending":
      // PayHere sends this for bank transfers awaiting clearance. Nothing to
      // do: the row is already pending and the hold stands until it lapses.
      return { status: 200, message: "Payment pending" };

    default:
      console.warn(`[payhere] unrecognised status_code ${statusCode} on order ${orderId}`);
      return { status: 200, message: "Ignored" };
  }
}

/** status_code 2 — the money is in. */
async function settleSuccess(
  paymentId: string,
  bookingId: string,
  payhereRef: string,
  previousStatus: string
): Promise<NotificationResult> {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "success", payhereRef: payhereRef || undefined },
  });

  const result = await confirmPaidBooking(bookingId);

  if (!result.ok) {
    // Paid, but the hours are gone — the hold lapsed and the sweep released
    // them before the webhook arrived. Confirming anyway could sell one hour
    // twice, so the booking stays released and this needs a human and a
    // refund. The payment row keeps the money's record either way.
    console.error(
      `[payhere] PAID BUT UNCONFIRMABLE — payment ${paymentId}, booking ${bookingId}: ${result.error}. Refund required.`
    );
    return { status: 200, message: "Payment recorded; booking needs review" };
  }

  if (result.data.confirmed) {
    // First time through. `confirmPaidBooking` is a compare-and-set, so this
    // branch runs exactly once no matter how often PayHere retries — which is
    // what keeps the confirmation email from going out twice.
    await sendBookingConfirmationEmail(bookingId);
    return { status: 200, message: "Booking confirmed" };
  }

  if (previousStatus !== "success") {
    console.warn(
      `[payhere] booking ${bookingId} was already confirmed when payment ${paymentId} settled`
    );
  }

  return { status: 200, message: "Already confirmed" };
}

/** status_code -1 / -2 — cancelled or failed at PayHere; give the hours back. */
async function settleUnpaid(
  paymentId: string,
  bookingId: string,
  payhereRef: string,
  status: "cancelled" | "failed"
): Promise<NotificationResult> {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status, payhereRef: payhereRef || undefined },
  });

  const released = await releaseUnpaidBooking(bookingId);

  if (!released.ok) {
    console.error(
      `[payhere] could not release booking ${bookingId} after a ${status} payment: ${released.error}`
    );
  }

  return { status: 200, message: `Payment ${status}` };
}

/**
 * A read-only view of where a booking's money got to, for the status page.
 * Deliberately a read: nothing on the browser's return path may write.
 */
export async function latestPaymentForBooking(bookingId: string) {
  return prisma.payment.findFirst({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    select: { status: true, amount: true, currency: true, payhereRef: true },
  });
}
