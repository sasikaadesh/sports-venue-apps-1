import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Email-confirmation landing point.
 *
 * Supabase sends either `?code=` (PKCE) or `?token_hash=&type=` depending on
 * the project's email template, so both are handled.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only relative paths — an open redirect here would be handed to every new
  // user by email.
  const rawNext = searchParams.get("next") ?? "/account";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("That confirmation link is invalid or has expired.")}`
  );
}
