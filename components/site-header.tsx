import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/brand/crest";
import { LinkButton } from "@/components/link-button";
import { LinkPending } from "@/components/link-pending";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser, roleIsAdmin } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b bg-background">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-7">
          {/* The crest replaces the old lightning-bolt mark entirely — it is
              the school's identity, not a decorative glyph, so it is never
              recoloured or boxed on a coloured plate. */}
          <Wordmark priority />

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
                  <LinkPending />
                </LinkButton>
              )}
              <LinkButton href="/account" size="lg" className="h-9">
                Your account
                {/* /account and /courts are dynamic pages behind a session
                    check, so there is no cached payload to swap in on click —
                    acknowledge the press while the server renders. */}
                <LinkPending />
              </LinkButton>

              {/* Still a plain server action on a form, so it works before
                  (and without) hydration; the button only adds a pending
                  state. The label drops on narrow screens, the icon stays. */}
              <LogoutButton
                compact
                className="h-9 text-muted-foreground hover:text-foreground"
              />
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
