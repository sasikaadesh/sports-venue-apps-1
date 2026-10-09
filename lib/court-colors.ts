/**
 * The 9-swatch palette `Court.color` is drawn from — distinguishable at a
 * glance, but dignified rather than a rainbow (brand skill: "no bright
 * startup colours, no rainbow palettes"). These read like a set of school
 * house colours rather than a chart palette, which is the point: they sit
 * comfortably next to the green-and-gold identity instead of competing with
 * it. `--green` and `--gold` themselves anchor the set, so a court using
 * either one still looks like it belongs to the same school.
 *
 * Seeded onto existing courts once, by the migration
 * (`20261009130000_court_color`); kept here too so new courts, the admin
 * colour picker, and the legend all draw from exactly this list.
 */
export const COURT_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Green", hex: "#0E7A34" },
  { name: "Gold", hex: "#C99A2E" },
  { name: "Navy", hex: "#1B3A5C" },
  { name: "Burgundy", hex: "#7A2E2E" },
  { name: "Teal", hex: "#2E6B6B" },
  { name: "Terracotta", hex: "#8B5A2B" },
  { name: "Olive", hex: "#5C6B2E" },
  { name: "Slate", hex: "#44576B" },
  { name: "Walnut", hex: "#6B4A3A" },
];

export const DEFAULT_COURT_COLOR = COURT_COLOR_PALETTE[0]!.hex;

/** The palette's name for a hex, or the hex itself if it is a custom value. */
export function courtColorName(hex: string): string {
  return (
    COURT_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())
      ?.name ?? hex
  );
}

/**
 * A sensible colour for the next court created — the first palette entry not
 * already in use by an active court, cycling back to the start once every
 * swatch is taken rather than refusing to suggest one.
 */
export function suggestNextCourtColor(usedHexes: string[]): string {
  const used = new Set(usedHexes.map((h) => h.toLowerCase()));
  const free = COURT_COLOR_PALETTE.find((c) => !used.has(c.hex.toLowerCase()));
  return (
    free?.hex ??
    COURT_COLOR_PALETTE[usedHexes.length % COURT_COLOR_PALETTE.length]!.hex
  );
}
