# DESIGN — Clean & Sporty

Direction: bright, energetic, confident. Modern athletic-brand feel. Lots of white space, one bold accent, big bold headings, strong photography. The site should look intentionally designed, not templated.

## Color

- **Accent (primary):** electric green — start with `#16DB65` (adjust to taste). Used for primary buttons, active states, key highlights. **One** accent — don't add a second competing bright color.
- **Ink (text/dark):** near-black `#0A0A0A` for headings and body text.
- **Neutrals:** white `#FFFFFF` backgrounds; zinc grays (`#F4F4F5`, `#71717A`) for surfaces, borders, secondary text.
- **Optional secondary accent** for rare emphasis only (e.g. a warm orange `#FF6A00`) — use sparingly, if at all.

**Never:** purple→blue gradients, rainbow palettes, low-contrast gray-on-gray.

## Typography

- **Headings:** a bold geometric/grotesque sans — **Space Grotesk** or **Sora** (both free via `next/font/google`). Large, tight tracking, heavy weight. Headlines should feel confident and big.
- **Body:** **Inter** (via `next/font/google`), comfortable size and line-height.
- Establish a real type scale with clear hierarchy — don't let headings and body blur together.

## Layout & shape

- Generous, consistent spacing (a clear spacing scale). Let sections breathe.
- **Low, simple hero** — a clean band, not a full-screen takeover. Booking dropdown lives here.
- Court **thumbnails** in a tidy grid; consistent aspect-ratio images.
- Cards: medium radius (`rounded-xl`), subtle borders/shadows — not pill-shaped everything, not flat gray boxes.
- Left-align most content; avoid centering everything on the page.

## Imagery

- Real, energetic sports photography. **Unsplash placeholders for now** (`images.unsplash.com`), swapped for the client's real court photos later via the admin panel.
- Always via Next.js `<Image>` (sizing, lazy-load, egress-friendly).

## Icons & details

- **lucide-react** icons (ships with shadcn/ui). **No emoji as icons.**
- Subtle hover states (slight lift/scale on cards and buttons), smooth but minimal motion — no gratuitous animation.
- Considered empty states and loading states — they signal care.

## shadcn/ui

Use it as the component base, but **theme it with the tokens above** (colors, radius, fonts). Do not ship default shadcn styling — the un-themed look is itself becoming a recognizable "generated" tell.

## Quick anti-generic checklist

- [ ] Distinctive heading font, not system default
- [ ] One committed accent, no default gradient
- [ ] Real whitespace and hierarchy
- [ ] lucide icons, no emoji
- [ ] Themed shadcn, not defaults
- [ ] Left-aligned, varied layout (not everything centered)
- [ ] Hover/empty/loading states considered
