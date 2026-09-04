import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${BRAND.name} collects when you book a court online, how it is used, and how it is kept.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    points: [
      "Your name, email address and phone number.",
      "Your postal address.",
      "Your affiliation: old boy, parent, staff or member of the public.",
      "Your bookings: the court, the date and the hours.",
      "Payment details: the amount and the reference PayHere gives us — never your card number.",
    ],
  },
  {
    heading: "How we use it",
    points: [
      "To hold, confirm and manage your court bookings.",
      "To process your payment.",
      "To email you booking confirmations and account emails such as password resets.",
      "So the sports office can contact you about a booking.",
      "We do not send you marketing you did not ask for.",
    ],
  },
  {
    heading: "Payments",
    points: [
      <>
        Payments are handled by{" "}
        <a
          href="https://www.payhere.lk/"
          target="_blank"
          rel="noopener noreferrer"
        >
          PayHere
        </a>
        , a Sri Lankan payment gateway.
      </>,
      "The card form belongs to PayHere — your card details never reach this site.",
      "We do not store card numbers, expiry dates or CVVs.",
    ],
  },
  {
    heading: "Storage and sharing",
    points: [
      "Your details are stored in our Supabase database and sent over an encrypted connection.",
      "You can see your own bookings; sports office staff can see the bookings they need to run the courts.",
      "We share your details only with PayHere (payments), Resend (email) and our hosting provider.",
      "We do not sell, rent or trade your data.",
      "No online service can promise perfect security, but we take care to keep this safe.",
    ],
  },
  {
    heading: "Cookies",
    points: [
      "One cookie keeps you signed in; one remembers your light or dark theme.",
      "No advertising or tracking cookies.",
    ],
  },
  {
    heading: "Your rights",
    points: [
      "Update your name, phone, address and affiliation any time from your account.",
      "Ask us to correct or delete your details — we may check who you are first.",
      "Paid bookings stay on file as financial records.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy policy"
      intro="What we collect when you book a court, why we need it, and who else sees it."
      sections={SECTIONS}
      footnote={
        <>
          See also our{" "}
          <Link
            href="/terms"
            className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
          >
            terms of service
          </Link>
          .
        </>
      }
    />
  );
}
