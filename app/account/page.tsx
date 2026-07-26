import type { Metadata } from "next";
import Link from "next/link";
import {
  LogOut,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { ProfileForm } from "@/components/profile-form";
import { signOut } from "@/app/(auth)/actions";
import { profileIsComplete, requireUser, roleIsAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your account — Courtside",
};

const ROLE_LABELS: Record<string, string> = {
  user: "user",
  admin: "admin",
  super_admin: "super admin",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  // Server-side gate. Nothing below renders for a signed-out visitor.
  const user = await requireUser("/account");
  const { denied } = await searchParams;

  const isAdmin = roleIsAdmin(user.role);
  const incomplete = !profileIsComplete(user);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">Your account</h1>
          <p className="text-muted-foreground">Signed in as {user.email}.</p>
        </div>

        {/* Log out is always reachable from the account area, not buried in a
            menu — same control the admin header carries. */}
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="h-10">
            <LogOut />
            Log out
          </Button>
        </form>
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

      {incomplete && (
        <p
          role="status"
          className="mt-8 flex items-start gap-2.5 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm"
        >
          <UserIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Add your phone number and address below so we can reach you about a
            booking.
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
            <span className="font-medium">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
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

      <section className="mt-12 flex flex-col gap-5 border-t pt-10">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl leading-none">Your details</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Used to contact you about a booking. Your email address is your
            sign-in and cannot be changed here.
          </p>
        </div>

        <ProfileForm
          defaultValues={{
            name: user.name ?? "",
            phone: user.phone ?? "",
            address: user.address ?? "",
          }}
        />
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3 border-t pt-10">
        {isAdmin && (
          <LinkButton href="/admin" size="lg" className="h-10">
            <ShieldCheck />
            Open admin panel
          </LinkButton>
        )}
        <LinkButton href="/courts" variant="outline" size="lg" className="h-10">
          Browse courts
        </LinkButton>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="lg" className="h-10">
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
