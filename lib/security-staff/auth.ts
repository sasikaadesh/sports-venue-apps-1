import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser, roleIsAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readSecuritySessionCookie } from "@/lib/security-staff/session";

/**
 * Who may open `/bookings` — the security overview page. Exactly three kinds
 * of caller, and nothing else:
 *   - a signed-in `admin` or `super_admin` (the existing Supabase session);
 *   - a signed-in security-staff login (the cookie in
 *     `lib/security-staff/session.ts`), re-validated against the database on
 *     every call so a super admin disabling the account takes effect on the
 *     very next request, not whenever the cookie happens to expire.
 *
 * This is the ONLY place `/bookings` may be reached from — there is no RLS
 * angle for a security login specifically, because it never acquires a
 * Supabase session or an anon-key JWT at all (CLAUDE.md's "server actions/
 * route handlers AND Postgres RLS" is satisfied the other way round here:
 * the thing RLS would normally restrict, direct anon-key access, simply has
 * no credential a security login could present to it). What stands in for
 * RLS is `SecurityStaff` itself being revoked from `anon`/`authenticated`
 * entirely (see the migration) and never queried except through this
 * server-only module.
 */

export type BookingsViewer =
  | { kind: "admin"; id: string; email: string; role: "admin" | "super_admin" }
  | { kind: "security"; id: string; username: string };

/** Read the caller's identity without redirecting — for the layout chrome. */
export async function getBookingsViewer(): Promise<BookingsViewer | null> {
  const user = await getCurrentUser();
  if (user && roleIsAdmin(user.role)) {
    return {
      kind: "admin",
      id: user.id,
      email: user.email,
      role: user.role as "admin" | "super_admin",
    };
  }

  const session = await readSecuritySessionCookie();
  if (!session) return null;

  const staff = await prisma.securityStaff.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      username: true,
      isActive: true,
      sessionVersion: true,
    },
  });

  // Re-checked here, not just at login: a disabled account must lose access
  // on its next request, not twelve hours later when the cookie expires. The
  // `sessionVersion` compare is the same idea applied to a PIN reset: it is
  // bumped by `setSecurityStaffActive(false)` and `resetSecurityStaffPin`
  // (lib/security-staff/service.ts), so a cookie minted before either of
  // those stops matching immediately rather than staying valid until its own
  // 12-hour expiry.
  if (
    !staff ||
    !staff.isActive ||
    staff.username !== session.username ||
    staff.sessionVersion !== session.sessionVersion
  ) {
    return null;
  }

  return { kind: "security", id: staff.id, username: staff.username };
}

/** Require one of the three roles above, or redirect to the right sign-in page. */
export async function requireBookingsAccess(): Promise<BookingsViewer> {
  const viewer = await getBookingsViewer();
  if (!viewer) redirect("/security-login?next=%2Fbookings");
  return viewer;
}
