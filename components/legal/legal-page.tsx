import type { ReactNode } from "react";

import { Eyebrow } from "@/components/brand/eyebrow";
import { LinkButton } from "@/components/link-button";
import { BRAND } from "@/lib/brand";
import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  LEGAL_LAST_UPDATED_LABEL,
} from "@/lib/legal";

export type LegalSection = {
  heading: string;
  /** One short line each. If a point needs a paragraph, it belongs elsewhere. */
  points: ReactNode[];
};

/**
 * The shell both policy pages sit in.
 *
 * Deliberately short: a heading column on the left and one-line bullets on the
 * right, hairline-separated. Someone checking "do they store my card number?"
 * should find the answer by scanning, not by reading — so nothing here creates
 * room for a wall of prose, and the section type only accepts a list of points.
 *
 * Shared rather than duplicated so /privacy and /terms cannot drift apart in
 * date, tone or layout — the pages supply only their words.
 */
export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  /** The cross-link to the other policy. */
  footnote: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8">
      <header className="flex flex-col gap-4">
        <Eyebrow tone="green">{eyebrow}</Eyebrow>
        <h1 className="text-4xl leading-[1.1] sm:text-5xl">{title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{intro}</p>
        <p className="text-sm text-muted-foreground">
          This is the policy of {BRAND.name}, {BRAND.location}. Last updated{" "}
          <time dateTime={LEGAL_LAST_UPDATED} className="text-foreground">
            {LEGAL_LAST_UPDATED_LABEL}
          </time>
          . We may update this page as the service changes.
        </p>
      </header>

      <div className="mt-14 flex flex-col">
        {sections.map((section) => (
          <section
            key={section.heading}
            className="grid gap-x-10 gap-y-3 border-t border-border py-8 md:grid-cols-[13rem_minmax(0,1fr)]"
          >
            <h2 className="text-xl">{section.heading}</h2>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 leading-relaxed text-muted-foreground marker:text-primary [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 [&_a]:transition-colors hover:[&_a]:decoration-primary">
              {section.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Contact, as an action rather than another bullet — it is the one thing
          we actually want a reader to do off these pages. Green primary, square
          per the brand; no gold, which this page has not earned. */}
      <div className="mt-4 flex flex-col gap-5 border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          Questions? Email{" "}
          <a
            href={`mailto:${LEGAL_CONTACT.email}`}
            className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
          >
            {LEGAL_CONTACT.email}
          </a>{" "}
          or call{" "}
          <a
            href={LEGAL_CONTACT.phoneHref}
            className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
          >
            {LEGAL_CONTACT.phone}
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <LinkButton href="/contact" size="lg" className="px-5">
            Contact the sports office
          </LinkButton>
          <p className="text-sm text-muted-foreground">{footnote}</p>
        </div>
      </div>
    </div>
  );
}
