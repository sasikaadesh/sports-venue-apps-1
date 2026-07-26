import type { Metadata } from "next";

import { CourtCard } from "@/components/public/court-card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Courts — Courtside",
  description: "Browse every court available to book.",
};

export default async function CourtsPage() {
  const courts = await prisma.court.findMany({
    where: { isActive: true },
    orderBy: [{ courtType: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      images: true,
      courtType: { select: { name: true } },
      slots: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        take: 1,
        select: { price: true },
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
      <div className="flex flex-col gap-2 pb-10">
        <h1 className="text-4xl leading-none">Courts</h1>
        <p className="max-w-prose text-muted-foreground">
          {courts.length > 0
            ? "Every court we run. Open one to see its photos, prices and available times."
            : "No courts are published yet — check back shortly."}
        </p>
      </div>

      {courts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          Nothing to show yet.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court, i) => (
            <li key={court.id}>
              <CourtCard
                priority={i < 3}
                court={{
                  id: court.id,
                  name: court.name,
                  typeName: court.courtType.name,
                  image: court.images[0] ?? null,
                  fromPrice: court.slots[0]?.price.toString() ?? null,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
