import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Log in — Courtside",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

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

      <AuthForm mode="login" action={signIn} next={next} initialError={error} />
    </div>
  );
}
