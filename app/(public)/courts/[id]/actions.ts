"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { sendSpecialRequestAdminEmail } from "@/lib/email/special-request";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  dateStringToDate,
  formatDate,
  formatTime,
  timeStringToDate,
  todayString,
} from "@/lib/time";
import {
  actionError,
  firstIssue,
  specialRequestSchema,
  type ActionResult,
} from "@/lib/validations";

/** How far ahead a special request may ask for. Wider than the booking window. */
const REQUEST_WINDOW_DAYS = 365;

/**
 * Store a special request for a court.
 *
 * This is a MESSAGE to the admin, not a reservation: it never touches
 * `Booking` or `BookingSlot`, so it cannot hold an hour or collide with the
 * anti-double-booking constraint. The booking service is deliberately not
 * involved.
 *
 * Signed-in only. The requester's id and contact details are read from their
 * account on the server — nothing about who is asking is accepted from the
 * client, so a request can never be filed in someone else's name.
 */
export async function submitSpecialRequest(
  input: unknown
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("Sign in to send a special request.");

  const parsed = specialRequestSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, preferredDate, preferredTime, playerCount, message } =
    parsed.data;

  const today = todayString();
  if (preferredDate < today) {
    return actionError("Pick a date from today onwards.");
  }
  if (preferredDate > addDays(today, REQUEST_WINDOW_DAYS)) {
    return actionError("Pick a date within the next year.");
  }

  // Only courts the public can see may be requested.
  const court = await prisma.court.findFirst({
    where: { id: courtId, isActive: true },
    select: { id: true, name: true },
  });
  if (!court) return actionError("That court is not available.");

  const date = dateStringToDate(preferredDate);
  const time = timeStringToDate(preferredTime);

  await prisma.specialRequest.create({
    data: {
      userId: user.id,
      courtId: court.id,
      courtName: court.name,
      name: user.name,
      email: user.email,
      phone: user.phone,
      preferredDate: date,
      preferredTime: time,
      playerCount,
      message,
    },
  });

  revalidatePath("/admin/special-requests");
  revalidatePath("/admin", "layout");

  // Best-effort and awaited (a serverless function can be frozen the moment it
  // responds). It swallows its own failures, so a mail outage cannot turn a
  // saved request into an error for the member.
  await sendSpecialRequestAdminEmail({
    name: user.name,
    email: user.email,
    phone: user.phone,
    courtName: court.name,
    date: formatDate(date),
    time: formatTime(time),
    playerCount,
    message,
  });

  return { ok: true };
}
