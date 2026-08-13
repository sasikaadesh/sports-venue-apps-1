"use client";

import Image from "next/image";
import { useTransition } from "react";
import { ImageOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeCourtImage } from "@/app/admin/courts/actions";

export function CourtImages({
  courtId,
  images,
}: {
  courtId: string;
  images: string[];
}) {
  const [pending, startTransition] = useTransition();

  if (images.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed px-5 py-6 text-sm text-muted-foreground">
        <ImageOff className="size-4 shrink-0" />
        No images yet. Add some with the form below — the first one is used as
        the court&apos;s thumbnail.
      </div>
    );
  }

  function handleRemove(url: string) {
    startTransition(async () => {
      const result = await removeCourtImage(courtId, url);
      if (result.ok) toast.success("Image removed.");
      else toast.error(result.error);
    });
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((url, i) => (
        <li
          key={url}
          className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
        >
          <Image
            src={url}
            alt={`Court image ${i + 1}`}
            fill
            sizes="(min-width: 640px) 25vw, 50vw"
            className="object-cover"
          />

          {i === 0 && (
            <span className="absolute top-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-xs font-medium">
              Thumbnail
            </span>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => handleRemove(url)}
            className="absolute top-1.5 right-1.5 grid size-7 place-items-center bg-background/90 text-foreground shadow-sm transition-colors hover:text-destructive disabled:opacity-50"
            aria-label={`Remove court image ${i + 1}`}
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
