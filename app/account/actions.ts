"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  actionError,
  firstIssue,
  profileSchema,
  type ActionResult,
} from "@/lib/validations";

/**
 * Save the signed-in user's own name, phone and address.
 *
 * Used by both the account page and the "Complete your profile" step after a
 * Google sign-in — they collect the same three fields, so they share one
 * writer.
 *
 * `requireUser()` supplies the id; the id is never taken from the form. That
 * is the whole authorization story here: a user can only ever write their own
 * row, and `role` is not in `profileSchema`, so this action cannot change it
 * however the request is crafted.
 */
export async function updateProfileAction(
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
    },
  });

  revalidatePath("/account");
  revalidatePath("/complete-profile");
  return { ok: true };
}
