import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/generated/prisma/enums";

/**
 * Server-side auth and role checks.
 *
 * This module is the ONLY place the app decides who someone is and what they
 * may do. Middleware does not make authorization decisions — a spoofed
 * `x-middleware-subrequest` header can skip middleware entirely
 * (CVE-2025-29927), so every protected page, server action and route handler
 * calls one of the helpers below directly.
 */

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
};

/** Columns that make up a `CurrentUser`. Kept in one place so every read agrees. */
const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  address: true,
  role: true,
} as const;

/**
 * Roles that may enter the admin panel. `super_admin` is a strict superset of
 * `admin`, so every existing admin gate accepts it — the extra powers are
 * gated separately by `requireSuperAdmin`.
 */
const ADMIN_ROLES: readonly Role[] = ["admin", "super_admin"];

export function roleIsAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/**
 * The logged-in user, or null.
 *
 * Uses `supabase.auth.getUser()`, which revalidates the JWT against Supabase's
 * auth server. Do NOT swap this for `getSession()` — that trusts the cookie as
 * sent by the browser and can be forged.
 *
 * Wrapped in `cache()` so several components in one render share a single
 * lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // The role lives in our own `User` table, never in user-editable JWT
  // metadata — client-supplied claims must not decide authorization.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: PROFILE_SELECT,
  });

  if (profile) return profile;

  // Fallback: the `on_auth_user_created` trigger should have made this row at
  // signup. If it is missing (e.g. the trigger was not installed yet), create
  // it here with the default 'user' role rather than failing the request.
  // Upsert, not create — two concurrent requests would otherwise race and one
  // would blow up on the primary key. Note `update: {}`: an existing row is
  // left exactly as-is, so this can never reset an admin back to 'user'.
  // The Google sign-in path lands here too: the trigger fills `name` from the
  // OIDC claim, but never phone or address, so `metadata` is only a fallback.
  const metadata = user.user_metadata ?? {};
  const fromMetadata = (key: string): string | undefined => {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  return prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email!,
      name: fromMetadata("name") ?? fromMetadata("full_name") ?? null,
      phone: fromMetadata("phone") ?? null,
      address: fromMetadata("address") ?? null,
    },
    update: {},
    select: PROFILE_SELECT,
  });
});

/** True when the current request comes from an admin or a super admin. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && roleIsAdmin(user.role);
}

/** True only for a super admin — the role that may manage other admins. */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "super_admin";
}

/**
 * A profile is complete once we have a phone number and an address.
 *
 * Email/password signup collects both up front. Google does not supply either,
 * so an OAuth user arrives incomplete and is routed to /complete-profile.
 */
export function profileIsComplete(
  user: Pick<CurrentUser, "phone" | "address">
): boolean {
  return !!user.phone?.trim() && !!user.address?.trim();
}

/**
 * Require a logged-in user — for pages and server actions.
 * Redirects to /login (with a return path) when signed out.
 */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

/**
 * Require an admin — for pages and server actions.
 *
 * Signed-out users go to /login; signed-in non-admins go to /account, where
 * they are told they lack access. The check runs on the server on every
 * request, so hiding the admin link in the UI is presentation only, never the
 * boundary.
 */
export async function requireAdmin(returnTo?: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!roleIsAdmin(user.role)) {
    redirect("/account?denied=admin");
  }
  return user;
}

/**
 * Require a super admin — the gate on managing other admins.
 *
 * A plain admin who reaches one of these is bounced to the admin panel with a
 * message, not to /account: they *are* an admin, just not this kind.
 */
export async function requireSuperAdmin(
  returnTo?: string
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "super_admin") {
    redirect(
      roleIsAdmin(user.role)
        ? "/admin/users?denied=super_admin"
        : "/account?denied=admin"
    );
  }
  return user;
}

/**
 * Require a complete profile — for pages a half-registered Google user should
 * not reach yet. Sends them to /complete-profile and back afterwards.
 */
export async function requireCompleteProfile(
  returnTo?: string
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!profileIsComplete(user)) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/complete-profile${next}`);
  }
  return user;
}

/**
 * Role check for route handlers and anywhere a redirect is the wrong answer.
 * Returns the user on success, or a Response to return as-is.
 */
export async function requireAdminApi(): Promise<
  { user: CurrentUser; error: null } | { user: null; error: Response }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: Response.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (!roleIsAdmin(user.role)) {
    return {
      user: null,
      error: Response.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
