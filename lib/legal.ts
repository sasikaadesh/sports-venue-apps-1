/**
 * Shared facts for the Privacy Policy (`/privacy`) and Terms of Service
 * (`/terms`).
 *
 * These are the school's own policies, written in plain language to describe
 * what this app actually does. They are NOT legal advice and make no legal
 * guarantee — the school should have them reviewed before relying on them.
 *
 * When either page changes in a way a reader would care about, bump
 * `LEGAL_LAST_UPDATED` in the same commit. It is the single date both pages
 * display, so the two can never disagree.
 */
import { CONTACT_DETAILS, CONTACT_PHONE_HREF } from "@/lib/contact-details";

/** ISO date the policies were last revised. Bump on every substantive edit. */
export const LEGAL_LAST_UPDATED = "2026-09-05";

/** "5 September 2026" — fixed locale, so server and client render alike. */
export const LEGAL_LAST_UPDATED_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`));

/**
 * Where policy questions go. The sports office is the contactable party for
 * both pages — the same address the Contact page shows, so there is one inbox
 * to keep monitored rather than two.
 */
export const LEGAL_CONTACT = {
  email: CONTACT_DETAILS.email,
  phone: CONTACT_DETAILS.phone,
  phoneHref: CONTACT_PHONE_HREF,
} as const;
