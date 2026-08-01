import "server-only";

import { headers } from "next/headers";

/**
 * The origin to build absolute callback URLs from (email confirmation links,
 * the OAuth `redirectTo`).
 *
 * `NEXT_PUBLIC_BASE_URL` wins when it is set, because a forwarded host header
 * is ultimately supplied by the caller. The header fallback exists so preview
 * deployments and local dev work without extra configuration.
 *
 * This is not the security boundary for OAuth: Supabase only honours a
 * `redirectTo` that matches its own Redirect URLs allow list, so an attacker
 * spoofing a host header cannot redirect the callback to their own domain.
 * Keep that allow list tight (see docs/ARCHITECTURE.md → Google sign-in).
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";

  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Where a recovery email drops the user once /auth/callback has verified the
 * link. Lives here rather than in `(auth)/actions.ts` because a "use server"
 * file may only export async functions.
 */
export const RESET_PASSWORD_PATH = "/reset-password";

/** Only relative, single-slash paths — never an attacker-supplied host. */
export function safeNextPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/account"
): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
