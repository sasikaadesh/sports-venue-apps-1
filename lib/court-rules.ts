/**
 * Court-specific rules, shown in the Rules section of each court's page.
 *
 * Each court may carry its own list (`Court.rules`, one rule per line, edited
 * in the admin court form). A court with none shows the standard set below, so
 * every court has sensible rules from day one. The venue-wide rules — parking,
 * medical cover, weather — are on /rules, not here; a court page links to them.
 *
 * Plain data, no server imports: the admin form reads the standard set too, to
 * show an admin what a blank field will display.
 */

/** Shown on any court whose own rules are blank. */
export const STANDARD_COURT_RULES: readonly string[] = [
  "Non-marking sports shoes only — no outdoor footwear on the court.",
  "Bring your own rackets, bats, balls and other equipment.",
  "Do not damage the court, nets or fittings. Damage is charged to the booking holder.",
  "Water only on court — no food, chewing gum or coloured drinks.",
  "Only the players on the booking may use the court.",
  "Leave the court clean and tidy for the next group.",
];

/** The admin's own text, split into rules — or null when there is none. */
export function parseCourtRules(
  rules: string | null | undefined
): string[] | null {
  const lines = (rules ?? "")
    .split(/\r?\n/)
    // Tolerate a pasted bullet list ("- ", "• ", "1. ") — the page draws its own.
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : null;
}

/** What a court's page shows: its own rules, or the standard set. */
export function courtRulesFor(rules: string | null | undefined): {
  rules: readonly string[];
  isStandard: boolean;
} {
  const own = parseCourtRules(rules);
  return own
    ? { rules: own, isStandard: false }
    : { rules: STANDARD_COURT_RULES, isStandard: true };
}
