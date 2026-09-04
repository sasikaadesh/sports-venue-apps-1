import "server-only";

import { Resend } from "resend";

import { BRAND } from "@/lib/brand";

/**
 * Resend client and mail configuration.
 *
 * `server-only` is the hard guarantee that `RESEND_API_KEY` can never be
 * bundled into client code — importing this from a client component is a build
 * error, not a runtime surprise.
 *
 * Everything here is resolved lazily and returns `null` when unconfigured
 * rather than throwing at import time: a developer without a Resend key should
 * still be able to run the app, and the contact form must keep working (and
 * keep saving to the database) whether or not mail is set up.
 */

let client: Resend | null = null;

/** `null` when `RESEND_API_KEY` is unset — callers treat that as "mail off". */
export function resendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  client ??= new Resend(apiKey);
  return client;
}

/**
 * The From address used by *every* email this app sends — contact-form
 * notifications and booking confirmations alike. One variable per customer:
 * point `EMAIL_FROM` at an address on that customer's Resend-verified domain
 * and nothing else needs touching.
 *
 * Accepts either a bare address (`noreply@example.com`) or a full mailbox
 * (`Name <noreply@example.com>`); a bare address is wrapped in the brand's
 * short name so recipients see a sender, not a string.
 *
 * `CONTACT_FROM_EMAIL` is the old name of this variable and is still read so
 * an existing deployment keeps working; prefer `EMAIL_FROM` in new setups.
 *
 * The final fallback is Resend's shared test sender, which needs no DNS but
 * only delivers to the address that owns the Resend account — fine for local
 * dev, never correct in production.
 */
export function fromAddress(): string {
  const configured =
    process.env.EMAIL_FROM?.trim() || process.env.CONTACT_FROM_EMAIL?.trim();

  if (!configured) return `${BRAND.shortName} <onboarding@resend.dev>`;

  return configured.includes("<")
    ? configured
    : `${BRAND.shortName} <${configured}>`;
}

/** Where contact enquiries are delivered. `null` when unset. */
export function adminContactEmail(): string | null {
  return process.env.ADMIN_CONTACT_EMAIL?.trim() || null;
}
