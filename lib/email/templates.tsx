import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { BRAND } from "@/lib/brand";
import { CONTACT_DETAILS } from "@/lib/contact-details";

/**
 * Contact-form emails, as React Email components.
 *
 * Email clients strip <style> blocks and understand roughly 2005-era CSS, so
 * everything is inline style objects and a single-column table layout — no
 * Tailwind classes and no design tokens here. The brand palette is written out
 * literally below, because a CSS custom property has nothing to resolve against
 * in an inbox. This block is the ONE place in the app outside
 * `app/globals.css` that legitimately holds colour values; it mirrors the
 * palette there, so a rebrand touches both and nothing else.
 *
 * The gold is used only for the rule under the masthead — the same restraint
 * as on the site, where gold is a hairline and a button and nothing more.
 *
 * There is no dark-mode variant on purpose: clients that force dark simply
 * invert these, and hand-rolled `prefers-color-scheme` blocks are unreliable
 * across Outlook/Gmail. Plain ink-on-white survives both.
 */

/** Mirrors the `--p-*` palette in app/globals.css. */
const INK = "#14231A";
const MUTED = "#5B6B62";
const GREEN = "#088020";
const GREEN_DEEPEST = "#163A24";
const GOLD = "#E0AB2E";
const BORDER = "#D9E7DF";
const MINT = "#EAF5EF";

const body = {
  backgroundColor: MINT,
  margin: 0,
  padding: "24px 0",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container = {
  backgroundColor: "#FFFFFF",
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

/** School name above the gold rule — the masthead, as on printed letterhead. */
const masthead = {
  color: GREEN_DEEPEST,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "15px",
  fontWeight: 700,
  letterSpacing: "0.02em",
  margin: "0 0 10px",
};

const mottoLine = {
  color: MUTED,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "12px",
  fontStyle: "italic" as const,
  margin: "0 0 12px",
};

/** The gold hairline. The only gold in the message. */
const goldRule = {
  backgroundColor: GOLD,
  height: "3px",
  margin: "0 0 24px",
  width: "56px",
};

const heading = {
  color: INK,
  // Georgia is the closest thing to the site's Lora that an inbox reliably
  // has — a webfont in email is a coin flip, so this falls back gracefully
  // while still reading as a serif for the great majority of recipients.
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "30px",
  margin: "0 0 16px",
};

const paragraph = {
  color: INK,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const label = {
  color: MUTED,
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  margin: "0 0 4px",
  textTransform: "uppercase" as const,
};

const value = {
  color: INK,
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0 0 16px",
};

/** `pre-wrap` so the sender's own line breaks survive into the inbox. */
const quotedMessage = {
  backgroundColor: MINT,
  borderLeft: `3px solid ${GREEN}`,
  borderRadius: "6px",
  color: INK,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 8px",
  padding: "12px 16px",
  whiteSpace: "pre-wrap" as const,
};

const detailTable = {
  border: `1px solid ${BORDER}`,
  borderRadius: "8px",
  margin: "0 0 20px",
  padding: "4px 16px",
};

const detailRow = { borderBottom: `1px solid ${BORDER}` };

const detailKey = {
  color: MUTED,
  fontSize: "13px",
  padding: "10px 12px 10px 0",
  width: "35%",
};

const detailValue = {
  color: INK,
  fontSize: "15px",
  fontWeight: 600,
  padding: "10px 0",
};

const rule = { borderColor: BORDER, margin: "24px 0" };

const footer = {
  color: MUTED,
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
};

const link = { color: GREEN, textDecoration: "underline" };

/**
 * Letterhead: school name, motto, gold rule. Opens every message so an email
 * from the booking system is recognisably from the school, the same way the
 * footer signs off the website.
 */
function Masthead() {
  return (
    <>
      <Text style={masthead}>{BRAND.name}</Text>
      <Text style={mottoLine}>{BRAND.motto}</Text>
      <Section style={goldRule} />
    </>
  );
}

export type ContactEmailProps = {
  name: string;
  email: string;
  message: string;
};

/** Sent to ADMIN_CONTACT_EMAIL. Reply-To is set to the sender on dispatch. */
export function ContactAdminEmail({ name, email, message }: ContactEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${name} sent a message via the contact form`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Masthead />
          <Heading style={heading}>New contact message</Heading>

          <Text style={label}>From</Text>
          <Text style={value}>{name}</Text>

          <Text style={label}>Email</Text>
          <Text style={value}>
            <Link href={`mailto:${email}`} style={link}>
              {email}
            </Link>
          </Text>

          <Text style={label}>Message</Text>
          <Text style={quotedMessage}>{message}</Text>

          <Hr style={rule} />
          <Text style={footer}>
            Reply directly to this email to answer {name}. The message is also
            in the admin panel under Messages.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export type BookingConfirmationEmailProps = {
  name: string;
  courtName: string;
  date: string;
  timeRange: string;
  durationHours: number;
  playerCount: number;
  total: string;
  /** Absolute URL — an email has no origin to resolve a relative path against. */
  bookingUrl: string;
};

/**
 * Sent once, when a verified PayHere notification confirms the booking.
 *
 * The detail rows are a two-column table rather than flex: Outlook renders
 * neither flexbox nor grid, and this is the layout that survives it.
 */
export function BookingConfirmationEmail({
  name,
  courtName,
  date,
  timeRange,
  durationHours,
  playerCount,
  total,
  bookingUrl,
}: BookingConfirmationEmailProps) {
  const rows: [string, string][] = [
    ["Court", courtName],
    ["Date", date],
    [
      "Time",
      `${timeRange} (${durationHours} ${durationHours === 1 ? "hour" : "hours"})`,
    ],
    ["Players", String(playerCount)],
    ["Paid", total],
  ];

  return (
    <Html lang="en">
      <Head />
      <Preview>{`Your ${courtName} booking is confirmed`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Masthead />
          <Heading style={heading}>Your booking is confirmed</Heading>

          <Text style={paragraph}>
            Hi {name}, your payment went through and the court is yours. Here
            are the details.
          </Text>

          <Section style={detailTable}>
            {rows.map(([key, value]) => (
              <Row key={key} style={detailRow}>
                <Column style={detailKey}>{key}</Column>
                <Column style={detailValue}>{value}</Column>
              </Row>
            ))}
          </Section>

          <Text style={paragraph}>
            <Link href={bookingUrl} style={link}>
              View your booking
            </Link>
          </Text>

          <Hr style={rule} />
          <Text style={footer}>
            Please arrive a few minutes early. To change or cancel a paid
            booking, contact the sports office.
          </Text>
          <Text style={{ ...footer, marginTop: "12px" }}>
            {CONTACT_DETAILS.organisation}
            <br />
            {CONTACT_DETAILS.addressLines.join(", ")}
            <br />
            {CONTACT_DETAILS.phone}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Sent to the address the visitor typed into the form. */
export function ContactConfirmationEmail({ name, message }: ContactEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>We received your message</Preview>
      <Body style={body}>
        <Container style={container}>
          <Masthead />
          <Heading style={heading}>Thanks — we have your message</Heading>

          <Text style={paragraph}>
            Hi {name}, thanks for getting in touch with{" "}
            {CONTACT_DETAILS.organisation}. Someone from the sports office will
            get back to you shortly.
          </Text>

          <Text style={label}>What you sent</Text>
          <Text style={quotedMessage}>{message}</Text>

          <Hr style={rule} />
          <Text style={footer}>
            {CONTACT_DETAILS.organisation}
            <br />
            {CONTACT_DETAILS.addressLines.join(", ")}
            <br />
            {CONTACT_DETAILS.phone}
          </Text>
          <Text style={{ ...footer, marginTop: "12px" }}>
            This is an automated confirmation — no reply is needed.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
