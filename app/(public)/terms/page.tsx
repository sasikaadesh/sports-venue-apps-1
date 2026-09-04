import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import {
  BOOKING_WINDOW_DAYS,
  HOLD_MINUTES,
  PAYMENT_HOLD_MINUTES,
} from "@/lib/booking-service";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for booking and paying for a court at ${BRAND.name} online.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Your account",
    points: [
      "You need an account to book. Please give accurate details.",
      "Keep your password to yourself; bookings from your account are treated as yours.",
      "Book for yourself or your group. Do not book slots to resell them.",
    ],
  },
  {
    heading: "Bookings",
    points: [
      `Courts can be booked up to ${BOOKING_WINDOW_DAYS} days ahead, in the slots shown on each court page.`,
      "Availability is live, but a slot is only yours once the booking is confirmed.",
      "The price shown when you pick your slots is the price you pay, in Sri Lankan rupees.",
    ],
  },
  {
    heading: "Holds and payment",
    points: [
      `Selecting slots puts a hold on them for ${HOLD_MINUTES} minutes. A hold is not a booking.`,
      `Opening the payment window extends the hold to ${PAYMENT_HOLD_MINUTES} minutes.`,
      "Unpaid holds expire automatically and the hours go back on sale.",
      "A booking is confirmed only after PayHere confirms the payment to our server.",
      "The page you land on after paying is a status page, not a confirmation — check your account and your email.",
    ],
  },
  {
    heading: "Cancellations and refunds",
    points: [
      "Cancel an unpaid hold yourself, from your account, at no cost.",
      "A paid booking cannot be cancelled from the site — contact the sports office.",
      "Refunds are decided and processed by the sports office, not automatically by this site.",
      "Not turning up does not, by itself, mean a refund.",
      "If we close a court you have paid for, we will rebook you or arrange a refund.",
    ],
  },
  {
    heading: "Using the courts",
    points: [
      "Follow the school's rules and the instructions of the sports office and ground staff.",
      "Arrive and finish on time — another group may be waiting.",
      "Use the right footwear for the surface and leave the court as you found it.",
      "No alcohol, smoking, illegal substances or abusive behaviour on the grounds.",
      "You are responsible for damage caused by your group, and for your own belongings.",
      "Play at your own risk.",
    ],
  },
  {
    heading: "Using this site",
    points: [
      "Do not use someone else's account or give false details.",
      "Do not hold slots in bulk to keep others out.",
      "Do not try to reach other people's bookings or the admin area.",
      "We may suspend an account and cancel its bookings if these terms are broken.",
      "The site may be offline for maintenance — book through the sports office if so.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of service"
      intro="How holds work, when a booking is confirmed, how refunds are handled, and what we ask of you on the grounds."
      sections={SECTIONS}
      footnote={
        <>
          See also our{" "}
          <Link
            href="/privacy"
            className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
          >
            privacy policy
          </Link>
          .
        </>
      }
    />
  );
}
