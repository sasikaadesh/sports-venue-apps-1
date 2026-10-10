import "server-only";

import { prisma } from "@/lib/prisma";
import {
  hashPin,
  verifyAgainstDummy,
  verifyPin,
} from "@/lib/security-staff/pin";

/**
 * Security-staff accounts: individual username + PIN logins, created and
 * removed by a super admin. See `SecurityStaff` in schema.prisma and
 * docs/ARCHITECTURE.md → "Security staff" for why this is its own table
 * rather than a Supabase Auth user or a `Role` value.
 *
 * Every write here is reached only from `requireSuperAdmin()`-gated server
 * actions (`app/admin/security-staff/actions.ts`) — this module itself does
 * no authorization, exactly like `lib/booking-service.ts` and
 * `lib/user-ratings.ts`.
 */

/** Wrong PINs allowed before the account locks. */
export const MAX_FAILED_ATTEMPTS = 5;

/** How long a lockout lasts once triggered. */
export const LOCKOUT_MINUTES = 15;

export type SecurityStaffRow = {
  id: string;
  username: string;
  label: string | null;
  isActive: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  disabledAt: Date | null;
  createdBy: { name: string | null; email: string } | null;
};

export async function listSecurityStaff(): Promise<SecurityStaffRow[]> {
  return prisma.securityStaff.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      username: true,
      label: true,
      isActive: true,
      failedAttempts: true,
      lockedUntil: true,
      createdAt: true,
      disabledAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
}

export async function createSecurityStaff(input: {
  username: string;
  pin: string;
  label?: string;
  createdById: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const username = input.username.toLowerCase();

  const existing = await prisma.securityStaff.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "That username is already taken." };
  }

  const staff = await prisma.securityStaff.create({
    data: {
      username,
      pinHash: hashPin(input.pin),
      label: input.label?.trim() || null,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  return { ok: true, id: staff.id };
}

export async function setSecurityStaffActive(
  id: string,
  isActive: boolean
): Promise<void> {
  await prisma.securityStaff.update({
    where: { id },
    data: {
      isActive,
      disabledAt: isActive ? null : new Date(),
      // Re-enabling an account should not hand back a half-spent lockout.
      ...(isActive ? { failedAttempts: 0, lockedUntil: null } : {}),
      // Disabling bumps the session version so a cookie issued before this
      // moment stops being accepted on its very next request
      // (`getBookingsViewer` compares it) — it does not wait out its own
      // 12-hour expiry.
      ...(isActive ? {} : { sessionVersion: { increment: 1 } }),
    },
  });
}

export async function removeSecurityStaff(id: string): Promise<void> {
  await prisma.securityStaff.delete({ where: { id } });
}

export async function resetSecurityStaffPin(
  id: string,
  pin: string
): Promise<void> {
  await prisma.securityStaff.update({
    where: { id },
    data: {
      pinHash: hashPin(pin),
      failedAttempts: 0,
      lockedUntil: null,
      // Same reasoning as disabling above: a PIN reset must end any session
      // that was opened with the old PIN immediately, not merely stop new
      // logins with it.
      sessionVersion: { increment: 1 },
    },
  });
}

export type SecurityLoginResult =
  | {
      ok: true;
      staff: { id: string; username: string; sessionVersion: number };
    }
  | { ok: false; error: string };

/** The one message every failure reads as — see the function doc below. */
const GENERIC_LOGIN_ERROR = "Invalid username or PIN.";

type LockedStaffRow = {
  id: string;
  username: string;
  pinHash: string;
  isActive: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  sessionVersion: number;
};

/**
 * Check a username + PIN, with per-account lockout.
 *
 * **The error message is always the same generic string** — "no such
 * username", "wrong PIN", "account disabled" AND "account locked" are all
 * indistinguishable from outside. An earlier version gave a lockout its own
 * message, which told an attacker a guessed username exists the moment they
 * found five wrong PINs for it; refusing a *correct* PIN with no explanation
 * is the accepted cost of not leaking that. `verifyAgainstDummy` keeps a
 * nonexistent username from finishing faster than a real one, which would
 * otherwise let someone enumerate valid usernames by timing instead.
 *
 * **The whole check runs inside one transaction that takes a row lock on the
 * account (`SELECT ... FOR UPDATE`)**, not a plain read followed by a
 * separate write. A bare read-then-write here would race: a burst of
 * concurrent requests could all read "not locked yet" before any of their
 * failure counts landed, and all MAX_FAILED_ATTEMPTS+1 of them would get to
 * guess. The row lock serialises every concurrent attempt against the same
 * username — on Postgres, not in this process, so it holds even across
 * separate serverless instances — so the Nth attempt is always evaluated
 * against the effects of the first N-1, however many arrive at once.
 *
 * **`failedAttempts` is never reset by a lockout, only by a correct PIN.**
 * Resetting it to 0 when a lockout fires (the earlier version did this) hands
 * back a full fresh set of attempts every time a lockout expires — a few
 * hundred guesses a day, indefinitely. Leaving the count where it is means
 * the very next wrong PIN after a lockout expires re-locks the account
 * immediately, which is the point of a lockout: it should get *harder* to
 * keep guessing over time, not reset itself into a steady drip.
 */
export async function attemptSecurityLogin(
  rawUsername: string,
  pin: string
): Promise<SecurityLoginResult> {
  const username = rawUsername.toLowerCase();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedStaffRow[]>`
      SELECT "id", "username", "pinHash", "isActive", "failedAttempts",
             "lockedUntil", "sessionVersion"
      FROM "SecurityStaff"
      WHERE "username" = ${username}
      FOR UPDATE
    `;
    const staff = rows[0];

    if (!staff || !staff.isActive) {
      verifyAgainstDummy(pin);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    if (staff.lockedUntil && staff.lockedUntil.getTime() > Date.now()) {
      // Still inside this transaction's lock, so a login landing here cannot
      // be interleaved with the write that set the lock — it is reading the
      // true, committed state of this account, not a stale one.
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    const correct = verifyPin(pin, staff.pinHash);

    if (!correct) {
      const failedAttempts = staff.failedAttempts + 1;
      const locking = failedAttempts >= MAX_FAILED_ATTEMPTS;

      await tx.securityStaff.update({
        where: { id: staff.id },
        data: {
          failedAttempts,
          lockedUntil: locking
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : staff.lockedUntil,
        },
      });

      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    // A correct PIN is the only thing that ever clears a run of failures.
    if (staff.failedAttempts > 0 || staff.lockedUntil) {
      await tx.securityStaff.update({
        where: { id: staff.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    return {
      ok: true,
      staff: {
        id: staff.id,
        username: staff.username,
        sessionVersion: staff.sessionVersion,
      },
    };
  });
}
