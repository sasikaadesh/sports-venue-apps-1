import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SecurityLoginForm } from "@/components/security-login-form";
import { getBookingsViewer } from "@/lib/security-staff/auth";
import { safeNextPath } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Security sign-in",
};

export default async function SecurityLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in (admin session or an unexpired security cookie) — go
  // straight to the overview rather than showing the form again.
  if (await getBookingsViewer()) {
    redirect(safeNextPath(next, "/bookings"));
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Security sign-in</h1>
        <p className="text-muted-foreground">
          Sign in with the username and PIN issued to you to view today&rsquo;s
          and this week&rsquo;s bookings.
        </p>
      </div>

      <SecurityLoginForm next={safeNextPath(next, "/bookings")} />
    </div>
  );
}
