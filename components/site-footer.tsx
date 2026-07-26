import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:px-8">
        <span>
          &copy; {new Date().getFullYear()} Courtside — school sports
          facilities.
        </span>
        <nav className="flex items-center gap-5">
          <Link href="/courts" className="transition-colors hover:text-foreground">
            Browse courts
          </Link>
          <Link href="/contact" className="transition-colors hover:text-foreground">
            Contact us
          </Link>
        </nav>
      </div>
    </footer>
  );
}
