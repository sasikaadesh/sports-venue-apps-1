import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Which sign-in identities an address has, read straight from Supabase's
 * `auth.identities`.
 *
 * Only used to answer one question: "is there a password to reset here?".
 * Someone who signed up with Google has no password, and sending them a reset
 * link they can never complete is a dead end — so the forgot-password flow
 * tells them to sign in with Google instead.
 *
 * Prisma connects as the `postgres` role, which can read the `auth` schema.
 * Nothing here is exposed to the client beyond the single boolean below.
 */
export async function isOAuthOnlyAccount(email: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ provider: string }[]>`
      select i.provider
      from auth.identities i
      join auth.users u on u.id = i.user_id
      where lower(u.email) = ${email.toLowerCase()}
    `;

    // No rows means "no account, or we cannot tell" — either way the caller
    // takes the ordinary "check your email" path, so an unknown address is
    // never confirmed or denied. Supabase's own `resetPasswordForEmail` is
    // silent about existence for the same reason.
    return rows.length > 0 && !rows.some((row) => row.provider === "email");
  } catch {
    // The auth schema being unreachable must not break password recovery.
    return false;
  }
}
