"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionError, type ActionResult } from "@/lib/validations";

/**
 * Contact-inbox actions.
 *
 * Every one calls `requireAdmin()` first — a server action is a public HTTP
 * endpoint, and living under /admin proves nothing about the caller.
 * Reading the inbox is admin-level, not super-admin-level: answering enquiries
 * is ordinary staff work.
 */

export async function setMessageReadAction(
  id: string,
  read: boolean
): Promise<ActionResult> {
  await requireAdmin();

  await prisma.contactMessage.update({
    where: { id },
    data: { readAt: read ? new Date() : null },
  });

  revalidatePath("/admin/messages");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    await prisma.contactMessage.delete({ where: { id } });
  } catch {
    // Already gone — most likely two admins clearing the inbox at once.
    return actionError("That message no longer exists.");
  }

  revalidatePath("/admin/messages");
  revalidatePath("/admin");
  return { ok: true };
}
