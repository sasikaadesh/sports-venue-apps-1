/**
 * The institution this app is branded for.
 *
 * Together with the palette block at the top of `app/globals.css` and the crest
 * at `public/logo.png`, this is the whole rebrand surface: change these three
 * things and the app belongs to a different school. No component hardcodes the
 * name, the motto or the logo path.
 *
 * Visual identity (colours, type, signature components) lives in the `brand`
 * skill under `.claude/skills/brand/`, with the applied version written up in
 * `docs/DESIGN.md`.
 */
export const BRAND = {
  /** The institution itself. */
  name: "St. Sebastian's College",
  /** Disambiguating suffix — there is more than one St. Sebastian's. */
  location: "Moratuwa",
  /** Full product name, as it appears in the browser tab and on emails. */
  appName: "St. Sebastian's College — Sports Booking",
  /** Where the full name will not fit: narrow headers, the PDF masthead. */
  shortName: "SSC Sports Booking",
  /** What the app does, for meta descriptions and email preheaders. */
  tagline: "Court booking for students, staff and old boys",

  motto: "Exspecta Dominum Viriliter Age",
  mottoTranslation: "Expect the Lord and act manfully",
  established: 1854,

  /** The crest. A transparent PNG, so it sits on the deep-green footer. */
  logo: "/logo.png",
} as const;

/** Title suffix for every page except the home page. */
export const TITLE_TEMPLATE = `%s — ${BRAND.shortName}`;
