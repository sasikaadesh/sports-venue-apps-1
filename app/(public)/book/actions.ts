"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { cancelOwnBooking, createBooking } from "@/lib/booking-service";
import { dateStringToDate } from "@/lib/time";
import {
  actionError,
  createBookingSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validations";

/**
 * Booking actions.
 *
 * These do no booking writes of their own — they authenticate, validate, then
 * hand off to the booking service in /lib, which is the single place `Booking`
 * and `BookingSlot` rows are written (CLAUDE.md).
 *
 * A server action is a public HTTP endpoint: it can be invoked without ever
 * loading the form. So the identity comes from the session (never the form),
 * and the price is never an input at all — the service sums it from the slot
 * templates.
 */

export async function createBookingAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  // Bookings belong to someone. Signed-out visitors may browse and check
  // availability, but not hold a slot.
  const user = await requireUser("/");

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const result = await createBooking({
    courtId: parsed.data.courtId,
    bookingDate: dateStringToDate(parsed.data.bookingDate),
    startSlotId: parsed.data.startSlotId,
    durationHours: parsed.data.durationHours,
    playerCount: parsed.data.playerCount,
    userId: user.id,
  });

  if (!result.ok) return actionError(result.error);

  // The hours just became unavailable everywhere they are displayed.
  revalidatePath("/");
  revalidatePath(`/courts/${parsed.data.courtId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/blocks");

  redirect(`/bookings/${result.data.id}`);
}

export async function cancelOwnBookingAction(
  bookingId: string
): Promise<ActionResult> {
  const user = await requireUser("/account");

  // Ownership is enforced inside the service, in the query itself — knowing a
  // booking's uuid is not authority to cancel it.
  const result = await cancelOwnBooking(bookingId, user.id);
  if (!result.ok) return actionError(result.error);

  revalidatePath("/");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");

  return { ok: true };
}
