import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password — Courtside",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // `error` is set by /auth/callback when a recovery link is dead on arrival.
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Forgot your password?</h1>
        <p className="text-muted-foreground">
          Enter the email you book with and we&apos;ll send a link to set a new
          one.
        </p>
      </div>

      <ForgotPasswordForm initialError={error} />
    </div>
  );
}
