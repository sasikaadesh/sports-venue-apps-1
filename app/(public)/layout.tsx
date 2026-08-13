import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Public site shell. No auth gate — visitors browse courts and check
 * availability without an account (PRD).
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {/* The breathing room above the footer lives here rather than on the
          footer itself, so a page that ends in a deep-green CTA band can opt
          out of it (`data-flush-footer`) and sit flush against the footer. */}
      <main className="flex-1 pb-24 has-data-flush-footer:pb-0">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
