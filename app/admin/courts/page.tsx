import Image from "next/image";
import Link from "next/link";
import { Home, ImageOff, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Courts — Admin" };

export default async function CourtsPage() {
  await requireAdmin("/admin/courts");

  const [courts, courtTypeCount] = await Promise.all([
    prisma.court.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        images: true,
        isActive: true,
        courtType: { select: { name: true } },
        _count: { select: { slots: true, bookings: true } },
      },
    }),
    prisma.courtType.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Courts"
        description="Every court, with its type, its photos and its weekly schedule."
        action={
          courtTypeCount > 0 ? (
            <LinkButton href="/admin/courts/new" className="h-10">
              <Plus />
              New court
            </LinkButton>
          ) : undefined
        }
      />

      {courtTypeCount === 0 ? (
        <EmptyState
          icon={<Home className="size-5" />}
          title="Add a court type first"
          description="Every court belongs to a court type, which also defines the allowed player counts. Create one, then come back here."
          action={
            <LinkButton
              href="/admin/court-types"
              variant="outline"
              className="mt-1 h-10"
            >
              Go to court types
            </LinkButton>
          }
        />
      ) : courts.length === 0 ? (
        <EmptyState
          icon={<Home className="size-5" />}
          title="No courts yet"
          description="Create your first court, add a few photos, then give it a weekly slot schedule so people can book it."
          action={
            <LinkButton href="/admin/courts/new" className="mt-1 h-10">
              <Plus />
              New court
            </LinkButton>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <li key={court.id}>
              <Link
                href={`/admin/courts/${court.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {court.images[0] ? (
                    <Image
                      src={court.images[0]}
                      alt={court.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                      <ImageOff className="size-6" />
                    </span>
                  )}
                  {!court.isActive && (
                    <span className="absolute top-2 left-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="leading-tight font-medium">
                      {court.name}
                    </span>
                    <Badge variant="secondary">{court.courtType.name}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {court._count.slots} slot
                    {court._count.slots === 1 ? "" : "s"} ·{" "}
                    {court._count.bookings} booking
                    {court._count.bookings === 1 ? "" : "s"} ·{" "}
                    {court.images.length} image
                    {court.images.length === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
