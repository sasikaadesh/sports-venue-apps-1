"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { sendContactEmails } from "@/lib/email/contact";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  actionError,
  contactMessageSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validations";

/** Five submissions per address every ten minutes — a genuine visitor never
 * needs more; a script hammering the form hits this fast. */
const CONTACT_RATE_LIMIT = 5;
const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  // May carry a comma-separated chain behind a proxy — the first entry is the
  // original client. Spoofable, which is fine: this is a cheap flood brake,
  // not an identity check (see lib/rate-limit.ts).
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Store a "Contact us" submission.
 *
 * Deliberately unauthenticated — a visitor who has not signed up is exactly
 * the person most likely to be asking a question. That makes it the one
 * public write path in the app, so it is kept as narrow as possible:
 *
 * - Only the three validated fields are written. `readAt` is not settable from
 *   here, and there is no id, so a submission can only ever create a new row.
 * - Lengths are bounded by the Zod schema before anything reaches the database.
 * - A hidden honeypot field catches the naive bots; anything that fills it gets
 *   the same success response it would have got anyway, and nothing is stored.
 * - A per-IP rate limit catches a script that skips the honeypot but still
 *   submits too fast for a person typing (see lib/rate-limit.ts, and
 *   docs/ARCHITECTURE.md → Contact form spam protection for the upgrade path).
 *
 * After the row is written it notifies the venue and confirms to the sender by
 * email (Resend). That step is best-effort and cannot fail the submission: the
 * database row is the record of the enquiry, the admin panel is still the
 * inbox, and a mail outage must not lose someone's message or tell them it did
 * not arrive when it did.
 */
export async function submitContactMessage(
  input: unknown
): Promise<ActionResult> {
  const raw = (input ?? {}) as Record<string, unknown>;

  // Honeypot: a real person never sees this field, so a value means a bot.
  // Answering "ok" rather than an error denies it the signal it needs to retry.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    return { ok: true };
  }

  // Repeated rapid submissions from the same address — a real visitor sends
  // one message and waits for a reply, not five in a minute. Unlike the
  // honeypot this is a genuine rejection: it is not spam-shaped, just too
  // fast, so it gets an explanation rather than a fake success.
  if (
    !checkRateLimit(
      await clientIp(),
      CONTACT_RATE_LIMIT,
      CONTACT_RATE_WINDOW_MS
    )
  ) {
    return actionError(
      "Too many messages sent from this connection. Please wait a few minutes and try again."
    );
  }

  const parsed = contactMessageSchema.safeParse({
    name: raw.name,
    email: raw.email,
    message: raw.message,
  });

  if (!parsed.success) return actionError(firstIssue(parsed.error));

  await prisma.contactMessage.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    },
  });

  // Best-effort, and awaited rather than fired and forgotten: a serverless
  // function can be frozen the moment it responds, so a floating promise here
  // would be killed mid-flight. `sendContactEmails` swallows and logs its own
  // failures, so this cannot turn a saved message into an error for the user.
  await sendContactEmails(parsed.data);

  return { ok: true };
}
