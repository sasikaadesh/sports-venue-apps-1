import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="size-4" />
            </span>
            Courtside
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.role === "admin" && (
                  <LinkButton
                    href="/admin"
                    variant="ghost"
                    size="lg"
                    className="h-9"
                  >
                    <ShieldCheck />
                    Admin
                  </LinkButton>
                )}
                <LinkButton href="/account" size="lg" className="h-9">
                  Your account
                </LinkButton>
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

      {/* Low, simple hero — the booking dropdown lands here in Phase 7. */}
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <h1 className="max-w-lg text-5xl leading-[1.02] sm:text-6xl">
              Your court.
              <br />
              Your slot.
              <br />
              <span className="text-primary">Sorted.</span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              Cricket nets, tennis, table tennis and more. See what&apos;s free,
              grab the slot, and pay online — no phone calls, no clipboard.
            </p>
            <LinkButton
              href={user ? "/account" : "/signup"}
              size="lg"
              className="h-11 px-5"
            >
              {user ? "Go to your account" : "Get started"}
              <ArrowRight />
            </LinkButton>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
            <Image
              src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1400&q=80"
              alt="Tennis player resting on a blue hard court surrounded by balls"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 text-xs text-muted-foreground sm:px-8">
          &copy; {new Date().getFullYear()} Courtside — school sports facilities.
        </div>
      </footer>
    </>
  );
}
