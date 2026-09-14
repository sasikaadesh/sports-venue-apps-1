"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  actionError,
  specialRequestStatusSchema,
  type ActionResult,
} from "@/lib/validations";

/**
 * Special-request actions. `requireAdmin()` first, every time — a server action
 * is a public HTTP endpoint, and living under /admin proves nothing about the
 * caller. Admin-level, not super-admin: following up requests is staff work.
 */
export async function setSpecialRequestStatusAction(
  id: string,
  status: unknown
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = specialRequestStatusSchema.safeParse(status);
  if (!parsed.success) return actionError("That is not a valid status.");

  try {
    await prisma.specialRequest.update({
      where: { id },
      data: { status: parsed.data },
    });
  } catch {
    return actionError("That request no longer exists.");
  }

  revalidatePath("/admin/special-requests");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
