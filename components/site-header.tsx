import Link from "next/link";
import { LogOut, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(auth)/actions";
import { getCurrentUser, roleIsAdmin } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="size-4" />
            </span>
            Courtside
          </Link>

          <Link
            href="/courts"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Courts
          </Link>

          <Link
            href="/contact"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Contact
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="mr-1" />
          {user ? (
            <>
              {roleIsAdmin(user.role) && (
                <LinkButton
                  href="/admin"
                  variant="ghost"
                  size="lg"
                  className="hidden h-9 sm:inline-flex"
                >
                  <ShieldCheck />
                  Admin
                </LinkButton>
              )}
              <LinkButton href="/account" size="lg" className="h-9">
                Your account
              </LinkButton>

              {/* Signing out is a plain server action on a form, so it works
                  before (and without) hydration — and it keeps the session
                  cookie clearing on the server, where it is set. The label
                  drops on narrow screens; the icon and aria-label stay. */}
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="lg"
                  aria-label="Log out"
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  <LogOut />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </form>
            </>
          ) : (
            <>
              <LinkButton
                href="/login"
                variant="ghost"
                size="lg"
                className="h-9"
              >
                Log in
              </LinkButton>
              <LinkButton href="/signup" size="lg" className="h-9">
                Sign up
              </LinkButton>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
