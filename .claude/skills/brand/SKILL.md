<!--
  BRAND SKILL — how this app looks.
  What it does: the single source of truth for visual identity (colours, type, spacing, components).
  When it triggers: whenever building or restyling any UI in this project.
  To rebrand for a new customer later: change the VALUES in this one file (and swap the logo). Do not create a second brand skill.
  Current brand: St. Sebastian's College, Moratuwa.
-->

---

name: brand
description: The project's brand and visual identity — colours, typography, spacing, and signature components. Apply this whenever building or restyling any UI (pages, components, admin, emails) so everything stays on-brand and consistent. Currently set to St. Sebastian's College, Moratuwa (green & gold, traditional/institutional). This is the single source of truth for styling; to rebrand, edit the values here.
---

# Brand — St. Sebastian's College, Moratuwa

## Who this is for

St. Sebastian's College, Moratuwa — a premier Catholic boys' national school, **established 1854**. Motto: _Exspecta Dominum Viriliter Age_ ("Expect the Lord and act manfully"). School colours are **green and gold**.

The feeling to aim for: **dignified, traditional, trustworthy, calm** — an established institution, not a startup. Refined and understated, not bright or playful. When a choice is between "energetic" and "elegant", choose elegant.

## Colour tokens

Define these as CSS variables / theme tokens and reference them everywhere — never hardcode a raw hex in a component.

| Token                | Hex       | Use                                                                          |
| -------------------- | --------- | ---------------------------------------------------------------------------- |
| `--green` (primary)  | `#088020` | Primary buttons, accent headings, links, active states                       |
| `--green-deep`       | `#19532A` | Feature/CTA bands, footer, strong emphasis, the "serious" anchor             |
| `--green-deepest`    | `#163A24` | Footer base, deepest backgrounds — deep, muted forest green                  |
| `--gold` (secondary) | `#E0AB2E` | Secondary buttons, small highlights, the gold third of the footer's top rule |
| `--mint` (surface)   | `#EAF5EF` | Soft page-section backgrounds, the calm tinted areas                         |
| `--mint-soft`        | `#F2F9F5` | Very light section wash                                                      |
| `--ink`              | `#14231A` | Headings and body text (near-black with a green undertone)                   |
| `--muted`            | `#5B6B62` | Secondary/supporting text                                                    |
| `--white`            | `#FFFFFF` | Primary background, cards                                                    |
| `--border`           | `#D9E7DF` | Card/box borders, dividers (soft green-grey)                                 |

**Usage discipline:** green is the identity, gold is the _rare_ accent (buttons and a hairline rule — don't flood the page with gold). Deep green is for grounding bands (CTA sections, footer). Mint backgrounds create the calm, spacious feel.

**Confirmed against the crest.** These were originally read from the school's website; they have since been eyedropped from `public/logo.png` — measured crest green `#088020`, crest gold `#F8B800` — and adjusted above. Two notes on that reconciliation, both of which should survive any future edit:

- `--green` is the measured crest green. The earlier value `#1F9D55` sits at only **3.49:1** against white, so it cannot carry a white button label or a body-sized link at WCAG AA; the crest green measures **5.10:1**. Any replacement green must clear 4.5:1 against white.
- `--gold` sits between the crest's flat print gold (`#F8B800`) and an antique gold (`#D4A029`) — bright enough to read as the crest's gold, restrained enough to stay dignified rather than gaudy.

## Typography

The serif headings are what make this read as a heritage institution — this is the most important brand signal, do not drop it.

- **Headings (display):** an **elegant serif** — e.g. **Playfair Display**, **Lora**, or **Cormorant** (via `next/font/google`). Used for page titles and section headers ("Not just different. Better prepared."). Large, confident, generous line-height.
- **Body:** a clean, readable sans — **Inter** (via `next/font/google`).
- **Eyebrow labels:** small, **uppercase**, letter-spaced, in `--muted` or `--green` (e.g. "ACADEMICS", "ADMISSIONS 2026") sitting above a heading.
- Clear hierarchy: large serif headings, comfortable sans body, small uppercase eyebrows.

## Layout & feel

- Generous whitespace and calm, spacious sections. Alternate white and `--mint` section backgrounds for gentle rhythm.
- Cards: white or `--mint-soft`, `--border` hairline, a **small** radius (`rounded-lg`, ~0.75rem — refined, not bubbly), very soft shadow. Restrained, not flashy. Buttons inside them are square (see Buttons).
- Left-aligned content; avoid centering everything.
- Real, dignified photography where used.

## Signature components (reuse these — from the school's own site)

**1. Labelled feature card** _(the "Academics that build character" box you liked)._
A pale-green (`--mint`) card with a `--border` hairline, `rounded-lg`, generous padding (~1.75rem) and **no shadow** — the tint is what lifts it off a white section. Stacked inside, in this order: a small uppercase letter-spaced eyebrow label in `--green`, a serif sub-heading, a short paragraph in `--muted`, and (when the card leads somewhere) a `--green` text link with a small arrow, pinned to the bottom so a row of cards aligns. Use for highlighting a feature or section — not as a generic container.

**2. Numbered process row** _(the "Your move, made simple." 01/02/03 section)._
Large faint serif numbers (`01` `02` `03`) in a light green, each above a serif step title and a short `--muted` description. **Only use real sequences** (steps that genuinely have an order).

**3. Deep-green CTA band** _(the "Best chapter of your story starts here." section)._
A full-width `--green-deep` background section with white serif heading, short white/muted text, and buttons (one gold `--gold`, one outlined white). Used to anchor an important call to action.

**4. Footer.**
The school's signature block. Ground it in `--green-deepest` — a deep, slightly muted forest green — and build it as follows.

- **Top rule.** One thin horizontal hairline (~4px) split into **three equal thirds: medium green, white, then `--gold`, each exactly one third of the full width.** This is the school rule and it is the footer's signature — it is _not_ a solid gold bar, and the thirds are even, not a wide green run closed by a short gold tail. Fill the segments (`flex`, each `flex-1`) rather than drawing three borders, so the thirds stay equal at every width.
- **Identity, top-left.** Crest + school name in the serif, with `<Location> · Est. <Year>` beneath it as a small letter-spaced uppercase line in the muted pale-green.
- **Then, in order:** a one-line tagline in off-white, the motto in **gold serif italic** (_Exspecta Dominum Viriliter Age_), and a pair of actions — a solid `--gold` primary button and a **white-outlined** secondary. This is the only place two buttons sit on a coloured band outside the CTA band itself.
- **Link columns to the right.** Section labels (EXPLORE / ACCOUNT / CONNECT — or whatever the site's real sections are) in small letter-spaced uppercase **`--gold`**; the links themselves off-white.
- **Bottom.** A thin divider, then a copyright row in the muted pale-green, with the location pushed to the right on wide screens.

**Colour roles in the footer:** off-white for the school name, links, tagline and body; `--gold` for the section labels and the motto only; a muted pale-**green** (not grey) for the copyright row. Gold appears exactly three times — labels, motto, primary button. Any more and the block tips from institutional into gaudy.

**5. Testimonials band** _(the compact deep-green quotes strip)._
A short sibling of the CTA band on the same `--green-deep` ground, and deliberately **compact — a closing note, not another full section**: a `--gold` uppercase eyebrow, one white serif line, then two or three quotes in a row. Each quote carries a hairline rule above it in the band's border colour rather than sitting in a card — a bordered box on a coloured band reads as a second surface. Beneath each quote, the attribution: the name in `--gold`, the role ("Parent", "Old Boy", "Coach") as a small letter-spaced uppercase line in the muted band colour. Optionally the crest, bled off one corner at ~7% opacity, as a watermark. Gold appears exactly twice — the eyebrow and the names. Like the CTA band it is the last block on its page and sits flush against the footer.

## Buttons

**Every button in the app has square corners — no border radius at all, at any size or variant.** The sharp corner is a deliberate brand signal: it reads traditional and institutional, where a pill or a soft rounded button reads consumer-app. This is set once on the button component's base styles (and its size variants carry no radius of their own), so it holds app-wide without call sites opting in. Hand-rolled button-like controls — segmented toggles, tab pills, pagination controls, small icon buttons — follow the same rule.

Cards, inputs, images and other surfaces keep their (modest) radius; only buttons are square.

- **Primary:** solid `--green`, white text, square. ("Start Admissions" style.)
- **Secondary/accent:** solid `--gold`, dark text — used sparingly for the single most important action. ("Apply Now" style.)
- **Outline:** transparent with `--border` (or white border on dark bands).

## Logo

Use the school **crest** (green & gold shield). Place the high-resolution PNG/SVG in the app (header, footer, favicon). Keep clear space around it; never stretch or recolour it. Replaces any previous app logo/wordmark.

## Dark mode

Keep the identity in dark mode: deep green (`--green-deepest`) backgrounds, light text, `--green` and `--gold` accents kept readable with good contrast. Test every screen in both themes.

## Anti-generic rules (do not do these)

- No bright/electric "startup" green — this is a deep, traditional green.
- No purple/blue gradients, no rainbow palettes.
- Don't flood the page with gold — it's a sparing accent (buttons + the footer hairline).
- No emoji as icons — use a clean line-icon set (lucide).
- Don't drop the serif headings for a plain sans — the serif _is_ the brand.
- Theme shadcn/ui with these tokens; never ship default shadcn styling.

## Reusability note (for future customers)

This is the reusable **`brand`** skill. For a different customer: change the colour tokens, fonts, logo, and signature-component details **in this file**, and re-skin from here. Keep exactly one brand skill — never create a second.
