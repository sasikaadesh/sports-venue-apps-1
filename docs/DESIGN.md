# DESIGN — St. Sebastian's College, Moratuwa

Direction: **dignified, traditional, trustworthy, calm**. An established
institution — a Catholic boys' national school founded in **1854** — not a
startup. Refined and understated, never bright or playful. Where the choice is
between "energetic" and "elegant", choose elegant.

School colours are **green and gold**. Motto: _Exspecta Dominum Viriliter Age_
("Expect the Lord and act manfully").

## What this document is

`.claude/skills/brand/SKILL.md` is the **source of truth for the brand** —
what the identity _is_. This document records how that identity is **applied in
this codebase**: which token holds which value, what the contrast ratios
actually measure, and the rules that keep both themes honest.

If the two ever disagree, the skill wins and this file is stale.

### The rebrand surface

Three things, and nothing else, make this app belong to a different school:

| File                              | Holds                                            |
| --------------------------------- | ------------------------------------------------ |
| `app/globals.css` → palette block | every colour in the app                          |
| `public/logo.png`                 | the crest (header, footer, favicon, Apple icon)  |
| `lib/brand.ts`                    | name, motto, established year, page-title suffix |

No component contains a colour, a school name or a logo path. That is a hard
rule, not an aspiration — see "Auditing it" at the end.

## Colour

The palette is declared once, in hex, at the top of `app/globals.css` as `--p-*`
custom properties. The `:root` and `.dark` blocks below it only **assign** those
to semantic roles (`--primary`, `--band`, `--gold`, …); they never introduce a
new colour. Palette in one place, meaning in another.

### The ramp

| Token               | Hex / value            | Role                                                 |
| ------------------- | ---------------------- | ---------------------------------------------------- |
| `--p-green`         | `#088020`              | primary actions, links, active states, rings         |
| `--p-green-deep`    | `#19532A`              | CTA band, strong emphasis — the anchor               |
| `--p-green-deepest` | `#163A24`              | the footer ground; the fixed scrim over photography  |
| `--p-gold`          | `#E0AB2E`              | the rare accent: one button, one hairline            |
| `--p-mint`          | `#EAF5EF`              | the calm tinted section                              |
| `--p-mint-soft`     | `#F2F9F5`              | very light section wash                              |
| `--p-ink`           | `#14231A`              | headings and body text (near-black, green undertone) |
| `--p-muted`         | `#5B6B62`              | secondary and supporting text                        |
| `--p-border`        | `#D9E7DF`              | card borders and dividers (soft green-grey)          |
| `--p-night*`        | `oklch(… … 150)`       | the dark-theme surface ramp — deep green, never zinc |
| `--p-green-lift`    | `oklch(0.72 0.15 150)` | the green, after dark                                |
| `--p-gold-lift`     | `oklch(0.82 0.13 84)`  | the gold, after dark                                 |

**Where the greens come from.** They are eyedropped from the crest itself
(`public/logo.png`, measured at `#088020` green / `#F8B800` gold) and reconciled
with the brand skill's published values. Two deliberate departures from the
skill's table, both forced:

1. **`--p-green` is the crest green `#088020`, not the skill's `#1F9D55`.**
   `#1F9D55` measures **3.49:1** against white — it cannot legally carry a white
   button label or a body-sized link. The crest green measures **5.10:1**, so it
   clears AA _and_ matches the logo it sits beside. The brand skill invites
   exactly this check ("confirm the exact crest green… by eyedropper on the
   logo, and adjust here if needed"), and `SKILL.md` has been updated to match.
2. **`--p-gold` is `#E0AB2E`**, pulled between the crest's flat print gold
   (`#F8B800`) and the skill's antique gold (`#D4A029`) — bright enough to read
   as the crest's gold, restrained enough to stay dignified rather than gaudy.

**Usage discipline.** Green is the identity. Gold is a _rare_ accent — a
`variant="gold"` button for the single most important action on a page, and the
gold segment of the footer's top rule (plus the footer's own labels and motto,
which are the block's signature). If two golds are visible at once on a page
body, one is wrong. Deep
green is for grounding bands. Mint backgrounds create the calm, spacious feel;
alternate white and mint sections for gentle rhythm.

**Never:** purple/blue gradients, rainbow palettes, a second competing bright
hue, low-contrast green-on-green.

### Semantic tokens

Components read these, never the palette directly (the two `photo-*` tokens are
the sole exception — see rule 3).

| Token                                | Light                       | Dark                    | Measured                 |
| ------------------------------------ | --------------------------- | ----------------------- | ------------------------ |
| `--background` / `--foreground`      | white / ink                 | `p-night` / near-white  | 16.3:1 / 17.3:1          |
| `--card`                             | white                       | `p-night-raised`        | fg 15.8:1                |
| `--popover`                          | white                       | `p-night-high`          | one step above card      |
| `--primary` / `--primary-foreground` | green / **white**           | `green-lift` / **ink**  | 5.10:1 / 6.98:1          |
| `--secondary`, `--muted`, `--accent` | mint                        | night surfaces          | —                        |
| `--muted-foreground`                 | `p-muted`                   | `p-night-muted-fg`      | 5.64:1 / 8.29:1          |
| `--gold` / `--gold-foreground`       | gold / ink                  | `gold-lift` / ink       | 7.81:1 / 9.32:1          |
| `--band` / `--band-foreground`       | `green-deep` / white        | `night-band` / white    | 9.08:1 / 16.1:1          |
| `--band-muted`, `--band-border`      | mixed toward band           | mixed toward band       | supporting text/rule     |
| `--footer` / `--footer-foreground`   | `green-deepest` / off-white | same green / `night-fg` | ~11:1 in both themes     |
| `--footer-muted`, `--footer-border`  | mixed toward footer         | mixed toward footer     | copyright / divider      |
| `--footer-rule`                      | `p-green`                   | `green-lift`            | the rule's green segment |
| `--tint`, `--tint-strong`            | mint-soft, mint             | raised, high            | section washes           |
| `--chart-1…5`                        | greens + gold               | lifted greens + gold    | one brand, not two       |

Note the **primary pairing inverts between themes**: white-on-green in light,
ink-on-lifted-green in dark. That is deliberate — a green dark enough to hold
white text would be indistinguishable from the dark background it sits on.

### Dark mode

Not a different design: the same one after dark. The surfaces are **deep green
near-blacks**, not neutral zinc — in dark mode the identity has to survive in
the _background_, not just in the accents.

Three rules that make it hold together:

1. **Elevation is lightness, not shadow.** background (0.175) → card (0.222) →
   popover/dialog (0.262) step up in oklch lightness. Shadows are nearly
   invisible on dark surfaces, so a dropdown that doesn't get lighter dissolves
   into the page.
2. **`color-scheme` is set on both `:root` and `.dark`.** Native controls —
   `<select>` popups, the `<input type="date">` calendar, scrollbars — are
   painted by the OS and ignore CSS tokens entirely. Without this the date
   picker stays light-on-light in dark mode.
3. **Colour over photography is fixed, never themed.** The home hero and the
   auth split-screen use `bg-photo-scrim` and `text-photo-gold`, which point at
   the raw palette and are _not_ redefined in `.dark`. A themed scrim
   (`bg-foreground/45`) looks token-correct but inverts — it turns white in dark
   mode and washes the photograph out. Text on an image is always light over a
   dark veil, in both themes. The veil is tinted with the school's deepest green
   rather than neutral black, so even the photography sits inside the palette.

**Never in dark mode:** pure `#000` backgrounds, tinting a photograph with a
themed scrim, or a `/5`–`/10` accent wash as the only marker of a selected
state — it vanishes against a dark field, so pair it with a border or ring.

### The toggle

Light / dark / **system**, persisted, in the header —
`components/theme-toggle.tsx`, driven by `next-themes` (`attribute="class"`). A
three-way segmented control, not a cycling icon button: "system" is a real
choice and one button cannot show which of the three is active. It appears in
the site header, the admin header and the auth layout — the last renders outside
the site header and would otherwise be a dead end. The account page carries no
toggle of its own: it renders inside the site header
(`app/account/layout.tsx`), which already has one.

### Print

Tokens are redefined for `@media print` — for both `:root` and `.dark`, so an
admin working after dark gets the same sheet as one working at noon. Colour is
dropped rather than translated: browsers do not print background fills by
default, so a surface that carries meaning only through its fill would print as
nothing. Hence borders, not washes. The green and gold are no exception — the
brand lives on screen, the report lives on paper.

## Typography

The serif headings are **the single strongest brand signal**. Do not drop them
for a plain sans; the serif _is_ the brand.

- **Headings:** **Lora** via `next/font/google`, exposed as `--font-heading`
  (and `--font-serif`). The brand skill accepts Playfair Display, Lora or
  Cormorant; Lora is the one that ships because this app is not only a marketing
  site — it has admin tables, dialogs and card headers where `h3` lands at
  16–18px. Playfair's high stroke contrast thins out and turns fragile at that
  size; Lora's sturdier serifs stay crisp, while still carrying the heritage
  feel at hero size.
- **Body:** **Inter** via `next/font/google`.
- **Headings are `font-semibold tracking-normal`, never `font-bold
tracking-tight`.** A serif at heavy weight and negative tracking turns muddy.
  Semibold, normal tracking and a 1.2 line-height are what give it the
  dignified, unhurried feel. This is set once in the `@layer base` block.
- **Eyebrow labels:** small, uppercase, letter-spaced (`0.18em`), sitting above
  a heading — `components/brand/eyebrow.tsx`. The eyebrow/serif-heading pair is
  what gives a section its institutional rhythm.
- **Emails** fall back to Georgia: a webfont in an inbox is a coin flip, and
  Georgia is the closest thing to Lora that clients reliably have.

## Signature components

Four components carry the brand. Reuse them rather than re-inventing the look.

1. **Labelled feature card** — `components/brand/feature-card.tsx`. A mint card
   with a hairline border: green eyebrow, serif sub-heading, muted paragraph,
   green text link. For highlighting a feature or section — _not_ as a generic
   container (that is `components/ui/card.tsx`).
2. **Numbered process row** — `components/brand/process-steps.tsx`. Large faint
   serif numerals (01 / 02 / 03) above a serif step title and muted description.
   **Only for genuine sequences.** Numbering unordered items tells the reader to
   do them in order, which is a lie the design cannot walk back; if there is no
   order, use feature cards. Rendered as an `<ol>` so the sequence is in the
   markup, with the numerals `aria-hidden` — the list already conveys order, and
   "zero one" read aloud before every heading is noise.
3. **Deep-green CTA band** — `components/brand/cta-band.tsx`. A full-width
   `--band` section: white serif heading, short muted line, one gold button and
   one outlined. Anchors the important call to action at the foot of a page. It
   sets `data-flush-footer`, which the site layouts use to drop the gap above
   the footer — two deep-green blocks separated by a strip of white would read
   as a mistake.
4. **Footer** — `components/site-footer.tsx`. Deep forest-green ground
   (`--footer`, one step deeper than the band), and across the top the **school
   rule**: a single hairline split into three filled segments of **equal
   width** — medium green, white, gold, each an even third (`flex-1`). Below it the crest and school name, `Moratuwa · Est. 1854`, the
   tagline, the motto in gold serif italic, a gold primary and a white-outlined
   secondary button; link columns to the right under gold uppercase labels; a
   divider and a pale-green copyright row. Gold appears exactly three times
   (labels, motto, primary button) plus the rule's third segment.
5. **Testimonials band** — `components/brand/testimonials-band.tsx`. A compact
   `--band` strip (py-12/14, well under the CTA band) closing the home page: a
   gold eyebrow, one serif line, and two or three quotes in a row, each under a
   `--band-border` hairline, attributed to a gold name and a small uppercase
   role. The crest sits bled off the bottom-right at 7% opacity as a watermark
   (md and up only). Like the CTA band it sets `data-flush-footer`, so it meets
   the footer directly. Quotes are hardcoded in `app/(public)/page.tsx` —
   placeholders until the school supplies real ones; there is no reviews table.

## Buttons

`components/ui/button.tsx`, on top of shadcn/Base UI.

**Every button is square** — `rounded-none` on the base, and no size variant
carries a radius of its own, so the sharp corner holds app-wide without any call
site opting in. It is a brand signal (traditional/institutional, not consumer
app), so hand-rolled button-like controls follow it too: the theme toggle, the
account tab strip, the bookings pagination and the small icon buttons in the
admin forms. Cards, inputs and images keep their radius; only buttons are sharp.

- **`default`** — solid green, white text.
- **`gold`** — solid gold, ink text. The single most important action only.
- **`outline`** — transparent with `--border`.
- **`on-band`** — outline for use _inside_ a CTA band. The plain `outline`
  variant paints itself with `bg-background`/`border-border`, which are
  page-surface tokens: on the band those give a white slab in light mode and an
  invisible edge in dark. This variant reads the band's own tokens instead.

## Layout & shape

- Generous whitespace; calm, spacious sections. Alternate white and mint
  backgrounds for rhythm.
- **Low, simple hero** — a clean band, not a full-screen takeover. The booking
  bar lives directly beneath it.
- Cards: white or mint, `--border` hairline, `rounded-lg`, very soft shadow.
  Restrained, not flashy — the court cards, their skeletons and the court
  gallery all sit at `rounded-lg`, a step tighter than the old `rounded-xl`, so
  the grid reads refined rather than bubbly.
- **Left-align most content.** Avoid centering everything.
- Court thumbnails in a tidy grid, consistent aspect ratio.

## Logo

The school **crest** (`public/logo.png`) — a transparent PNG, which is what lets
it sit directly on the deep-green footer with no white plate behind it.
`components/brand/crest.tsx` exports `Crest` and `Wordmark`; nothing else
references the file path. It is also `app/icon.png` (favicon) and
`app/apple-icon.png`.

**Never** stretch, recolour, or box the crest on a coloured plate. Keep clear
space around it. It replaced the previous lightning-bolt mark entirely.

## Imagery

- Real, dignified photography. Unsplash placeholders for now
  (`images.unsplash.com`), swapped for the school's own court photos later via
  the admin panel.
- Always via the Next.js `<Image>` component — never a raw `<img>`.

## Icons & details

- **lucide-react** line icons. **No emoji as icons.**
- Subtle hover states, smooth but minimal motion — no gratuitous animation.
- Considered empty and loading states; they signal care.

## shadcn/ui

Use it as the component base, but **theme it with the tokens above**. Do not
ship default shadcn styling — the un-themed look is itself a recognisable
"generated" tell.

## Auditing it

The no-hardcoded-colour rule is mechanically checkable. From the repo root:

```bash
# Tailwind palette utilities (bg-green-500, text-zinc-400, …) — must be empty
grep -rnoE "\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" app components lib --include=*.tsx --include=*.ts | grep -v lib/generated

# Literal hex outside the three sanctioned files — must be empty
grep -rn "#[0-9a-fA-F]\{6\}" app components lib --include=*.tsx --include=*.ts \
  | grep -v lib/generated | grep -v lib/email/templates.tsx \
  | grep -v lib/reports/bookings-pdf.tsx | grep -v google-button.tsx
```

The three exceptions, and why each is legitimate:

- `lib/email/templates.tsx` — an inbox cannot resolve a CSS custom property.
  The constants there mirror the palette and are commented as such.
- `lib/reports/bookings-pdf.tsx` — react-pdf, black on paper by design.
- `components/google-button.tsx` — Google's own four brand colours in their
  logo. Recolouring another company's mark is not ours to do.

## Quick anti-generic checklist

- [ ] Elegant serif headings (Lora), semibold and normally tracked — not a sans
- [ ] Green as the identity; gold used **sparingly** (one button, one hairline)
- [ ] Uppercase eyebrow above section headings
- [ ] Deep-green bands grounding the page; mint sections for rhythm
- [ ] Crest used as-is — never stretched, recoloured or boxed
- [ ] lucide icons, no emoji
- [ ] Themed shadcn, not defaults
- [ ] Left-aligned, varied layout (not everything centered)
- [ ] Hover/empty/loading states considered
- [ ] Renders correctly in **both** themes, and switches cleanly both ways
- [ ] Both audit greps above come back empty
