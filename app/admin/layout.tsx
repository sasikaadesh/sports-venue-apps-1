import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(auth)/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Admin — Courtside",
};

/**
 * Admin shell.
 *
 * `requireAdmin()` here covers every page nested under /admin. Each page also
 * has its own check where it reads or writes data, and every admin server
 * action re-checks independently — a layout guard alone is not a boundary,
 * since server actions are separate HTTP endpoints that never render it.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin("/admin");

  // Counted here, not in AdminNav — that is a client component and cannot
  // reach the database.
  const unreadMessages = await prisma.contactMessage.count({
    where: { readAt: null },
  });

  return (
    <div className="flex min-h-svh flex-col">
      {/* Screen chrome only. Printing any admin page — the bookings report
          above all — should put the content on the sheet and nothing else. */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-heading text-base font-bold tracking-tight"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="size-3.5" />
              </span>
              Courtside
            </Link>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {admin.role === "super_admin" ? "Super admin" : "Admin"}
            </span>
          </div>

          {/* Signed-in identity + Log out, on ONE row.
              Nothing stacks under the email here: the previous stray control
              below it is gone, and the email is a link to the account page
              rather than dead text. */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/account"
              className="hidden min-w-0 truncate text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
              title={admin.email}
            >
              {admin.email}
            </Link>

            <ThemeToggle />

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
          </div>
        </div>

        <AdminNav unreadMessages={unreadMessages} />
      </header>

      {/* On paper the page box IS the margin (`@page` in globals.css), so the
          shell's own width cap and padding would only shrink the content. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 print:max-w-none print:p-0">
        {children}
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
