import Image from "next/image";
import Link from "next/link";
import { Zap } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
      {/* Form column — left-aligned, generous breathing room. */}
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        {/* The auth pages sit outside the site header, so they carry their own
            theme control — otherwise login/signup would be the one place a
            visitor cannot switch. */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 font-heading text-lg font-bold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="size-4" />
            </span>
            Courtside
          </Link>

          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Courtside — school sports facilities.
        </p>
      </div>

      {/* Image column — energetic sports photography, hidden on small screens. */}
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <Image
          src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1600&q=80"
          alt="Overhead view of a tennis player serving on a clay court"
          fill
          sizes="(min-width: 1024px) 55vw, 0px"
          className="object-cover"
          priority
        />
        {/* Scrim and copy are FIXED dark-on-photo in both themes, not tokenised.
            `bg-foreground/45` + `text-background` would invert here — in dark
            mode the scrim turns white and washes the photograph out. Text over
            an image is always light over a dark veil. */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <h2 className="max-w-md text-4xl leading-[1.05] text-white">
            Book the court.
            <br />
            Play the game.
          </h2>
          <p className="mt-4 max-w-sm text-white/80">
            Check live availability across every court, reserve your slot, and
            pay in seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
