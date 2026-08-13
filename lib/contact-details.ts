/**
 * The venue's public contact details.
 *
 * PLACEHOLDERS — replace with the school's real details before go-live.
 * Kept in one module (rather than inline in the page) so the Contact page and
 * the footer can never disagree, and so swapping them for the next club that
 * buys this app is a one-file change.
 */
import { BRAND } from "@/lib/brand";

export const CONTACT_DETAILS = {
  organisation: `${BRAND.name} — Sports Complex`,
  addressLines: [
    `${BRAND.name}`,
    "Old Galle Road",
    "Moratuwa 10400",
    "Sri Lanka",
  ],
  phone: "+94 11 264 5411",
  /**
   * The address shown to visitors. Purely display — where contact-form
   * notifications are actually delivered is `ADMIN_CONTACT_EMAIL`, so the
   * public address can differ from the inbox that receives them.
   */
  email: "sports@stsebastians.lk",
  openingHours: [
    { days: "Monday – Friday", hours: "06:00 – 22:00" },
    { days: "Saturday & Sunday", hours: "07:00 – 20:00" },
  ],
} as const;

/** `tel:` needs the number without spaces or punctuation. */
export const CONTACT_PHONE_HREF = `tel:${CONTACT_DETAILS.phone.replace(/[^\d+]/g, "")}`;
