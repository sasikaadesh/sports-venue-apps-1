import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { profileIsComplete, requireUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Complete your profile — Courtside",
};

/**
 * The step a Google sign-in lands on.
 *
 * Google returns an email and usually a name, but no phone number and no
 * address — and the venue needs both to be able to contact someone about a
 * booking. Rather than block the OAuth flow, we let the sign-in finish and
 * collect the missing fields here, then continue to wherever they were headed.
 *
 * Guards `requireUser`, NOT `requireCompleteProfile` — the latter redirects to
 * this page, so using it here would loop forever. An already-complete profile
 * is simply passed through.
 */
export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(next);

  const user = await requireUser(`/complete-profile`);

  if (profileIsComplete(user)) {
    redirect(destination);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Almost there</h1>
        <p className="text-muted-foreground">
          Signed in as {user.email}. We just need a phone number and an address
          so we can reach you about a booking.
        </p>
      </div>

      <ProfileForm
        defaultValues={{
          name: user.name ?? "",
          phone: user.phone ?? "",
          address: user.address ?? "",
        }}
        submitLabel="Save and continue"
        redirectTo={destination}
      />
    </div>
  );
}
