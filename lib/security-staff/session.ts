import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The security-staff session cookie.
 *
 * Deliberately NOT a Supabase session — security staff have no `auth.users`
 * row at all (see `SecurityStaff` in schema.prisma), so there is no JWT for
 * Supabase to issue. This is a small signed token this app issues and checks
 * itself, entirely separate from `@supabase/ssr`'s cookies, the proxy's
 * refresh logic, and every `requireUser`/`requireAdmin` check in
 * `lib/auth.ts` — none of that code path is touched by this feature.
 *
 * Token shape: `base64url(json).hex(hmac)`, where `json` is
 * `{ id, username, exp }`. Nothing here is encrypted — a PIN hash never
 * appears in the token, so there is nothing in it worth hiding, only
 * tampering to prevent, which the HMAC does.
 */

export const SECURITY_SESSION_COOKIE = "security_session";

/** How long a security sign-in lasts before it must be renewed. */
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours — a long shift

function secret(): string {
  const value = process.env.SECURITY_SESSION_SECRET;
  if (!value) {
    // Fail loudly rather than falling back to a guessable default — this
    // secret is what stops a forged cookie granting access to /bookings.
    throw new Error(
      "SECURITY_SESSION_SECRET is not set. Add it to the environment before using security-staff login."
    );
  }
  return value;
}

type SecurityTokenPayload = {
  id: string;
  username: string;
  exp: number;
};

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function encode(payload: SecurityTokenPayload): string {
  const json = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${json}.${sign(json)}`;
}

function decode(token: string): SecurityTokenPayload | null {
  const [json, signature] = token.split(".");
  if (!json || !signature) return null;

  const expected = sign(json);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8")
    ) as SecurityTokenPayload;
    if (
      typeof payload.id !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Issue a session cookie for a signed-in security staff row. */
export async function setSecuritySessionCookie(staff: {
  id: string;
  username: string;
}): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = encode({ id: staff.id, username: staff.username, exp });

  const store = await cookies();
  store.set(SECURITY_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSecuritySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SECURITY_SESSION_COOKIE);
}

/**
 * The session's claimed identity, or null if there is no cookie, it is
 * malformed, tampered with, or expired.
 *
 * This is NOT by itself proof the account may still log in — the caller
 * (`lib/security-staff/auth.ts`) re-checks `isActive` against the database on
 * every request, because a super admin disabling an account must take effect
 * immediately, not twelve hours later when the cookie happens to expire.
 */
export async function readSecuritySessionCookie(): Promise<{
  id: string;
  username: string;
} | null> {
  const store = await cookies();
  const token = store.get(SECURITY_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decode(token);
  if (!payload) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return { id: payload.id, username: payload.username };
}
