import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldAlert, ShieldCheck, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your account — Courtside",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  // Server-side gate. Nothing below renders for a signed-out visitor.
  const user = await requireUser("/account");
  const { denied } = await searchParams;

  const isAdmin = user.role === "admin";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-none">Your account</h1>
        <p className="text-muted-foreground">
          Signed in as {user.email}.
        </p>
      </div>

      {denied === "admin" && (
        <p
          role="alert"
          className="mt-8 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            The admin area is restricted to administrators. This was blocked on
            the server — the page was never rendered for you.
          </span>
        </p>
      )}

      <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
        <div className="bg-card px-5 py-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </dt>
          <dd className="mt-1 truncate text-sm">{user.email}</dd>
        </div>
        <div className="bg-card px-5 py-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Role
          </dt>
          <dd className="mt-1 flex items-center gap-2 text-sm">
            {isAdmin ? (
              <ShieldCheck className="size-4 text-primary" />
            ) : (
              <UserIcon className="size-4 text-muted-foreground" />
            )}
            <span className="font-medium">{user.role}</span>
          </dd>
        </div>
        <div className="bg-card px-5 py-4 sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            User ID
          </dt>
          <dd className="mt-1 font-mono text-xs text-muted-foreground">
            {user.id}
          </dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <LinkButton href="/admin" size="lg" className="h-10">
            Open admin panel
          </LinkButton>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="h-10">
            <LogOut />
            Log out
          </Button>
        </form>
      </div>

      {!isAdmin && (
        <p className="mt-8 max-w-prose text-sm text-muted-foreground">
          Your role is <span className="font-medium text-foreground">user</span>
          . Visiting{" "}
          <Link href="/admin" className="underline underline-offset-4">
            /admin
          </Link>{" "}
          directly will be refused by the server, not just hidden here.
        </p>
      )}
    </main>
  );
}
