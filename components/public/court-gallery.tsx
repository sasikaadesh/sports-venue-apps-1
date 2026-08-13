"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

export function CourtGallery({
  images,
  courtName,
}: {
  images: string[];
  courtName: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-lg border border-dashed bg-muted text-muted-foreground">
        <span className="flex flex-col items-center gap-2 text-sm">
          <ImageOff className="size-6" />
          No photos yet
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Same radius as the court cards this photo was clicked through from. */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border bg-muted">
        <Image
          src={images[active]}
          alt={`${courtName} — photo ${active + 1} of ${images.length}`}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((url, i) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                  i === active
                    ? "border-primary"
                    : "border-transparent hover:border-border"
                )}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="15vw"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
