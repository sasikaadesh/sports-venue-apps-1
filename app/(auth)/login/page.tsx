import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reset?: string;
    confirmed?: string;
  }>;
}) {
  const { next, error, reset, confirmed } = await searchParams;

  if (await getCurrentUser()) {
    redirect(next?.startsWith("/") ? next : "/account");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Welcome back</h1>
        <p className="text-muted-foreground">
          Log in to manage your court bookings.
        </p>
      </div>

      <AuthForm
        mode="login"
        action={signIn}
        next={next}
        initialError={error}
        // Set by the reset page after a successful password change, which
        // signs every session out — so this is the first thing they see.
        // `confirmed` is set by /auth/callback when a confirmation link worked
        // but was opened in a different browser from the one that signed up,
        // so there was no session to hand over — the account is confirmed.
        initialNotice={
          reset === "1"
            ? "Password updated. Log in with your new password."
            : confirmed === "1"
              ? "Your email address is confirmed. Log in to continue."
              : undefined
        }
      />
    </div>
  );
}
