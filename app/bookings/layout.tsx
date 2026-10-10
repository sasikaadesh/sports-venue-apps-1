import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/crest";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(auth)/actions";
import { securityLogoutAction } from "@/app/(auth)/security-login/actions";
import { requireBookingsAccess } from "@/lib/security-staff/auth";

export const metadata = { title: "Bookings" };

/**
 * A standalone shell for `/bookings` — deliberately NOT nested under
 * `app/admin/layout.tsx`. A security login must never be able to reach any
 * other admin page, and the surest way to guarantee that is for this route to
 * share no layout, no nav and no code path with `/admin/*` at all: there is
 * no link here to follow.
 *
 * This call to `requireBookingsAccess()` builds the header (it needs to know
 * who is signed in), but it is NOT the boundary — exactly like
 * `app/admin/layout.tsx`'s `requireAdmin()`. `app/bookings/page.tsx` calls it
 * again itself, which is the check that actually decides whether the page's
 * data is sent.
 */
export default async function BookingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireBookingsAccess();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark size={32} />
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              <ShieldCheck className="size-3" />
              {viewer.kind === "security"
                ? "Security"
                : viewer.role === "super_admin"
                  ? "Super admin"
                  : "Admin"}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <span
              className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block"
              title={
                viewer.kind === "security" ? viewer.username : viewer.email
              }
            >
              {viewer.kind === "security" ? viewer.username : viewer.email}
            </span>

            <ThemeToggle />

            {viewer.kind === "security" ? (
              <form action={securityLogoutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                >
                  <LogOut />
                  Log out
                </Button>
              </form>
            ) : (
              <>
                {/* An admin/super admin landed here from their own panel —
                    give them the way back, since this shell carries no nav. */}
                <Link
                  href="/admin"
                  className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  Admin panel
                </Link>
                <form action={signOut}>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                  >
                    <LogOut />
                    Log out
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
