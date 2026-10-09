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
    data: { pinHash: hashPin(pin), failedAttempts: 0, lockedUntil: null },
  });
}

export type SecurityLoginResult =
  | { ok: true; staff: { id: string; username: string } }
  | { ok: false; error: string };

/**
 * Check a username + PIN, with per-account lockout.
 *
 * The error message is deliberately the same generic string for "no such
 * username", "wrong PIN" and "account disabled" — only a lockout gets its own
 * message, and only because the UI has to explain why a *correct* PIN is
 * being refused. `verifyAgainstDummy` keeps a nonexistent username from
 * finishing faster than a real one, which would otherwise let someone
 * enumerate valid usernames by timing.
 */
export async function attemptSecurityLogin(
  rawUsername: string,
  pin: string
): Promise<SecurityLoginResult> {
  const username = rawUsername.toLowerCase();
  const GENERIC_ERROR = "Invalid username or PIN.";

  const staff = await prisma.securityStaff.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      pinHash: true,
      isActive: true,
      failedAttempts: true,
      lockedUntil: true,
    },
  });

  if (!staff) {
    verifyAgainstDummy(pin);
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!staff.isActive) {
    return { ok: false, error: GENERIC_ERROR };
  }

  if (staff.lockedUntil && staff.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      error:
        "This account is temporarily locked after too many wrong PIN attempts. Try again later.",
    };
  }

  const correct = verifyPin(pin, staff.pinHash);

  if (!correct) {
    const updated = await prisma.securityStaff.update({
      where: { id: staff.id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });

    if (updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await prisma.securityStaff.update({
        where: { id: staff.id },
        data: {
          failedAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000),
        },
      });
      return {
        ok: false,
        error:
          "This account is temporarily locked after too many wrong PIN attempts. Try again later.",
      };
    }

    return { ok: false, error: GENERIC_ERROR };
  }

  // A correct PIN clears any partial run of failures.
  if (staff.failedAttempts > 0 || staff.lockedUntil) {
    await prisma.securityStaff.update({
      where: { id: staff.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  return { ok: true, staff: { id: staff.id, username: staff.username } };
}
