"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The two client-side bits of a print view.
 *
 * Both are tiny and deliberately separate from the report itself, which stays a
 * server component: the document is rendered on the server, and the only thing
 * the browser is asked for is `window.print()`.
 */

/**
 * Opens the print dialog once, shortly after the report has mounted.
 *
 * The admin clicked "Print" on the table — arriving at a report and having to
 * click Print again is a step that earns nothing. The delay lets fonts and
 * layout settle first; printing mid-layout is how a report loses its heading
 * font or splits a table oddly.
 *
 * No ref guard: React runs effects twice in development, and the cleanup
 * cancels the first timer, so exactly one dialog opens either way.
 */
export function AutoPrint() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

/** Re-opens the dialog, for when the first one was dismissed. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer data-icon="inline-start" />
      Print or save as PDF
    </Button>
  );
}
