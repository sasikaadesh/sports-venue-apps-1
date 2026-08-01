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

import { CONTACT_DETAILS } from "@/lib/contact-details";

/**
 * Contact-form emails, as React Email components.
 *
 * Email clients strip <style> blocks and understand roughly 2005-era CSS, so
 * everything is inline style objects and a single-column table layout — no
 * Tailwind classes and no design tokens here. The palette is the project's
 * (ink `#0A0A0A`, electric green `#16DB65`) written out literally, because a
 * CSS custom property has nothing to resolve against in an inbox.
 *
 * There is no dark-mode variant on purpose: clients that force dark simply
 * invert these, and hand-rolled `prefers-color-scheme` blocks are unreliable
 * across Outlook/Gmail. Plain ink-on-white survives both.
 */

const INK = "#0A0A0A";
const MUTED = "#71717A";
const ACCENT = "#16DB65";
const BORDER = "#E4E4E7";

const body = {
  backgroundColor: "#F4F4F5",
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

const accentBar = {
  backgroundColor: ACCENT,
  borderRadius: "999px",
  height: "4px",
  margin: "0 0 24px",
  width: "48px",
};

const heading = {
  color: INK,
  fontSize: "22px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: "28px",
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
  backgroundColor: "#F4F4F5",
  borderLeft: `3px solid ${ACCENT}`,
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

const footer = { color: MUTED, fontSize: "13px", lineHeight: "20px", margin: 0 };

const link = { color: INK, textDecoration: "underline" };

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
          <Section style={accentBar} />
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
            Reply directly to this email to answer {name}. The message is also in
            the admin panel under Messages.
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
    ["Time", `${timeRange} (${durationHours} ${durationHours === 1 ? "hour" : "hours"})`],
    ["Players", String(playerCount)],
    ["Paid", total],
  ];

  return (
    <Html lang="en">
      <Head />
      <Preview>{`Your ${courtName} booking is confirmed`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={accentBar} />
          <Heading style={heading}>Your booking is confirmed</Heading>

          <Text style={paragraph}>
            Hi {name}, your payment went through and the court is yours. Here are
            the details.
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
          <Section style={accentBar} />
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
