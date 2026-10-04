/**
 * Court-specific rules, shown in the Rules section of each court's page.
 *
 * Each court may carry its own list (`Court.rules`, one rule per line, edited
 * in the admin court form). A court with none shows the standard set for its
 * court type below (or the generic set, for a type not listed), so every court
 * has sensible rules from day one. The venue-wide rules — parking, medical
 * cover, weather — are on /rules, not here; a court page links to them.
 *
 * Plain data, no server imports: the admin form reads the standard sets too,
 * to show an admin what a blank field will display.
 */

const NO_FOOD = "Water only on court — no food or chewing gum.";
const NO_DAMAGE =
  "Do not damage the court, nets or fittings. Damage is charged to the booking holder.";
const BOOKED_PLAYERS_ONLY =
  "Only the players on the booking may use the court.";
const LEAVE_TIDY = "Leave the court clean and tidy for the next group.";
const NON_MARKING_SHOES =
  "Non-marking sports shoes only — no outdoor footwear on the court.";

/** A court-sport set: only the equipment line differs between sports. */
function courtSportRules(equipment: string): readonly string[] {
  return [
    NON_MARKING_SHOES,
    equipment,
    NO_DAMAGE,
    NO_FOOD,
    BOOKED_PLAYERS_ONLY,
    LEAVE_TIDY,
  ];
}

/** Shown on a court with no rules of its own whose type has no set below. */
export const STANDARD_COURT_RULES: readonly string[] = courtSportRules(
  "Bring your own equipment."
);

/**
 * Standard rules per court type, keyed by the court type's name (lower-cased).
 * Shown on any court of that type whose own rules are blank.
 */
const STANDARD_RULES_BY_TYPE: Record<string, readonly string[]> = {
  badminton: courtSportRules(
    "Bring your own rackets, shuttles and other equipment."
  ),
  tennis: courtSportRules("Bring your own rackets, balls and other equipment."),
  "table tennis": courtSportRules(
    "Bring your own rackets, balls and other equipment."
  ),
  basketball: courtSportRules("Bring your own basketball and other equipment."),
  cricket: [
    "Bring your own bats, balls, pads and other cricket gear.",
    "Wear a helmet when batting against a hard ball.",
    "No metal spikes on the astro or matting surface — rubber soles only.",
    "One bowler runs in at a time; wait until the batter is ready.",
    "Stay out of a net while someone is bowling in it.",
    "Do not damage the nets, netting poles or surface. Damage is charged to the booking holder.",
  ],
  swimming: [
    "Bring your own swimwear, goggles and towel.",
    "Shower before entering the pool.",
    "Swimwear only — no outdoor clothing in the water.",
    "No running, diving or rough play on the pool deck.",
    "Follow the lifeguard's instructions at all times.",
    "Children under 12 must be accompanied by an adult in the water.",
    "No food, glass or chewing gum on the pool deck.",
  ],
  fitness: [
    "Bring your own towel; equipment is provided.",
    "Clean training shoes only — no outdoor footwear on the gym floor.",
    "Wipe down equipment after use.",
    "Return weights and equipment to their racks.",
    "Use a spotter for heavy free-weight lifts.",
    "No dropping weights except on the lifting platform.",
    "Ask staff if you are unsure how to use a machine.",
  ],
};

/** The standard rules for a court type — the generic set if it has none. */
export function standardRulesForType(
  typeName: string | null | undefined
): readonly string[] {
  return (
    STANDARD_RULES_BY_TYPE[(typeName ?? "").trim().toLowerCase()] ??
    STANDARD_COURT_RULES
  );
}

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

/** What a court's page shows: its own rules, or its type's standard set. */
export function courtRulesFor(
  rules: string | null | undefined,
  typeName?: string | null
): {
  rules: readonly string[];
  isStandard: boolean;
} {
  const own = parseCourtRules(rules);
  return own
    ? { rules: own, isStandard: false }
    : { rules: standardRulesForType(typeName), isStandard: true };
}
