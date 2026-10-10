"use server";

import { redirect } from "next/navigation";

import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { attemptSecurityLogin } from "@/lib/security-staff/service";
import {
  clearSecuritySessionCookie,
  setSecuritySessionCookie,
} from "@/lib/security-staff/session";
import { safeNextPath } from "@/lib/site-url";
import { securityLoginSchema } from "@/lib/validations";

export type SecurityLoginFormState = { error?: string };

const GENERIC_ERROR = "Invalid username or PIN.";

/**
 * Per-IP cap, on top of the per-account lockout in `attemptSecurityLogin`.
 * The per-account lockout alone does not stop someone spraying one guessed
 * PIN across many different usernames (each account sees only one wrong
 * attempt, so none of them ever lock) — this bounds the same connection's
 * total login attempts regardless of which username they are aimed at.
 * In-memory, so it is a brake, not a hard guarantee — same trade-off as the
 * contact form's limiter (lib/rate-limit.ts).
 */
const LOGIN_IP_RATE_LIMIT = 20;
const LOGIN_IP_RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Username + PIN sign-in for security staff — entirely separate from
 * `app/(auth)/actions.ts`'s email/password `signIn`. See
 * `lib/security-staff/*` for why.
 */
export async function securityLoginAction(
  _state: SecurityLoginFormState,
  formData: FormData
): Promise<SecurityLoginFormState> {
  const parsed = securityLoginSchema.safeParse({
    username: formData.get("username"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a username and PIN.",
    };
  }

  if (
    !checkRateLimit(
      await clientIp(),
      LOGIN_IP_RATE_LIMIT,
      LOGIN_IP_RATE_WINDOW_MS
    )
  ) {
    // Same generic error as every other failure here — this is a flood
    // brake, not information about which account exists.
    return { error: GENERIC_ERROR };
  }

  const result = await attemptSecurityLogin(
    parsed.data.username,
    parsed.data.pin
  );
  if (!result.ok) return { error: result.error };

  await setSecuritySessionCookie(result.staff);

  const next = safeNextPath(formData.get("next"), "/bookings");
  redirect(next);
}

export async function securityLogoutAction(): Promise<void> {
  await clearSecuritySessionCookie();
  redirect("/security-login");
}
