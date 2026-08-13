import type { Metadata } from "next";
import { Geist_Mono, Inter, Lora } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { BRAND, TITLE_TEMPLATE } from "@/lib/brand";

// docs/DESIGN.md: an elegant serif for headings, Inter for body.
//
// Lora over Playfair Display or Cormorant (the brand skill lists all three as
// acceptable): this app is not just a marketing site — it has admin tables,
// dialogs and card headers where h3 lands at 16-18px. Playfair's high stroke
// contrast thins out and turns fragile at that size, while Lora's sturdier
// serifs stay crisp. It carries the heritage feel at hero size and survives the
// small stuff, which the other two do not.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // `template` applies to every nested page that sets a plain string title, so
  // no page has to repeat the school's name — and a rebrand does not mean
  // editing sixteen `title:` strings.
  title: {
    default: BRAND.appName,
    template: TITLE_TEMPLATE,
  },
  description: `Check availability and book ${BRAND.name} sports courts — cricket, tennis, table tennis and more.`,
  applicationName: BRAND.appName,
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
      className={`${lora.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
