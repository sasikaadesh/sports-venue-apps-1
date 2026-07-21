import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin — Courtside",
};

export default async function AdminPage() {
  // Server-side gate. A non-admin is redirected before any of this renders,
  // regardless of what the client sends — middleware is not involved.
  const admin = await requireAdmin("/admin");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8">
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-medium text-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Admin access verified
        </span>
        <h1 className="mt-2 text-4xl leading-none">Admin panel</h1>
        <p className="text-muted-foreground">
          Signed in as {admin.email}.
        </p>
      </div>

      <div className="mt-10 rounded-xl border bg-card px-6 py-8">
        <h2 className="text-lg">Nothing here yet</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Court, court-type and slot-template management arrive in Phase 5. This
          page exists now to prove the role gate: it is reachable only by a user
          whose <code className="font-mono text-xs">role</code> is{" "}
          <code className="font-mono text-xs">admin</code> in the database.
        </p>
      </div>

      <LinkButton
        href="/account"
        variant="ghost"
        size="lg"
        className="mt-8 -ml-2.5 h-10"
      >
        <ArrowLeft />
        Back to account
      </LinkButton>
    </main>
  );
}
