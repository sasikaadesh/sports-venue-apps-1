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

/**
 * The origin for **auth redirects that come back to the browser that started
 * them** — the password-reset link, the signup confirmation link, the Google
 * `redirectTo`.
 *
 * This is the mirror image of `siteOrigin()`: the request host wins, and
 * `NEXT_PUBLIC_BASE_URL` is only the fallback. That inversion is deliberate and
 * is what makes local development work at all. `NEXT_PUBLIC_BASE_URL` has to be
 * the *production* URL, because PayHere's `notify_url` must be publicly
 * reachable — so with env-first, a reset requested on `localhost:3000` emails a
 * link pointing at the deployed site, and the user is thrown onto a different
 * host (usually landing signed-out, or on a build that has no such page).
 *
 * Safe because these values are not the security boundary: Supabase only
 * honours a `redirectTo` that matches its own Redirect URLs allow list, so a
 * spoofed `x-forwarded-host` cannot send the link to an attacker's domain — it
 * falls back to the Site URL instead. **That depends on the allow list being
 * tight**: never add a wildcard host to it (see docs/ARCHITECTURE.md → Google
 * sign-in).
 */
export async function authRedirectOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  return siteOrigin();
}

/** Only relative, single-slash paths — never an attacker-supplied host. */
export function safeNextPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/account"
): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
