import "server-only";

import {
  SpecialRequestAdminEmail,
  type SpecialRequestEmailProps,
} from "@/lib/email/templates";
import {
  adminContactEmail,
  fromAddress,
  resendClient,
} from "@/lib/email/client";

/**
 * Notify the venue of a new special request.
 *
 * **Never throws and never returns a failure the caller must handle** — same
 * contract as `sendContactEmails`. The `SpecialRequest` row is the record and
 * the admin panel is the inbox; email is only a nudge on top. Every failure is
 * logged server-side and swallowed.
 */
export async function sendSpecialRequestAdminEmail(
  props: SpecialRequestEmailProps
): Promise<void> {
  const resend = resendClient();
  if (!resend) {
    console.warn(
      "[special-request] RESEND_API_KEY is not set — request saved, no email sent."
    );
    return;
  }

  const admin = adminContactEmail();
  if (!admin) {
    console.warn(
      "[special-request] ADMIN_CONTACT_EMAIL is not set — no admin notification sent."
    );
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: admin,
      // Answering the request is one keystroke, straight back to the member.
      replyTo: props.email,
      subject: `Special request: ${props.courtName} — ${props.name ?? props.email}`,
      react: SpecialRequestAdminEmail(props),
      text: adminText(props),
    });
    if (error) {
      console.error(
        "[special-request] admin notification rejected by Resend:",
        error
      );
    }
  } catch (error) {
    console.error(
      "[special-request] admin notification failed to send:",
      error
    );
  }
}

/** Plain-text alternative — text-only clients render it, and it lowers spam score. */
function adminText(p: SpecialRequestEmailProps): string {
  return [
    "New special request",
    "",
    `From:    ${p.name ?? p.email}`,
    `Email:   ${p.email}`,
    ...(p.phone ? [`Phone:   ${p.phone}`] : []),
    `Court:   ${p.courtName}`,
    `When:    ${p.date} at ${p.time}`,
    `Players: ${p.playerCount}`,
    "",
    "Reason:",
    p.message,
    "",
    "Nothing has been booked. Reply to this email to contact them, and update the status in the admin panel under Special requests.",
  ].join("\n");
}
