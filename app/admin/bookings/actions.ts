"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import {
  adminCancelBooking,
  adminDeleteBooking,
  unblockSlot,
} from "@/lib/booking-service";
import { actionError, type ActionResult } from "@/lib/validations";

/**
 * Booking actions. Like the block actions, these delegate every write to the
 * booking service in /lib rather than touching `prisma.booking` directly.
 */

export async function cancelBookingAction(
  bookingId: string
): Promise<ActionResult> {
  await requireAdmin();

  const result = await adminCancelBooking(bookingId);
  if (!result.ok) return actionError(result.error);

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/blocks");
  return { ok: true };
}

/**
 * Permanently delete a booking.
 *
 * The button that calls this is only drawn on rows the delete could succeed for,
 * but that is presentation. Which rows are actually deletable is decided in
 * `adminDeleteBooking` — a confirmed booking, or any booking carrying a
 * successful payment, is refused there whatever this is called with. The
 * `/admin` dashboard is revalidated too: its counts change when a row goes.
 */
export async function deleteBookingAction(
  bookingId: string
): Promise<ActionResult> {
  await requireAdmin();

  const result = await adminDeleteBooking(bookingId);
  if (!result.ok) return actionError(result.error);

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/blocks");
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeBlockAction(
  bookingId: string
): Promise<ActionResult> {
  await requireAdmin();

  const result = await unblockSlot(bookingId);
  if (!result.ok) return actionError(result.error);

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/blocks");
  return { ok: true };
}
