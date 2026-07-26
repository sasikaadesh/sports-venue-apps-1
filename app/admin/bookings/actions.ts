"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { adminCancelBooking, unblockSlot } from "@/lib/booking-service";
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
