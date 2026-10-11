import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { BRAND, TITLE_TEMPLATE } from "@/lib/brand";

// docs/DESIGN.md: DM Sans for headings and body everywhere — it is what
// stsebastians.lk itself uses, so the booking app reads as the same
// institution rather than a separate product with its own type system. One
// variable font instance covers both `--font-heading` and `--font-sans` (see
// app/globals.css), so there is nothing to keep in sync between the two.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

// The one deliberate exception: the home hero's title, which keeps the
// elegant-serif display face from this app's earlier type system
// (`--font-display`, applied only to that one heading — see
// components/public/hero-carousel.tsx). Everything else, hero included, is
// DM Sans.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = `Check availability and book ${BRAND.name} sports courts — cricket, tennis, table tennis and more.`;

/**
 * The origin every relative metadata URL is resolved against — the crest in the
 * Open Graph card, and anything else that has to leave the site as an absolute
 * URL. Falls back to localhost so `next build` never fails on an unset env var;
 * set `NEXT_PUBLIC_BASE_URL` in production.
 */
const metadataBase = new URL(
  process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000"
);

export const metadata: Metadata = {
  metadataBase,
  // `template` applies to every nested page that sets a plain string title, so
  // no page has to repeat the school's name — and a rebrand does not mean
  // editing sixteen `title:` strings.
  title: {
    default: BRAND.appName,
    template: TITLE_TEMPLATE,
  },
  description: DESCRIPTION,
  applicationName: BRAND.appName,
  // The tab icon and the home-screen icon come from `app/icon.png` and
  // `app/apple-icon.png` by file convention — both cut from the same crest as
  // `BRAND.logo`, so there is one image behind the favicon, the header and the
  // footer. `BRAND.logo` is additionally served unhashed from `/public`, which
  // is the stable public URL to hand to anything outside the app (the Google
  // OAuth consent screen, for one) — the convention files are content-hashed
  // and their URLs change whenever the crest does.
  openGraph: {
    type: "website",
    siteName: BRAND.appName,
    title: BRAND.appName,
    description: DESCRIPTION,
    images: [
      { url: BRAND.logo, width: 641, height: 641, alt: `${BRAND.name} crest` },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes' pre-paint script sets the theme
    // class on <html> before React hydrates, so this one element legitimately
    // differs from the server render.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${playfairDisplay.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          // Light by default; there is no "system" option — the OS preference
          // is deliberately ignored, so a first visit is always the white theme.
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
