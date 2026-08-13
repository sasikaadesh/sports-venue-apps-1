import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * The account area sits inside the ordinary site shell.
 *
 * It used to render bare, which left it as the one signed-in page with no way
 * back to the courts and no logo — and forced it to grow its own theme control
 * and log-out button. Both now live in the site header, for every page at once.
 *
 * The page itself still gates on `requireUser()`; a layout is not an auth
 * boundary.
 */
export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {/* Matches the public shell — see the note in app/(public)/layout.tsx. */}
      <main className="flex-1 pb-24 has-data-flush-footer:pb-0">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
