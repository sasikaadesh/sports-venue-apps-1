import type { NextRequest } from "next/server";

import { applyPayHereNotification } from "@/lib/payment-service";

/**
 * PayHere `notify_url` — the server-to-server payment callback.
 *
 * **This is the only path in the app that can confirm a booking** (CLAUDE.md).
 * The `return_url` the browser lands on is a redirect the user controls and is
 * trivially spoofed, so it never writes anything.
 *
 * Unauthenticated by design: the caller is PayHere's server, which has no
 * session and no cookie. Its authority is the `md5sig` field, verified against
 * the merchant secret inside `applyPayHereNotification`. Anything that fails
 * that check is a stranger POSTing at a public URL and is refused.
 *
 * The body is `application/x-www-form-urlencoded`, not JSON.
 */

// Never prerendered, never cached — it is a side-effecting POST endpoint.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value;
  }

  const result = await applyPayHereNotification(fields);

  // PayHere retries anything that is not 2xx. So "we processed this and there
  // is nothing more to do" — including cases we deliberately ignore — answers
  // 200; only a request that is not from PayHere, or that we could not process
  // at all, gets an error status.
  return new Response(result.message, { status: result.status });
}

/**
 * A GET here is someone poking the URL in a browser, never PayHere. Answering
 * plainly makes "is the webhook deployed?" checkable without implying that
 * anything can be triggered this way.
 */
export function GET() {
  return new Response("PayHere notify endpoint. POST only.", { status: 405 });
}
