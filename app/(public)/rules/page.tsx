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
import { CONTACT_DETAILS, CONTACT_PHONE_HREF } from "@/lib/contact-details";

export const metadata: Metadata = {
  title: "Rules & regulations",
  description: `The rules for using the courts and facilities at ${BRAND.name} — parking, safety, conduct and bad weather.`,
};

const linkClass =
  "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary";

/**
 * The points that must not be missed, as cards at the top of the page. Kept to
 * six: past that, highlighting stops meaning anything.
 */
const KEY_POINTS: { icon: LucideIcon; title: string; body: React.ReactNode }[] =
  [
    {
      icon: Car,
      title: "Parking is at your own risk",
      body: "The school accepts no responsibility for vehicles parked on the grounds, or for anything left in them.",
    },
    {
      icon: Clock,
      title: "Don't wait in the car park",
      body: "Please leave the parking area promptly once your session ends. It is not a waiting or meeting place.",
    },
    {
      icon: HeartPulse,
      title: "No medical facilities on site",
      body: (
        <>
          There is no first-aid room or medical staff. In an emergency call{" "}
          <a href="tel:1990" className={linkClass}>
            1990
          </a>{" "}
          (Suwa Seriya ambulance), then call or message the sports
          administration on{" "}
          <a href="tel:+94765674350" className={linkClass}>
            076 567 4350
          </a>
          .
        </>
      ),
    },
    {
      icon: CloudLightning,
      title: "Session cut short by weather?",
      body: (
        <>
          If extreme weather stops play, contact the sports office on{" "}
          <a href={CONTACT_PHONE_HREF} className={linkClass}>
            {CONTACT_DETAILS.phone}
          </a>{" "}
          the same day. Do not rebook it yourself.
        </>
      ),
    },
    {
      icon: ShieldAlert,
      title: "Play at your own risk",
      body: "You are responsible for your own safety and fitness to play, and for your belongings.",
    },
    {
      icon: Users,
      title: "Children must be supervised",
      body: "Players under 16 must have a responsible adult with them on the grounds for the whole session.",
    },
  ];

const SECTIONS: { heading: string; points: React.ReactNode[] }[] = [
  {
    heading: "Arriving and leaving",
    points: [
      "Arrive close to your start time — the court is not yours before your session begins.",
      "Sessions end on the hour. Leave the court promptly; the next group may be waiting.",
      "Keep to the courts and facilities you booked. School buildings and classrooms are out of bounds.",
      "Carry your NIC. Staff may ask to see it against the booking.",
      "During an Under-19 match, vehicle entrance may be restricted. Please be aware of this.",
    ],
  },
  {
    heading: "On the courts",
    points: [
      <>
        Every court and facility has its own rules on its page — read them
        before you play.{" "}
        <Link href="/courts" className={linkClass}>
          Browse courts
        </Link>
      </>,
      "Wear the right footwear and clothing for the sport and the surface.",
      "Report any damage or hazard to staff straight away.",
      "Leave the court as you found it.",
      "Please contact the Sports Admin/Staff to switch on the floodlights.",
    ],
  },
  {
    heading: "Safety and weather",
    points: [
      "Stop play and move indoors at the first sign of lightning.",
      "Tell a member of staff about any injury, however minor.",
      "Bring water and take breaks in the heat.",
      "Rebooking or a refund after a weather stoppage is decided by the sports office, case by case.",
    ],
  },
  {
    heading: "Conduct",
    points: [
      "No alcohol, smoking, vaping or illegal substances anywhere on school grounds.",
      "No abusive language or behaviour towards staff, players or anyone else.",
      "Follow the instructions of the sports office and ground staff at all times.",
      "No pets on the grounds.",
      "This is a working school. Please respect the campus and its people.",
    ],
  },
  {
    heading: "Your booking",
    points: [
      "Only the person who booked, and their group, may use the slot.",
      "Bookings may not be resold or transferred.",
      "Courts are not available on national and public holidays.",
      <>
        Breaking these rules may end a session early, without a refund, and may
        lead to the account being suspended. See the{" "}
        <Link href="/terms" className={linkClass}>
          terms of service
        </Link>
        .
      </>,
    ],
  },
  {
    // Placeholder content — the sports office will supply the exact policy
    // text; until then this is clearly marked as provisional.
    heading: "Refunds & cancellations",
    points: [
      <span key="placeholder" className="italic">
        <span className="mr-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground not-italic">
          Placeholder
        </span>
        This section will be replaced with the full refunds and cancellations
        policy shortly. Please contact the sports office with any questions in
        the meantime.
      </span>,
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
          Questions about a rule? Call the sports office on{" "}
          <a href={CONTACT_PHONE_HREF} className={linkClass}>
            {CONTACT_DETAILS.phone}
          </a>{" "}
          or email{" "}
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
