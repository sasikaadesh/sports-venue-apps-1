"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/admin/native-select";
import { setSpecialRequestStatusAction } from "@/app/admin/special-requests/actions";
import {
  SPECIAL_REQUEST_STATUS_LABELS as STATUS_LABELS,
  SPECIAL_REQUEST_STATUSES,
  type SpecialRequestStatusValue,
} from "@/lib/validations";

/** Status picker for one request. The action re-checks admin on the server. */
export function SpecialRequestStatus({
  id,
  status,
}: {
  id: string;
  status: SpecialRequestStatusValue;
}) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();

  function onChange(next: SpecialRequestStatusValue) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setSpecialRequestStatusAction(id, next);
      if (result.ok) {
        toast.success(`Marked ${STATUS_LABELS[next].toLowerCase()}.`);
      } else {
        setValue(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="w-36">
      <NativeSelect
        aria-label="Request status"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as SpecialRequestStatusValue)}
        className="h-9"
      >
        {SPECIAL_REQUEST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
