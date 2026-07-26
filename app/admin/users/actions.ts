"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  actionError,
  assignableRoleSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validations";
import type { Role } from "@/lib/generated/prisma/enums";

/**
 * User administration.
 *
 * THE RULES, all enforced here on the server (the UI only mirrors them):
 *
 *   1. You can never act on yourself. Not remove, not demote. This is what
 *      stops an admin locking the venue out of its own panel by accident.
 *   2. A plain `admin` may only act on `user` accounts. Touching an `admin` or
 *      a `super_admin` — removing, promoting, demoting — is `super_admin` only.
 *   3. Only a `super_admin` may hand out or take away the `admin` role.
 *   4. `super_admin` is never assignable through the app. It is granted by
 *      migration or `npm run make-admin -- <email> super_admin`, both of which
 *      need database/service-role access. So the panel cannot mint a peer that
 *      could then remove you.
 *
 * Rules 1–3 are re-derived from the *database's* copy of both roles on every
 * call — never from the form, and never from the row the client claims to be
 * looking at. RLS carries the same rules for the anon-key path (see migration
 * 20260726120100), and the `protect_last_super_admin` trigger catches the
 * service-role path that bypasses both.
 */

type Actor = { id: string; role: Role };
type Target = { id: string; email: string; role: Role };

/** The target row, plus the authorization verdict for `actor` acting on it. */
async function loadTarget(
  actor: Actor,
  targetId: string
): Promise<{ ok: true; target: Target } | { ok: false; error: string }> {
  // Rule 1 — never act on yourself.
  if (targetId === actor.id) {
    return {
      ok: false,
      error:
        "You cannot change or remove your own account here. Ask another super admin.",
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true },
  });

  if (!target) return { ok: false, error: "That account no longer exists." };

  // Rule 2 — only a super admin may act on someone who is already an admin.
  if (target.role !== "user" && actor.role !== "super_admin") {
    return {
      ok: false,
      error: "Only a super admin can manage administrator accounts.",
    };
  }

  return { ok: true, target };
}

/**
 * Promote a user to admin, or demote an admin back to user.
 *
 * Super-admin only in both directions: `assignableRoleSchema` accepts just
 * "user" and "admin", so `super_admin` cannot be requested at all — the
 * escalation is not merely refused, it is unrepresentable.
 */
export async function setUserRoleAction(
  targetId: string,
  role: unknown
): Promise<ActionResult> {
  const actor = await requireAdmin();

  const parsed = assignableRoleSchema.safeParse(role);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  // Rule 3. Checked before loadTarget so a plain admin gets the accurate
  // reason ("you may not manage admins") rather than "that user is a user".
  if (actor.role !== "super_admin") {
    return actionError("Only a super admin can change a user's role.");
  }

  const result = await loadTarget(actor, targetId);
  if (!result.ok) return actionError(result.error);

  const { target } = result;

  if (target.role === parsed.data) {
    return actionError(`${target.email} is already ${parsed.data}.`);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Remove an account entirely.
 *
 * Deleted against **auth.users** with the service-role key, not against our
 * own table: deleting only the profile row would leave a live Supabase Auth
 * user who could still sign in and would simply have a fresh profile created
 * on their next request. Going the other way round is safe — the existing
 * `on_auth_user_deleted` trigger clears the profile row for us.
 *
 * Bookings survive: `Booking.userId` is `ON DELETE SET NULL`, so the venue
 * keeps its history and its money record; it just stops naming a person.
 */
export async function removeUserAction(targetId: string): Promise<ActionResult> {
  const actor = await requireAdmin();

  const result = await loadTarget(actor, targetId);
  if (!result.ok) return actionError(result.error);

  const { target } = result;

  // A super admin is never removable from the panel — see rule 4. The database
  // trigger refuses to drop the last one regardless, but failing here gives a
  // readable message instead of a raw constraint error.
  if (target.role === "super_admin") {
    return actionError(
      "Super admin accounts cannot be removed from the panel. Demote the account with the make-admin script first."
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(target.id);

  if (error) {
    return actionError(`Could not remove ${target.email}: ${error.message}`);
  }

  // Belt and braces: if the auth user existed without a profile trigger having
  // fired, the profile row would otherwise linger.
  await prisma.user.deleteMany({ where: { id: target.id } });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}
