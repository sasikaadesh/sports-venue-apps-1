"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteCourt } from "@/app/admin/courts/actions";

export function DeleteCourtButton({
  courtId,
  courtName,
}: {
  courtId: string;
  courtName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Two-step confirm rather than window.confirm(), which is a blocking
  // browser dialog and looks nothing like the rest of the UI.
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCourt(courtId);
      if (result.ok) {
        toast.success(`Deleted "${courtName}".`);
        router.push("/admin/courts");
      } else {
        toast.error(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Delete this court</span>
        <span className="text-xs text-muted-foreground">
          Removes the court, its slots and its images. Only possible while it
          has no bookings — otherwise switch it to inactive.
        </span>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            className="h-9"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="ghost"
            className="h-9"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="destructive"
          className="h-9"
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
          Delete court
        </Button>
      )}
    </div>
  );
}
