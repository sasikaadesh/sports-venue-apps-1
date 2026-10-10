import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { CourtForm } from "@/components/admin/court-form";
import { requireAdmin } from "@/lib/auth";
import { suggestNextCourtColor } from "@/lib/court-colors";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New court — Admin" };

export default async function NewCourtPage() {
  await requireAdmin("/admin/courts/new");

  const [courtTypes, existingColors] = await Promise.all([
    prisma.courtType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.court.findMany({
      where: { isActive: true },
      select: { color: true },
    }),
  ]);

  // A court cannot exist without a type, so there is nothing to show yet.
  if (courtTypes.length === 0) redirect("/admin/court-types");

  return (
    <>
      <PageHeader
        title="New court"
        description="Create the court, then add its weekly slot schedule on the next screen."
      />

      <div className="max-w-2xl">
        <CourtForm
          courtTypes={courtTypes}
          suggestedColor={suggestNextCourtColor(
            existingColors.map((c) => c.color)
          )}
        />
      </div>
    </>
  );
}
