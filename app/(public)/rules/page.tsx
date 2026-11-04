import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Car,
  Clock,
  CloudLightning,
  HeartPulse,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Eyebrow } from "@/components/brand/eyebrow";
import { LinkButton } from "@/components/link-button";
import { BRAND } from "@/lib/brand";
import { CONTACT_DETAILS } from "@/lib/contact-details";

export const metadata: Metadata = {
  title: "Rules & regulations",
  description: `The rules for using the courts and facilities at ${BRAND.name} — parking, safety, conduct, bookings, refunds and bad weather.`,
};

const linkClass =
  "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary";

/** "Bookings: 076 567 4350 or Technical: 077 786 7766", each number a `tel:` link. */
function SportsOfficePhones() {
  return (
    <>
      {CONTACT_DETAILS.phones.map((phone, index) => (
        <span key={phone.href}>
          {index > 0 && " or "}
          {phone.label}:{" "}
          <a href={phone.href} className={linkClass}>
            {phone.display}
          </a>
        </span>
      ))}
    </>
  );
}

/**
 * The points that must not be missed, as cards at the top of the page. Kept to
 * six: past that, highlighting stops meaning anything. Each card's topic is
 * covered here only — the sections below do not repeat it.
 */
const KEY_POINTS: { icon: LucideIcon; title: string; body: React.ReactNode }[] =
  [
    {
      icon: Car,
      title: "Parking is at your own risk",
      body: "The College accepts no responsibility for vehicles parked on the premises, or for belongings left inside them.",
    },
    {
      icon: Clock,
      title: "Don't wait in the car park",
      body: "The car park is not a waiting, gathering or meeting area. Please leave it promptly once your session has ended.",
    },
    {
      icon: HeartPulse,
      title: "No medical facilities on site",
      body: (
        <>
          There is no first-aid room or permanent medical staff. In an emergency
          call{" "}
          <a href="tel:1990" className={linkClass}>
            1990
          </a>{" "}
          (Suwa Seriya Ambulance Service), then contact the Sports Office —{" "}
          <SportsOfficePhones />.
        </>
      ),
    },
    {
      icon: CloudLightning,
      title: "Session cut short by weather or power failure?",
      body: "If extreme weather or an unexpected power failure stops play, contact the Sports Office the same day. Do not rebook the session yourself.",
    },
    {
      icon: ShieldAlert,
      title: "Play at your own risk",
      body: "You take part entirely at your own risk, and are responsible for your own safety, your fitness to play and your belongings at all times.",
    },
    {
      icon: Users,
      title: "Children must be supervised",
      body: "Players under 16 must be accompanied by a responsible adult who stays on the premises for the whole session. Some facilities, such as the swimming pool, may require more.",
    },
  ];

const SECTIONS: { heading: string; points: React.ReactNode[] }[] = [
  {
    heading: "Arriving and leaving",
    points: [
      "Arrive close to your start time — the court or facility is not available before your booking begins.",
      "Sessions end on the hour. Vacate the facility promptly; the next group may be waiting.",
      "Use only the courts and facilities included in your booking. School buildings, classrooms, offices and restricted areas are out of bounds.",
      "Carry a valid NIC, Student ID, Sports ID or other acceptable identification, and present it when asked.",
      "Park only in designated parking areas — never in restricted areas, including behind the swimming pool.",
      "Parking and vehicle access may be restricted during school activities, examinations, tournaments, public events and special functions. Please observe these restrictions.",
      "Parking on the premises does not give you a reserved space or any right to park.",
    ],
  },
  {
    heading: "Security and access",
    points: [
      "All visitors and vehicles entering the premises may be subject to security checks.",
      "Cooperate with College security personnel at all times.",
      "Entry may be refused where security requirements are not met.",
    ],
  },
  {
    heading: "Facilities and amenities",
    points: [
      "Common College washrooms are available to users. Individual sports facilities may not have washrooms of their own.",
      "Help keep the premises clean. Where there are no waste bins, take your litter away with you.",
    ],
  },
  {
    heading: "On the courts and facilities",
    points: [
      <>
        Every court and facility may have its own sport-specific rules, listed
        on its page — read and follow them before you play.{" "}
        <Link href="/courts" className={linkClass}>
          Browse courts
        </Link>
      </>,
      "Wear footwear and clothing suitable for the sport and the playing surface.",
      "Report any damage, defect, hazard or unsafe condition to staff immediately.",
      "Leave courts and facilities clean, usable and in the condition you found them.",
      "Floodlights and facility equipment may only be operated by authorised staff.",
    ],
  },
  {
    heading: "Coaches and training",
    points: [
      "Personal coaches, instructors and trainers may run sessions only with prior approval from the College.",
      "Coaches must comply with all College policies and facility regulations, and must not engage in activities that conflict with the interests or policies of the College.",
      "A breach of these requirements may lead to bookings being cancelled or facility access being withdrawn.",
    ],
  },
  {
    heading: "Damage and liability",
    points: [
      "You are responsible for any damage caused during your booking to courts, equipment, buildings, grounds, furniture, lighting or any other College property.",
      "Repair or replacement costs may be charged to the individual, group, club or organisation responsible for the booking.",
    ],
  },
  {
    heading: "Safety and weather",
    points: [
      "Stop play immediately and seek shelter if there is lightning or the weather becomes unsafe.",
      "Report any injury to the Sports Office or available staff as soon as possible.",
      "Bring drinking water and take adequate breaks in hot weather.",
    ],
  },
  {
    heading: "Conduct",
    points: [
      "No alcohol, smoking, vaping, illegal drugs, toxic substances or other prohibited items anywhere on College premises.",
      "No abusive, threatening, offensive, discriminatory or inappropriate behaviour towards staff, players, students or visitors.",
      "Follow all instructions from the Sports Office, facility staff and College authorities.",
      "No pets on the premises unless specifically authorised.",
      "This is a working educational institution. Please respect the campus, its staff, students and facilities, and the neighbouring community.",
    ],
  },
  {
    heading: "Your booking",
    points: [
      "Only the person who made the booking and their authorised participants may use the session.",
      "Bookings may not be transferred, resold or assigned to anyone else.",
      "Facilities may be unavailable on public holidays and during examinations, school functions, maintenance work or special events.",
      <>
        Serious or repeated breaches of these rules may lead to cancelled
        bookings, removal from the premises, account suspension or future
        booking restrictions. See the{" "}
        <Link href="/terms" className={linkClass}>
          terms of service
        </Link>
        .
      </>,
    ],
  },
  {
    heading: "Refunds and cancellations",
    points: [
      "Refund and cancellation requests are subject to the Sports Office's policies. Contact the Sports Office directly to request a refund.",
      "Refunds, credits or rebooking for sessions interrupted by weather, facility issues or power outages are assessed by the Sports Office case by case.",
      <>
        <b>Refunds of online payments follow PayHere&apos;s refund process:</b>
        <ul className="mt-2.5 flex list-[circle] flex-col gap-2 pl-5">
          <li>
            <strong className="font-medium text-foreground">
              Instant refund
            </strong>{" "}
            — a payment refunded on the same day it was made goes back to the
            card immediately, as a payment void.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Delayed refund
            </strong>{" "}
            — a payment refunded after it has been paid out to the merchant
            (after 2 days) is processed at the end of the day, and can then take
            5–10 days or longer to show on the card.
          </li>
          <li>
            Refunds are free and always for the full amount, including the
            payment processing fee. PayHere does not support partial refunds;
            these are made manually.
          </li>
          <li>
            Visa, Mastercard, American Express, Discover and Diners Club
            payments are refunded through PayHere. Frimi, Genie, eZcash, mCash
            and Vishwa payments cannot be, and are refunded manually by bank
            transfer.
          </li>
          <li>
            A refund moves through three stages: <em>waiting funds</em> (PayHere
            is recovering the funds), <em>refund processing</em> (funds
            recovered, refund in progress) and <em>refund processed</em> (done —
            it reaches the card within 5–10 days).
          </li>
        </ul>
        <p className="mt-2.5">
          <a
            href="https://support.payhere.lk/refund-process"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Read PayHere&apos;s refund process
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </>,
    ],
  },
];

/**
 * Venue-wide rules and regulations.
 *
 * Two tiers, so the page is scannable: the six points that matter most as
 * highlighted cards (the brand's mint feature-card treatment, a green icon
 * each), then everything else as one-line bullets in the same hairline
 * heading-and-list layout as /privacy and /terms. Court-specific rules live on
 * each court's page (Court.rules) and are linked from here, not repeated.
 *
 * Every colour is a theme token, so light and dark both come from globals.css.
 * No gold: nothing here is a call to action.
 */
export default function RulesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8">
      <header className="flex max-w-3xl flex-col gap-4">
        <Eyebrow tone="green">Rules &amp; regulations</Eyebrow>
        <h1 className="text-4xl leading-[1.1] sm:text-5xl">
          Before you come to play
        </h1>
        <p className="text-lg text-muted-foreground">
          The rules for everyone using the courts and facilities at {BRAND.name}
          . Please read them before your first session — by booking, you agree
          to follow them.
        </p>
      </header>

      <section aria-labelledby="key-points" className="mt-12">
        <h2 id="key-points" className="sr-only">
          The most important points
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KEY_POINTS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-lg border border-border bg-tint-strong p-6"
            >
              <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="text-lg leading-snug">{title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-14 flex flex-col">
        {SECTIONS.map((section) => (
          <section
            key={section.heading}
            className="grid gap-x-10 gap-y-3 border-t border-border py-8 md:grid-cols-[13rem_minmax(0,1fr)]"
          >
            <h2 className="text-xl">{section.heading}</h2>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 leading-relaxed text-muted-foreground marker:text-primary">
              {section.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-5 border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          Questions about bookings, facilities or these rules? Contact the
          Sports Office — <SportsOfficePhones />, or email{" "}
          <a href={`mailto:${CONTACT_DETAILS.email}`} className={linkClass}>
            {CONTACT_DETAILS.email}
          </a>
          .
        </p>
        <div>
          <LinkButton href="/contact" size="lg" className="px-5">
            Contact the sports office
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
