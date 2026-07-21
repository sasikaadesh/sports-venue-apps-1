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
  role: Role;
};

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
    select: { id: true, email: true, role: true },
  });

  if (profile) return profile;

  // Fallback: the `on_auth_user_created` trigger should have made this row at
  // signup. If it is missing (e.g. the trigger was not installed yet), create
  // it here with the default 'user' role rather than failing the request.
  // Upsert, not create — two concurrent requests would otherwise race and one
  // would blow up on the primary key. Note `update: {}`: an existing row is
  // left exactly as-is, so this can never reset an admin back to 'user'.
  return prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email! },
    update: {},
    select: { id: true, email: true, role: true },
  });
});

/** True when the current request comes from an admin. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
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
  if (user.role !== "admin") {
    redirect("/account?denied=admin");
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
  if (user.role !== "admin") {
    return {
      user: null,
      error: Response.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
