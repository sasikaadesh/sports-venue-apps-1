"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  actionError,
  courtTypeSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validations";

/**
 * Court type actions.
 *
 * Every one calls `requireAdmin()` first. A server action is a public HTTP
 * endpoint — being nested under /admin proves nothing about the caller, and
 * the layout that guards those pages never runs for an action invocation.
 */

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

export async function createCourtType(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = courtTypeSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  try {
    const created = await prisma.courtType.create({
      data: {
        name: parsed.data.name,
        // Sorted so the players dropdown renders in a sensible order later.
        playerOptions: [...parsed.data.playerOptions].sort((a, b) => a - b),
      },
      select: { id: true },
    });

    revalidatePath("/admin/court-types");
    revalidatePath("/admin/courts");
    return { ok: true, data: created };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return actionError(`A court type called "${parsed.data.name}" already exists.`);
    }
    throw e;
  }
}

export async function updateCourtType(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = courtTypeSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  try {
    const updated = await prisma.courtType.update({
      where: { id },
      data: {
        name: parsed.data.name,
        playerOptions: [...parsed.data.playerOptions].sort((a, b) => a - b),
      },
      select: { id: true },
    });

    revalidatePath("/admin/court-types");
    revalidatePath("/admin/courts");
    return { ok: true, data: updated };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return actionError(`A court type called "${parsed.data.name}" already exists.`);
    }
    throw e;
  }
}

export async function deleteCourtType(id: string): Promise<ActionResult> {
  await requireAdmin();

  // Checked explicitly so the admin gets a useful message instead of a raw
  // foreign-key error. The FK is still the real guarantee.
  const courtCount = await prisma.court.count({ where: { courtTypeId: id } });

  if (courtCount > 0) {
    return actionError(
      `${courtCount} court${courtCount === 1 ? " uses" : "s use"} this type. Reassign or delete ${courtCount === 1 ? "it" : "them"} first.`
    );
  }

  await prisma.courtType.delete({ where: { id } });

  revalidatePath("/admin/court-types");
  revalidatePath("/admin/courts");
  return { ok: true };
}
