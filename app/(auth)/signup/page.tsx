import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign up — Courtside",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  if (await getCurrentUser()) {
    redirect(next?.startsWith("/") ? next : "/account");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Create your account</h1>
        <p className="text-muted-foreground">
          Takes a minute. Then you can book any court in the school.
        </p>
      </div>

      <AuthForm mode="signup" action={signUp} next={next} />
    </div>
  );
}
