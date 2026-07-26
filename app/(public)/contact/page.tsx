import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { ContactForm } from "@/components/public/contact-form";
import { getCurrentUser } from "@/lib/auth";
import { CONTACT_DETAILS, CONTACT_PHONE_HREF } from "@/lib/contact-details";

export const metadata: Metadata = {
  title: "Contact us — Courtside",
  description:
    "Get in touch with the sports office about court bookings, availability and events.",
};

export default async function ContactPage() {
  // Signed in? Pre-fill what we already know. No auth gate — anyone may write.
  const user = await getCurrentUser();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-5xl leading-[1.05]">Contact us</h1>
        <p className="text-lg text-muted-foreground">
          Questions about a booking, a court, or hiring a facility for an event?
          Send us a message and the sports office will get back to you.
        </p>
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl leading-none">Send a message</h2>
          <ContactForm
            defaultName={user?.name ?? ""}
            defaultEmail={user?.email ?? ""}
          />
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-2xl leading-none">Find us</h2>

          <dl className="flex flex-col gap-px overflow-hidden rounded-xl border bg-border">
            <Detail icon={<MapPin className="size-4" />} label="Address">
              <address className="not-italic">
                {CONTACT_DETAILS.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </Detail>

            <Detail icon={<Phone className="size-4" />} label="Phone">
              <a
                href={CONTACT_PHONE_HREF}
                className="underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:text-primary"
              >
                {CONTACT_DETAILS.phone}
              </a>
            </Detail>

            <Detail icon={<Mail className="size-4" />} label="Email">
              <a
                href={`mailto:${CONTACT_DETAILS.email}`}
                className="underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:text-primary"
              >
                {CONTACT_DETAILS.email}
              </a>
            </Detail>

            <Detail icon={<Clock className="size-4" />} label="Opening hours">
              <ul className="flex flex-col gap-0.5">
                {CONTACT_DETAILS.openingHours.map((slot) => (
                  <li key={slot.days} className="flex flex-wrap gap-x-2">
                    <span>{slot.days}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {slot.hours}
                    </span>
                  </li>
                ))}
              </ul>
            </Detail>
          </dl>

          <p className="max-w-prose text-sm text-muted-foreground">
            Opening hours are when the office is staffed. Individual courts have
            their own bookable hours — check the court page for the exact
            schedule.
          </p>
        </section>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 bg-card px-5 py-4">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}
