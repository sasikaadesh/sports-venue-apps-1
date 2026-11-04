/**
 * The November 2026 per-court rules, keyed by exact court name. Shared by
 * scripts/apply-court-rules-2026-11.mts (one-off update of an existing
 * database) and prisma/seed.mts (so a re-seed writes the same rules).
 */

/** The court-sports set; rule 2 names only that court's own equipment. */
const courtSportRules = (equipment: string): readonly string[] => [
  "Wear non-marking sports shoes only. Outdoor footwear is not permitted on the court.",
  equipment,
  "Do not damage the court, nets, posts, fittings, or surrounding facilities. The person who made the booking will be responsible for the cost of any damage.",
  "Only water is permitted on the court. Food, chewing gum, and other refreshments are not allowed.",
  "Only the players included in the booking may use the court.",
  "Leave the court clean, tidy, and ready for the next group.",
];

const CRICKET_NET_RULES: readonly string[] = [
  "Bring your own bats, balls, pads, helmets, and other cricket equipment.",
  "A helmet must be worn when batting against a hard ball.",
  "Metal spikes are not permitted. Only rubber-soled footwear may be used on astro and matting surfaces.",
  "Only one bowler may bowl at a time. Ensure the batter is ready before delivering a ball.",
  "Do not enter, cross, or stand inside a neighbouring net while bowling activity is in progress.",
  "Do not damage the nets, netting poles, matting, pitch surfaces, or surrounding facilities. The person who made the booking will be responsible for the cost of any damage.",
  "Bowling machines are not provided by the College.",
];

const SWIMMING_POOL_RULES: readonly string[] = [
  "Bring your own swimwear, goggles, and towel.",
  "Shower before entering the pool.",
  "Proper swimwear must be worn at all times. Outdoor clothing is not permitted in the water.",
  "Running, diving, and rough play are prohibited on the pool deck.",
  "Follow all instructions issued by authorised pool staff.",
  "Children under 12 years of age must be accompanied by an adult in the water.",
  "Food, glass containers, and chewing gum are not permitted on the pool deck.",
  "No lifeguard service is provided by the College. Use of the swimming pool is entirely at the user’s own risk.",
  "Vehicles must not be parked behind the swimming pool.",
];

const FITNESS_CENTER_RULES: readonly string[] = [
  "Bring your own towel. Gym equipment is provided by the College.",
  "Wear clean training shoes only. Outdoor footwear is not permitted on the gym floor.",
  "Wipe down equipment after use.",
  "Return all weights and equipment to their designated racks after use.",
  "Use a spotter when performing heavy free-weight exercises.",
  "Weights may only be dropped on designated lifting platforms.",
  "Ask a member of staff if you are unsure how to use any equipment or machine.",
];

export const COURT_RULES_2026_11: Record<string, readonly string[]> = {
  Badminton: courtSportRules("Bring your own rackets and shuttles."),
  Basketball: courtSportRules("Bring your own basketball."),
  "Tennis - Main": courtSportRules("Bring your own rackets and tennis balls."),
  "Tennis - Mini": courtSportRules("Bring your own rackets and tennis balls."),
  "Table Tennis - Arena 1": courtSportRules(
    "Bring your own bats (rackets) and balls."
  ),
  "Table Tennis - Arena 2": courtSportRules(
    "Bring your own bats (rackets) and balls."
  ),
  "Cricket Nets - Double": CRICKET_NET_RULES,
  "Cricket Net - Astro": CRICKET_NET_RULES,
  "Cricket Net - Concrete": CRICKET_NET_RULES,
  "Swimming Pool": SWIMMING_POOL_RULES,
  "Fitness Center": FITNESS_CENTER_RULES,
};
