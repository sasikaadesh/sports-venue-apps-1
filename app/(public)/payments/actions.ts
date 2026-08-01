"use server";

import { requireUser } from "@/lib/auth";
import { startCheckout, type PayHereCheckoutParams } from "@/lib/payment-service";
import { actionError, type ActionResult } from "@/lib/validations";

/**
 * Open checkout for one of your own pending bookings.
 *
 * The action takes an id and nothing else — no amount, no currency, no
 * merchant fields. Everything PayHere is shown is derived on the server from
 * the stored booking, and the hash is computed from the merchant secret here,
 * where it cannot reach the browser (CLAUDE.md).
 *
 * A server action is a public HTTP endpoint, so the identity comes from the
 * session and ownership is re-checked inside the payment service — not from
 * anything the caller sent.
 */
export async function startCheckoutAction(
  bookingId: string
): Promise<ActionResult<PayHereCheckoutParams>> {
  const user = await requireUser(`/bookings/${bookingId}`);

  const result = await startCheckout(bookingId, user);
  if (!result.ok) return actionError(result.error);

  return { ok: true, data: result.data };
}
