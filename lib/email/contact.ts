import "server-only";

import {
  ContactAdminEmail,
  ContactConfirmationEmail,
  type ContactEmailProps,
} from "@/lib/email/templates";
import { adminContactEmail, fromAddress, resendClient } from "@/lib/email/client";

/**
 * Contact-form notifications: one to the venue, one back to the sender.
 *
 * **This never throws and never returns a failure the caller must handle.**
 * The database row is the record of the enquiry; email is a convenience on top
 * of it. A Resend outage, a missing API key or a bounced address must not cost
 * the visitor their message or show them an error for something that in fact
 * succeeded — the admin panel is still the inbox (docs/ARCHITECTURE.md →
 * Contact Us). Every failure is logged server-side and swallowed.
 *
 * The two sends are sequential rather than concurrent: Resend's free tier
 * allows 2 requests per second, and firing both at once sits exactly on that
 * limit. The admin notification goes first, so if only one gets through it is
 * the one that carries information nobody else has.
 */
export async function sendContactEmails(props: ContactEmailProps): Promise<void> {
  const resend = resendClient();

  if (!resend) {
    console.warn(
      "[contact] RESEND_API_KEY is not set — message saved, no email sent."
    );
    return;
  }

  const from = fromAddress();
  const admin = adminContactEmail();

  if (admin) {
    await send("admin notification", () =>
      resend.emails.send({
        from,
        to: admin,
        // Reply goes straight back to the person who wrote in, so answering an
        // enquiry is one keystroke rather than a copy-paste out of the panel.
        replyTo: props.email,
        subject: `New contact message from ${props.name}`,
        react: ContactAdminEmail(props),
        text: adminText(props),
      })
    );
  } else {
    console.warn(
      "[contact] ADMIN_CONTACT_EMAIL is not set — no admin notification sent."
    );
  }

  await send("sender confirmation", () =>
    resend.emails.send({
      from,
      to: props.email,
      subject: "We received your message",
      react: ContactConfirmationEmail(props),
      text: confirmationText(props),
    })
  );
}

/**
 * Run one send, logging both ways it can fail: a thrown error (network, bad
 * key) and Resend's returned `error` object (rejected address, quota), which
 * does *not* throw and would otherwise pass for success.
 */
async function send(
  what: string,
  run: () => Promise<{ error: unknown | null }>
): Promise<void> {
  try {
    const { error } = await run();
    if (error) console.error(`[contact] ${what} rejected by Resend:`, error);
  } catch (error) {
    console.error(`[contact] ${what} failed to send:`, error);
  }
}

// Plain-text alternatives. Every HTML email should carry one — text-only
// clients render it, and its presence lowers the spam score of the message.

function adminText({ name, email, message }: ContactEmailProps): string {
  return [
    "New contact message",
    "",
    `From:  ${name}`,
    `Email: ${email}`,
    "",
    "Message:",
    message,
    "",
    `Reply to this email to answer ${name}.`,
  ].join("\n");
}

function confirmationText({ name, message }: ContactEmailProps): string {
  return [
    `Hi ${name},`,
    "",
    "Thanks for getting in touch. Someone from the sports office will get back to you shortly.",
    "",
    "What you sent:",
    message,
    "",
    "This is an automated confirmation — no reply is needed.",
  ].join("\n");
}
