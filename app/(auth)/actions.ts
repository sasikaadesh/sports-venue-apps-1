"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, profileIsComplete } from "@/lib/auth";
import { safeNextPath, siteOrigin } from "@/lib/site-url";
import { firstIssue, signInSchema, signUpSchema } from "@/lib/validations";

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
  const origin = await siteOrigin();

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
  const origin = await siteOrigin();

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
