import { PageHeader } from "@/components/admin/page-header";
import { CourtTypeManager } from "@/components/admin/court-type-manager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Court types — Admin" };

export default async function CourtTypesPage() {
  await requireAdmin("/admin/court-types");

  const courtTypes = await prisma.courtType.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      playerOptions: true,
      _count: { select: { courts: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Court types"
        description="Group courts by sport and define how many players each type allows. The player-count options set here drive the booking dropdown."
      />

      <CourtTypeManager
        courtTypes={courtTypes.map((t) => ({
          id: t.id,
          name: t.name,
          playerOptions: t.playerOptions,
          courtCount: t._count.courts,
        }))}
      />
    </>
  );
}
