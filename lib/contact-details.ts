/**
 * The venue's public contact details.
 *
 * PLACEHOLDERS — replace with the school's real details before go-live.
 * Kept in one module (rather than inline in the page) so the Contact page and
 * the footer can never disagree, and so swapping them for the next club that
 * buys this app is a one-file change.
 */
export const CONTACT_DETAILS = {
  organisation: "Courtside — School Sports Facilities",
  addressLines: ["Courtside Sports Complex", "12 Galle Road", "Colombo 03", "Sri Lanka"],
  phone: "+94 11 234 5678",
  /** Where booking questions should go. Not yet wired to any mail sending. */
  email: "sports@school.lk",
  openingHours: [
    { days: "Monday – Friday", hours: "06:00 – 22:00" },
    { days: "Saturday & Sunday", hours: "07:00 – 20:00" },
  ],
} as const;

/** `tel:` needs the number without spaces or punctuation. */
export const CONTACT_PHONE_HREF = `tel:${CONTACT_DETAILS.phone.replace(/[^\d+]/g, "")}`;
