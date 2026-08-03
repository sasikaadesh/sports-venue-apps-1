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
 * Google returns an email and usually a name, but no phone number, address,
 * NIC or affiliation — and the venue needs all four. Rather than block the
 * OAuth flow, we let the sign-in finish and collect the missing fields here,
 * then continue to wherever they were headed.
 *
 * This is also where **accounts that predate a field** are topped up. Anyone
 * who registered before NIC and affiliation existed has them NULL, which reads
 * as an incomplete profile; they sign in exactly as before and are asked once,
 * here. Nothing about their login breaks.
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
          Signed in as {user.email}. We just need a few details so we can reach
          you about a booking and know how you are connected to the school.
        </p>
      </div>

      <ProfileForm
        defaultValues={{
          name: user.name ?? "",
          phone: user.phone ?? "",
          address: user.address ?? "",
          nic: user.nic ?? "",
          affiliation: user.affiliation ?? undefined,
        }}
        submitLabel="Save and continue"
        redirectTo={destination}
      />
    </div>
  );
}
