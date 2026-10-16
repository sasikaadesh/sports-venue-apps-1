import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Did this auth code come from a signup confirmation that has already
 * succeeded? Read straight from Supabase's `auth.flow_state`.
 *
 * Exists because of how a PKCE confirmation link works. Supabase's `/verify`
 * endpoint confirms the email address *first*, and only then redirects to
 * /auth/callback with a `?code=`. Turning that code into a session needs the
 * code verifier, which `signUp` stored as a cookie in the browser that filled
 * in the form. Open the email anywhere else — a phone, Gmail's in-app browser,
 * a different browser on the same machine — and the exchange fails with
 * `pkce_code_verifier_not_found`, on an account that is already confirmed.
 * Calling that "invalid or expired" was the false-expiry bug.
 *
 * The verifier cannot be recreated (that is PKCE's whole point), so the person
 * still has to log in. But the server can say *why* truthfully: the flow row
 * names the auth method and the user, and `auth.users` says whether the email
 * is confirmed. A link that was really used has had its row consumed by the
 * successful exchange; a really expired one is rejected by `/verify` before it
 * ever reaches us — so neither can land here.
 *
 * Prisma connects as the `postgres` role, which can read the `auth` schema.
 * Only a boolean leaves this function — never the address or the user id.
 */
export async function isConfirmedSignupCode(code: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ confirmed: boolean }[]>`
      select u.email_confirmed_at is not null as confirmed
      from auth.flow_state fs
      join auth.users u on u.id = fs.user_id
      where fs.auth_code = ${code}
        and fs.authentication_method = 'email/signup'
    `;
    return rows.some((row) => row.confirmed);
  } catch {
    // The auth schema being unreachable must not break the callback — the
    // caller falls back to the generic message it always showed.
    return false;
  }
}
