import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { CourtForm } from "@/components/admin/court-form";
import { CourtImages } from "@/components/admin/court-images";
import { DeleteCourtButton } from "@/components/admin/delete-court-button";
import { SlotTemplateManager } from "@/components/admin/slot-template-manager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateToTimeString } from "@/lib/time";

export default async function EditCourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/courts/${id}`);

  const [court, courtTypes] = await Promise.all([
    prisma.court.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        courtTypeId: true,
        description: true,
        isActive: true,
        images: true,
        courtType: { select: { name: true } },
        slots: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            price: true,
            isActive: true,
            _count: { select: { bookingSlots: true } },
          },
        },
      },
    }),
    prisma.courtType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!court) notFound();

  // Prisma's Decimal and Date objects are not plain values — convert them to
  // strings here so they cross the server/client boundary cleanly and the
  // client never has to guess at time-zone handling.
  const slots = court.slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: dateToTimeString(s.startTime),
    endTime: dateToTimeString(s.endTime),
    price: s.price.toString(),
    isActive: s.isActive,
    bookingCount: s._count.bookingSlots,
  }));

  return (
    <>
      <LinkButton
        href="/admin/courts"
        variant="ghost"
        className="-ml-2.5 mb-6 h-9"
      >
        <ArrowLeft />
        All courts
      </LinkButton>

      <div className="flex flex-wrap items-center gap-3 pb-8">
        <h1 className="text-3xl leading-none">{court.name}</h1>
        <Badge variant="secondary">{court.courtType.name}</Badge>
        {!court.isActive && <Badge variant="outline">Inactive</Badge>}
      </div>

      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Images</h2>
            <p className="text-sm text-muted-foreground">
              The first image is the thumbnail shown on the public court grid.
            </p>
          </div>
          <CourtImages courtId={court.id} images={court.images} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg">Details</h2>
          <div className="max-w-2xl">
            <CourtForm
              courtTypes={courtTypes}
              court={{
                id: court.id,
                name: court.name,
                courtTypeId: court.courtTypeId,
                description: court.description,
                isActive: court.isActive,
                imageCount: court.images.length,
              }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Weekly slot schedule</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Set each weekday&apos;s opening hours and hourly rate — the system
              generates one bookable 1-hour slot per hour. Adjust or switch off
              individual hours, close a whole day, or copy one day&apos;s
              schedule across the week.
            </p>
          </div>
          <SlotTemplateManager courtId={court.id} slots={slots} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg">Danger zone</h2>
          <DeleteCourtButton courtId={court.id} courtName={court.name} />
        </section>
      </div>
    </>
  );
}
