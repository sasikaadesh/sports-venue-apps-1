import Image from "next/image";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
      {/* Form column — left-aligned, generous breathing room. */}
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 font-heading text-lg font-bold tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-4" />
          </span>
          Courtside
        </Link>

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
        <div className="absolute inset-0 bg-foreground/45" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <h2 className="max-w-md text-4xl leading-[1.05] text-background">
            Book the court.
            <br />
            Play the game.
          </h2>
          <p className="mt-4 max-w-sm text-background/80">
            Check live availability across every court, reserve your slot, and
            pay in seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
