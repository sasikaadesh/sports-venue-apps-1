"use server";

import { redirect } from "next/navigation";

import { attemptSecurityLogin } from "@/lib/security-staff/service";
import {
  clearSecuritySessionCookie,
  setSecuritySessionCookie,
} from "@/lib/security-staff/session";
import { safeNextPath } from "@/lib/site-url";
import { securityLoginSchema } from "@/lib/validations";

export type SecurityLoginFormState = { error?: string };

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
