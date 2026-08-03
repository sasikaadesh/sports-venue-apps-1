"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { removeOwnBooking } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import {
  actionError,
  firstIssue,
  profileSchema,
  type ActionResult,
} from "@/lib/validations";

/**
 * Save the signed-in user's own profile — name, phone, address, NIC and
 * affiliation.
 *
 * Used by both the account page and the "Complete your profile" step after a
 * Google sign-in — they collect the same fields, so they share one writer.
 *
 * `requireUser()` supplies the id; the id is never taken from the form. That
 * is the whole authorization story here: a user can only ever write their own
 * row, and `role` is not in `profileSchema`, so this action cannot change it
 * however the request is crafted. The same holds for the conduct ratings: they
 * live in another table entirely, and nothing a user can call reads or writes
 * them.
 */
export async function updateProfileAction(
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        address: parsed.data.address,
        nic: parsed.data.nic,
        affiliation: parsed.data.affiliation,
      },
    });
  } catch (e) {
    // The UNIQUE index on `nic` is the one thing here that can fail on
    // otherwise-valid input, and it is the guarantee that one NIC means one
    // account. Translate it rather than showing a constraint name.
    if (isUniqueViolation(e)) {
      return actionError(
        "That NIC is already registered to another account. Check the number, or contact the sports office."
      );
    }
    throw e;
  }

  revalidatePath("/account");
  revalidatePath("/complete-profile");
  return { ok: true };
}

/** Postgres unique-constraint violation, surfaced by Prisma as P2002. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Remove one of your own unpaid bookings from your bookings list.
 *
 * The action authenticates and hands off — it does no booking writes of its
 * own (CLAUDE.md). Both halves of the rule (yours, and unpaid) live in
 * `removeOwnBooking`, in the queries themselves: a server action is a public
 * HTTP endpoint, so hiding the button on a `confirmed` booking is presentation,
 * never the boundary.
 */
export async function removeOwnBookingAction(
  bookingId: string
): Promise<ActionResult> {
  const user = await requireUser("/account");

  if (typeof bookingId !== "string" || !bookingId) {
    return actionError("Choose a booking to remove.");
  }

  const result = await removeOwnBooking(bookingId, user.id);
  if (!result.ok) return actionError(result.error);

  // Removing a live hold hands its hours back, so anywhere availability is
  // drawn is now stale.
  if (result.data.releasedHours) {
    revalidatePath("/");
    revalidatePath("/courts", "layout");
  }
  revalidatePath("/account");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");

  return { ok: true };
}
