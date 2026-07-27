"use server";

import { prisma } from "@/lib/prisma";
import { sendContactEmails } from "@/lib/email/contact";
import {
  actionError,
  contactMessageSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validations";

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
