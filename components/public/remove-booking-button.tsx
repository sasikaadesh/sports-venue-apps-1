"use client";

import { useRouter } from "next/navigation";

import { RemoveSelectionDialog } from "@/components/public/remove-selection-dialog";

/**
 * Review-screen "Remove": confirms, then discards the (unconfirmed, unpaid)
 * selection by navigating back to the court's availability with no pre-filled
 * hours. No hold has been placed yet, so there is nothing to release server-side.
 */
export function RemoveBookingButton({ backHref }: { backHref: string }) {
  const router = useRouter();

  return (
    <RemoveSelectionDialog
      onConfirm={() => router.push(backHref)}
      title="Remove this booking selection?"
      description="This discards the hours you were about to book. Nothing has been reserved or paid, so nothing is lost — you can pick again anytime."
      triggerVariant="outline"
      triggerClassName="h-10"
    />
  );
}
