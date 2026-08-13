import Link from "next/link";

import { Crest } from "@/components/brand/crest";
import { LinkButton } from "@/components/link-button";
import { BRAND } from "@/lib/brand";
import { CONTACT_DETAILS, CONTACT_PHONE_HREF } from "@/lib/contact-details";

const LINK_COLUMNS = [
  {
    heading: "Explore",
    links: [
      { href: "/courts", label: "Browse courts" },
      { href: "/book", label: "Check availability" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/account", label: "Your bookings" },
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create an account" },
    ],
  },
];

/**
 * Signature component 4 — the footer.
 *
 * Deep forest-green ground, a green/white/gold rule across the top, the crest
 * and school name, the motto set in gold italic, a pair of actions, link
 * columns and a quiet copyright line.
 *
 * Two pieces of restraint hold this together. Gold appears only three times —
 * the column labels, the motto, and the single primary button — because the
 * brand skill is explicit that gold flooded across a surface stops reading as
 * institutional. And the top rule is a *split* hairline rather than a solid
 * gold bar: green carries most of the width, white breaks it, gold closes it.
 */
export function SiteFooter() {
  return (
    // No top margin of its own: the footer is a solid coloured band, and the
    // gap above it belongs to the page. `main` in the site layouts supplies it,
    // and drops it when the page already ends in a CTA band — two deep-green
    // blocks separated by a strip of white would read as a mistake.
    <footer className="bg-footer text-footer-foreground">
      {/* The school rule: one thin horizontal line split green / white / gold
          in three EQUAL thirds. Filled flex segments rather than three borders,
          each `flex-1`, so the thirds stay exactly even at every width and
          always add up to the full span. */}
      <div className="flex h-1 w-full" aria-hidden="true">
        <div className="flex-1 bg-footer-rule" />
        <div className="flex-1 bg-footer-foreground" />
        <div className="flex-1 bg-gold" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
          {/* Identity */}
          <div className="flex max-w-sm flex-col items-start gap-5">
            <div className="flex items-center gap-3">
              <Crest size={52} />
              <span className="flex min-w-0 flex-col">
                <span className="font-heading text-lg leading-tight font-semibold">
                  {BRAND.name}
                </span>
                <span className="mt-1 text-[0.7rem] font-medium tracking-[0.16em] text-footer-muted uppercase">
                  {BRAND.location} &middot; Est. {BRAND.established}
                </span>
              </span>
            </div>

            <p className="text-sm leading-relaxed">{BRAND.tagline}.</p>

            {/* The motto — the one line on the page that is allowed to be
                decorative. Serif, italic, gold. */}
            <p className="font-heading text-base text-gold italic">
              {BRAND.motto}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <LinkButton
                href="/courts"
                variant="gold"
                size="lg"
                className="px-5"
              >
                Book a court
              </LinkButton>
              {/* White-outlined secondary. The stock `outline` variant paints
                  itself with page-surface tokens (a white slab here); `on-band`
                  reads band tokens, which this footer no longer uses — so the
                  border and text are pinned to the footer's own foreground,
                  which is correct in both themes. */}
              <LinkButton
                href="/contact"
                variant="on-band"
                size="lg"
                className="border-footer-foreground/55 px-5 text-footer-foreground hover:bg-footer-foreground/10 focus-visible:ring-footer-foreground/40"
              >
                Contact us
              </LinkButton>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid gap-10 sm:grid-cols-3">
            {LINK_COLUMNS.map((column) => (
              <div key={column.heading} className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                  {column.heading}
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm transition-colors hover:text-gold"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
                Connect
              </h2>
              <address className="text-sm leading-relaxed not-italic">
                {CONTACT_DETAILS.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <a
                href={CONTACT_PHONE_HREF}
                className="text-sm transition-colors hover:text-gold"
              >
                {CONTACT_DETAILS.phone}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-footer-border pt-6 text-xs text-footer-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          {/* City and country, read off the address rather than written out
              again — the rebrand surface is `lib/contact-details.ts`. */}
          <p>{CONTACT_DETAILS.addressLines.slice(-2).join(", ")}</p>
        </div>
      </div>
    </footer>
  );
}
