import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, profileIsComplete } from "@/lib/auth";
import { safeNextPath } from "@/lib/site-url";

/**
 * The single landing point for every out-of-app auth hop: email confirmation
 * links and the Google OAuth redirect both come back here.
 *
 * Supabase sends either `?code=` (PKCE / OAuth) or `?token_hash=&type=`
 * depending on the project's email template, so both are handled.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // The provider can hand back its own failure instead of a code.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`
    );
  }

  // Only relative paths — an open redirect here would be handed to every new
  // user by email.
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  let signedIn = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    signedIn = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    signedIn = !error;
  }

  if (!signedIn) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link is invalid or has expired.")}`
    );
  }

  // Google gives us an email and usually a name, but never a phone number or
  // address — so a first Google sign-in always lands here incomplete and gets
  // routed through "Complete your profile" before continuing to `next`.
  // `getCurrentUser()` also creates the profile row if the trigger somehow did
  // not, so this read is what guarantees there is a row to check.
  const user = await getCurrentUser();
  if (user && !profileIsComplete(user)) {
    return NextResponse.redirect(
      `${origin}/complete-profile?next=${encodeURIComponent(next)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
