import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, User as UserIcon } from "lucide-react";

import {
  AccountBookings,
  countAccountBookings,
} from "@/components/account-bookings";
import { AccountTabs } from "@/components/account-tabs";
import { LinkButton } from "@/components/link-button";
import { LogoutButton } from "@/components/logout-button";
import { ProfileForm } from "@/components/profile-form";
import { parseAccountTab } from "@/lib/account-tab";
import { profileIsComplete, requireUser, roleIsAdmin } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your account — Courtside",
};

// Booking status changes underneath the user — the PayHere webhook confirms a
// booking without the browser being involved — so this must never be cached.
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  user: "user",
  admin: "admin",
  super_admin: "super admin",
};

/** `?page=` is user input: anything that is not a positive integer is page 1. */
function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; tab?: string; page?: string }>;
}) {
  // Server-side gate. Nothing below renders for a signed-out visitor.
  const user = await requireUser("/account");
  const { denied, tab, page } = await searchParams;

  const isAdmin = roleIsAdmin(user.role);
  const incomplete = !profileIsComplete(user);

  // Counted here rather than in the list: the tab badge needs the number too,
  // and one count beats two.
  const bookingCount = await countAccountBookings(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">Your account</h1>
          <p className="text-muted-foreground">Signed in as {user.email}.</p>
        </div>

        {isAdmin && (
          <LinkButton href="/admin" size="lg" className="h-10">
            <ShieldCheck />
            Open admin panel
          </LinkButton>
        )}
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
            Add your phone number and address under <strong>Details</strong> so
            we can reach you about a booking.
          </span>
        </p>
      )}

      {/* Both panels are rendered here, in this one request, and handed to the
          tab bar as props. Switching tabs is then local state — it does not go
          back to the server (see components/account-tabs.tsx). */}
      <div className="mt-10">
        <AccountTabs
          initialTab={parseAccountTab(tab)}
          bookingCount={bookingCount}
          details={<DetailsPanel user={user} isAdmin={isAdmin} />}
          bookings={
            <BookingsPanel
              userId={user.id}
              total={bookingCount}
              page={parsePage(page)}
            />
          }
        />
      </div>
    </div>
  );
}

function BookingsPanel({
  userId,
  total,
  page,
}: {
  userId: string;
  total: number;
  page: number;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl leading-none">My bookings</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Your reservations, most recent first. Open one to see the hours it
          covers or to pay for a slot that is still on hold. A booking you have
          paid for can only be changed by the sports office.
        </p>
      </div>

      {/* Scoped to this user inside the component, from the id `requireUser`
          returned — never from anything in the request. */}
      <AccountBookings userId={userId} total={total} page={page} />
    </section>
  );
}

function DetailsPanel({
  user,
  isAdmin,
}: {
  user: CurrentUser;
  isAdmin: boolean;
}) {
  return (
    <section className="flex flex-col gap-8">
      <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
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

      <div className="flex flex-col gap-5">
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
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-8">
        <LinkButton href="/courts" variant="outline" size="lg" className="h-10">
          Browse courts
        </LinkButton>
        <LogoutButton className="h-10" />
      </div>

      {!isAdmin && (
        <p className="max-w-prose text-sm text-muted-foreground">
          Your role is <span className="font-medium text-foreground">user</span>
          . Visiting{" "}
          <Link href="/admin" className="underline underline-offset-4">
            /admin
          </Link>{" "}
          directly will be refused by the server, not just hidden here.
        </p>
      )}
    </section>
  );
}
