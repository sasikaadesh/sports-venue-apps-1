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
 * The From address.
 *
 * Defaults to Resend's shared test sender, which works with no DNS setup but
 * will only deliver to the address that owns the Resend account. A verified
 * domain is required before go-live — see docs/ARCHITECTURE.md → Contact Us.
 */
export function fromAddress(): string {
  return (
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    `${BRAND.shortName} <onboarding@resend.dev>`
  );
}

/** Where contact enquiries are delivered. `null` when unset. */
export function adminContactEmail(): string | null {
  return process.env.ADMIN_CONTACT_EMAIL?.trim() || null;
}
