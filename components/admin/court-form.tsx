"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/admin/native-select";
import { courtSchema, type CourtInput } from "@/lib/validations";
import { MAX_IMAGES_PER_COURT } from "@/lib/storage-constants";
import { createCourt, updateCourt } from "@/app/admin/courts/actions";

export type CourtTypeOption = { id: string; name: string };

type CourtFormProps = {
  courtTypes: CourtTypeOption[];
  /** Omitted when creating. */
  court?: {
    id: string;
    name: string;
    courtTypeId: string;
    description: string | null;
    isActive: boolean;
    imageCount: number;
  };
};

export function CourtForm({ courtTypes, court }: CourtFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!court;
  const remainingSlots = MAX_IMAGES_PER_COURT - (court?.imageCount ?? 0);

  const form = useForm<CourtInput>({
    resolver: zodResolver(courtSchema),
    defaultValues: {
      name: court?.name ?? "",
      courtTypeId: court?.courtTypeId ?? "",
      description: court?.description ?? "",
      isActive: court?.isActive ?? true,
    },
  });

  // useWatch rather than form.watch(), which would defeat React Compiler
  // memoization for this component.
  const isActive = useWatch({ control: form.control, name: "isActive" });

  // Previews are derived from the file list, not stored — setting state in an
  // effect would cause a cascading second render on every pick.
  const previews = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files]
  );

  // The effect's only job is releasing the object URLs, which are an external
  // resource that leaks until revoked.
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews]
  );

  function addFiles(picked: FileList | null) {
    if (!picked) return;
    const next = [...files, ...Array.from(picked)];

    if (next.length > remainingSlots) {
      toast.error(
        `You can add ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} to this court.`
      );
      return;
    }
    setFiles(next);
    // Let the same file be re-picked after removal.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(values: CourtInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("courtTypeId", values.courtTypeId);
      formData.set("description", values.description ?? "");
      formData.set("isActive", String(values.isActive));
      files.forEach((f) => formData.append("images", f));

      const result = isEdit
        ? await updateCourt(court.id, formData)
        : await createCourt(formData);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setFiles([]);
      toast.success(isEdit ? "Court saved." : `Created "${values.name}".`);

      if (isEdit) router.refresh();
      else router.push(`/admin/courts/${result.data.id}`);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
    >
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldLabel htmlFor="court-name" className="text-sm font-medium">
          Court name
        </FieldLabel>
        <Input
          id="court-name"
          placeholder="Centre Court"
          className="h-10 rounded-xl"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <FieldError>{form.formState.errors.name.message}</FieldError>
        )}
      </Field>

      <Field data-invalid={!!form.formState.errors.courtTypeId}>
        <FieldLabel htmlFor="court-type" className="text-sm font-medium">
          Court type
        </FieldLabel>
        <NativeSelect id="court-type" {...form.register("courtTypeId")}>
          <option value="">Choose a type…</option>
          {courtTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        {form.formState.errors.courtTypeId && (
          <FieldError>{form.formState.errors.courtTypeId.message}</FieldError>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="court-description" className="text-sm font-medium">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea
          id="court-description"
          rows={4}
          placeholder="Floodlit clay court, changing rooms alongside."
          className="rounded-xl"
          {...form.register("description")}
        />
        {form.formState.errors.description && (
          <FieldError>{form.formState.errors.description.message}</FieldError>
        )}
      </Field>

      <Field orientation="horizontal" className="items-center justify-between rounded-xl border px-4 py-3">
        <span className="flex flex-col gap-0.5">
          <FieldLabel htmlFor="court-active" className="text-sm font-medium">
            Active
          </FieldLabel>
          <span className="text-xs text-muted-foreground">
            Inactive courts stay in the admin panel but are hidden from the
            public site.
          </span>
        </span>
        <Switch
          id="court-active"
          checked={isActive}
          onCheckedChange={(checked) => form.setValue("isActive", checked)}
        />
      </Field>

      {/* Image picker — files upload with the form submit. */}
      <Field>
        <FieldLabel className="text-sm font-medium">
          {isEdit ? "Add more images" : "Images"}{" "}
          <span className="font-normal text-muted-foreground">
            (JPEG, PNG, WebP or AVIF · max 5 MB each)
          </span>
        </FieldLabel>

        {previews.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {previews.map((src, i) => (
              <li
                key={src}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
              >
                {/* Local blob preview, not a remote asset — plain <img> is
                    correct here; next/image cannot optimise a blob: URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Selected image ${i + 1}`}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg bg-background/90 text-foreground shadow-sm transition-colors hover:text-destructive"
                  aria-label={`Remove selected image ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={remainingSlots - files.length <= 0}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus />
            Choose images
          </Button>
          <span className="text-xs text-muted-foreground">
            {files.length > 0
              ? `${files.length} ready to upload`
              : `${Math.max(remainingSlots - files.length, 0)} slot(s) available`}
          </span>
        </div>
      </Field>

      <div className="flex items-center gap-2 border-t pt-6">
        <Button type="submit" disabled={pending} className="h-10">
          <Save />
          {pending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Create court"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10"
          disabled={pending}
          onClick={() => router.push("/admin/courts")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
