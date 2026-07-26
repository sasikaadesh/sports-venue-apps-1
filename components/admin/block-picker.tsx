"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/admin/native-select";

/**
 * Court + date picker. Selection lives in the URL so the page stays
 * server-rendered, shareable and refresh-safe.
 */
export function BlockPicker({
  courts,
  courtId,
  date,
}: {
  courts: { id: string; name: string }[];
  courtId: string;
  date: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: "courtId" | "date", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/admin/blocks?${params.toString()}`);
  }

  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="block-court" className="text-sm font-medium">
          Court
        </FieldLabel>
        <NativeSelect
          id="block-court"
          value={courtId}
          onChange={(e) => update("courtId", e.target.value)}
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="block-date" className="text-sm font-medium">
          Date
        </FieldLabel>
        <Input
          id="block-date"
          type="date"
          value={date}
          onChange={(e) => update("date", e.target.value)}
          className="h-10 rounded-xl"
        />
      </Field>
    </div>
  );
}
