"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import {
  createSecurityStaff,
  removeSecurityStaff,
  resetSecurityStaffPin,
  setSecurityStaffActive,
} from "@/lib/security-staff/service";
import {
  actionError,
  createSecurityStaffSchema,
  firstIssue,
  resetSecurityStaffPinSchema,
  type ActionResult,
} from "@/lib/validations";

/**
 * Managing security-staff logins — super-admin only, exactly like promoting
 * or removing an admin account (docs/ARCHITECTURE.md → "The role ladder").
 * Every action re-checks `requireSuperAdmin()` itself; nothing here trusts
 * that the page it was called from already did.
 */

const PATH = "/admin/security-staff";

export async function createSecurityStaffAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireSuperAdmin();

  const parsed = createSecurityStaffSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const result = await createSecurityStaff({
    username: parsed.data.username,
    pin: parsed.data.pin,
    label: parsed.data.label,
    createdById: admin.id,
  });

  if (!result.ok) return actionError(result.error);

  revalidatePath(PATH);
  return { ok: true, data: { id: result.id } };
}

export async function setSecurityStaffActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  await requireSuperAdmin();
  await setSecurityStaffActive(id, isActive);
  revalidatePath(PATH);
  return { ok: true };
}

export async function removeSecurityStaffAction(
  id: string
): Promise<ActionResult> {
  await requireSuperAdmin();
  await removeSecurityStaff(id);
  revalidatePath(PATH);
  return { ok: true };
}

export async function resetSecurityStaffPinAction(
  input: unknown
): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = resetSecurityStaffPinSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  await resetSecurityStaffPin(parsed.data.id, parsed.data.pin);
  revalidatePath(PATH);
  return { ok: true };
}
