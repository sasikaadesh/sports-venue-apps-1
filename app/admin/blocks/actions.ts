"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { blockSlot, unblockSlot } from "@/lib/booking-service";
import { dateStringToDate } from "@/lib/time";
import {
  actionError,
  blockSlotSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validations";

/**
 * Slot blocking.
 *
 * These actions do no booking writes of their own — they validate, check the
 * caller is an admin, then hand off to the booking service in /lib, which is
 * the single place `Booking` rows are created or removed (CLAUDE.md).
 */

export async function blockSlotAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

  const parsed = blockSlotSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const result = await blockSlot({
    courtId: parsed.data.courtId,
    slotId: parsed.data.slotId,
    bookingDate: dateStringToDate(parsed.data.bookingDate),
    adminId: admin.id,
  });

  if (!result.ok) return actionError(result.error);

  revalidatePath("/admin/blocks");
  revalidatePath("/admin/bookings");
  return { ok: true, data: result.data };
}

export async function unblockSlotAction(
  bookingId: string
): Promise<ActionResult> {
  await requireAdmin();

  const result = await unblockSlot(bookingId);
  if (!result.ok) return actionError(result.error);

  revalidatePath("/admin/blocks");
  revalidatePath("/admin/bookings");
  return { ok: true };
}
