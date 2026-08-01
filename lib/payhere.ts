import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * PayHere primitives: configuration, the checkout hash, and `md5sig`
 * verification.
 *
 * `import "server-only"` is the hard guarantee that `PAYHERE_MERCHANT_SECRET`
 * can never be bundled into client code (CLAUDE.md) — importing this module
 * from a Client Component is a build error, not a runtime leak. Nothing here
 * returns the secret; the only thing that ever crosses to the browser is a
 * hash computed from it.
 *
 * **MD5 is PayHere's specification, not a choice.** Both the checkout hash and
 * the webhook signature are defined by PayHere as MD5, so they are what they
 * are. What makes the webhook trustworthy is that the signature covers the
 * merchant id, order id, amount, currency and status code, and cannot be
 * produced without the secret — which only ever exists on the server.
 */

/** The only currency the venue sells in. */
export const PAYHERE_CURRENCY = "LKR";

export type PayHereConfig = {
  merchantId: string;
  /** Server-only. Never returned to a caller that could serialise it. */
  secret: string;
  sandbox: boolean;
};

/**
 * Credentials, or `null` when PayHere is not configured.
 *
 * Returning null rather than throwing keeps the rest of the app runnable
 * without payment credentials — the Pay button reports that checkout is
 * unavailable instead of the page crashing.
 */
export function payhereConfig(): PayHereConfig | null {
  const merchantId = process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID?.trim();
  const secret = process.env.PAYHERE_MERCHANT_SECRET?.trim();

  if (!merchantId || !secret) return null;

  return {
    merchantId,
    secret,
    // Anything that is not explicitly "live" is treated as sandbox: a typo in
    // this variable must never silently start taking real money.
    sandbox: (process.env.NEXT_PUBLIC_PAYHERE_MODE?.trim() || "sandbox") !== "live",
  };
}

function md5Upper(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex").toUpperCase();
}

/**
 * The shared shape of both PayHere digests:
 *
 *   MD5( merchant_id + order_id + amount + currency + [status_code] + MD5(secret) )
 *
 * The checkout hash omits the status code; the notification signature includes
 * it. `amount` must be exactly the string PayHere will use — two decimals, no
 * separators — or the digests will not match.
 */
function digest(parts: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  statusCode?: string;
  secret: string;
}): string {
  return md5Upper(
    parts.merchantId +
      parts.orderId +
      parts.amount +
      parts.currency +
      (parts.statusCode ?? "") +
      md5Upper(parts.secret)
  );
}

/** The `hash` field handed to the checkout popup. Computed on the server only. */
export function checkoutHash(input: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  secret: string;
}): string {
  return digest(input);
}

/**
 * Is this webhook really from PayHere, and about the payment it claims?
 *
 * This is the single security boundary of the whole payment flow: a booking is
 * confirmed on the strength of this check and nothing else (CLAUDE.md — the
 * `return_url` redirect can be spoofed and never confirms anything).
 *
 * Compared in constant time. An MD5 hex string is not a secret, but comparing
 * digests with `===` is the habit that eventually leaks a real one.
 */
export function verifyNotificationSignature(input: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  statusCode: string;
  md5sig: string;
  secret: string;
}): boolean {
  const expected = digest(input);
  const received = input.md5sig.trim().toUpperCase();

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");

  // timingSafeEqual throws on a length mismatch, so screen that first.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What PayHere's numeric `status_code` means. */
export type PayHereOutcome =
  | "success"
  | "pending"
  | "cancelled"
  | "failed"
  | "chargedback"
  | "unknown";

/**
 * PayHere status codes: 2 paid, 0 pending, -1 cancelled, -2 failed,
 * -3 charged back. Anything else is treated as unknown and changes nothing —
 * an unrecognised code must never be read as "paid".
 */
export function outcomeForStatusCode(code: string): PayHereOutcome {
  switch (code.trim()) {
    case "2":
      return "success";
    case "0":
      return "pending";
    case "-1":
      return "cancelled";
    case "-2":
      return "failed";
    case "-3":
      return "chargedback";
    default:
      return "unknown";
  }
}
