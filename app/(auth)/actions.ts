"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, profileIsComplete } from "@/lib/auth";
import { isOAuthOnlyAccount } from "@/lib/auth-identities";
import {
  authRedirectOrigin,
  RESET_PASSWORD_PATH,
  safeNextPath,
} from "@/lib/site-url";
import {
  firstIssue,
  newPasswordSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations";

export type AuthFormState = {
  error?: string;
  notice?: string;
};

/**
 * Where to send someone once they are authenticated.
 *
 * A profile that is missing a phone or address is sent through
 * /complete-profile first, carrying the original destination. This catches
 * both Google sign-ins (Google supplies neither) and accounts created before
 * those fields existed.
 */
async function destinationAfterAuth(next: string): Promise<string> {
  const user = await getCurrentUser();
  if (user && !profileIsComplete(user)) {
    return `/complete-profile?next=${encodeURIComponent(next)}`;
  }
  return next;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { email, password, name, phone, address } = parsed.data;
  const supabase = await createClient();
  const origin = await authRedirectOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // Handed to the on_auth_user_created trigger, which copies these into
      // public."User". The app still never INSERTs the profile row itself, so
      // profile creation cannot be skipped — see the migration for the trigger.
      data: { name, phone, address },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // With "Confirm email" ON, Supabase returns a user but no session.
  if (data.user && !data.session) {
    return {
      notice: `Check ${email} for a confirmation link to finish signing up.`,
    };
  }

  revalidatePath("/", "layout");
  redirect(await destinationAfterAuth(safeNextPath(formData.get("next"))));
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately generic: do not reveal whether the address has an account.
    return { error: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");
  redirect(await destinationAfterAuth(safeNextPath(formData.get("next"))));
}

export type ResetRequestState = {
  error?: string;
  /** The address the link went to — drives the "check your email" panel. */
  sentTo?: string;
  /** The address signs in with Google, so there is no password to reset. */
  googleOnly?: boolean;
};

/**
 * Send a password-reset link.
 *
 * Supabase answers identically whether or not the address has an account, and
 * so do we — the response never confirms who is registered. The one exception
 * is a Google-only account: a reset link would be a dead end for them (there is
 * no password on the account), so they are pointed at the Google button
 * instead. That does disclose that the address is a Google user, which is the
 * deliberate trade for not stranding them.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { email } = parsed.data;

  if (await isOAuthOnlyAccount(email)) {
    return { googleOnly: true };
  }

  const supabase = await createClient();
  const origin = await authRedirectOrigin();

  // The link lands directly on the reset page, and that URL carries NO query
  // string of its own. Supabase matches `redirectTo` against its Redirect URLs
  // allow list as a whole URL, so an entry of `.../auth/callback` does not
  // match `.../auth/callback?next=%2Freset-password` — it silently falls back
  // to the Site URL, and the user lands on the home page or the login form
  // instead of the reset form. A bare path cannot be mismatched that way.
  //
  // The page itself handles every transport Supabase might use to deliver the
  // token — see app/(auth)/reset-password/page.tsx.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}${RESET_PASSWORD_PATH}`,
  });

  if (error) {
    // Mostly Supabase's own email rate limit. Say so without leaking whether
    // the address exists.
    return {
      error: "Could not send that email just now. Wait a minute and try again.",
    };
  }

  return { sentTo: email };
}

export type UpdatePasswordState = {
  error?: string;
  done?: boolean;
};

/**
 * Set a new password for the currently authenticated user.
 *
 * Reached with the short-lived session that the recovery link created. The
 * session is the authorization — `getUser()` revalidates it against Supabase,
 * so an expired or forged cookie cannot change anybody's password.
 */
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "That reset link has expired. Request a new one and open it within the hour.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  // Every session is ended, this one included. The point of a reset is usually
  // that someone else knew the old password, so leaving any session alive
  // defeats it — and signing out here is what makes "now log in with your new
  // password" an honest instruction rather than a detour past /account.
  await supabase.auth.signOut({ scope: "global" });

  revalidatePath("/", "layout");
  return { done: true };
}

/**
 * Start the Google OAuth handshake.
 *
 * `signInWithOAuth` on the server does not sign anyone in — it only builds the
 * provider URL, which we then redirect to. Google sends the user back to
 * /auth/callback, which exchanges the code for a session and decides where
 * they land (see that route).
 */
export async function signInWithGoogle(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const origin = await authRedirectOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        // Ask Google to show the chooser rather than silently reusing the one
        // signed-in account — shared/family machines are common here.
        prompt: "select_account",
      },
    },
  });

  if (error || !data?.url) {
    return {
      error: "Could not reach Google right now. Try again, or use your email and password.",
    };
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
