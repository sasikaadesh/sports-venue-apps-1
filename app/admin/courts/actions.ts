"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { revalidateCatalogue } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";
import {
  deleteAllCourtImages,
  deleteCourtImage,
  MAX_IMAGES_PER_COURT,
  uploadCourtImages,
} from "@/lib/storage";
import {
  actionError,
  copyScheduleSchema,
  courtRateSchema,
  courtSchema,
  dayActiveSchema,
  dayRateSchema,
  daySchema,
  firstIssue,
  generateScheduleSchema,
  slotPriceSchema,
  slotTemplateSchema,
  type ActionResult,
} from "@/lib/validations";
import { DAY_NAMES, timeStringToDate } from "@/lib/time";

/**
 * Court and slot-template actions. Every one re-checks admin.
 *
 * Court fields arrive as FormData because image files ride along in the same
 * submission.
 */

function courtFieldsFrom(formData: FormData) {
  return {
    name: formData.get("name"),
    courtTypeId: formData.get("courtTypeId"),
    description: formData.get("description") ?? "",
    // FormData has no booleans — the client sends the string "true"/"false".
    isActive: formData.get("isActive") === "true",
  };
}

function imageFilesFrom(formData: FormData): File[] {
  return formData
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0);
}

export async function createCourt(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = courtSchema.safeParse(courtFieldsFrom(formData));
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const files = imageFilesFrom(formData);
  if (files.length > MAX_IMAGES_PER_COURT) {
    return actionError(
      `A court can have at most ${MAX_IMAGES_PER_COURT} images.`
    );
  }

  const type = await prisma.courtType.findUnique({
    where: { id: parsed.data.courtTypeId },
    select: { id: true },
  });
  if (!type) return actionError("That court type no longer exists.");

  // Create first so images can be filed under the court's id, then attach.
  const court = await prisma.court.create({
    data: {
      name: parsed.data.name,
      courtTypeId: parsed.data.courtTypeId,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive,
      images: [],
    },
    select: { id: true },
  });

  if (files.length > 0) {
    const upload = await uploadCourtImages(court.id, files);
    if (!upload.ok) {
      // Don't leave a half-made court behind if the images were the point.
      await prisma.court.delete({ where: { id: court.id } });
      return actionError(upload.error);
    }
    await prisma.court.update({
      where: { id: court.id },
      data: { images: upload.urls },
    });
  }

  revalidatePath("/admin/courts");
  revalidateCatalogue();
  return { ok: true, data: court };
}

export async function updateCourt(
  id: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = courtSchema.safeParse(courtFieldsFrom(formData));
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const existing = await prisma.court.findUnique({
    where: { id },
    select: { images: true },
  });
  if (!existing) return actionError("That court no longer exists.");

  const files = imageFilesFrom(formData);
  if (existing.images.length + files.length > MAX_IMAGES_PER_COURT) {
    return actionError(
      `A court can have at most ${MAX_IMAGES_PER_COURT} images. Remove some first.`
    );
  }

  let images = existing.images;
  if (files.length > 0) {
    const upload = await uploadCourtImages(id, files);
    if (!upload.ok) return actionError(upload.error);
    images = [...existing.images, ...upload.urls];
  }

  await prisma.court.update({
    where: { id },
    data: {
      name: parsed.data.name,
      courtTypeId: parsed.data.courtTypeId,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive,
      images,
    },
  });

  revalidatePath("/admin/courts");
  revalidatePath(`/admin/courts/${id}`);
  revalidateCatalogue();
  return { ok: true, data: { id } };
}

export async function removeCourtImage(
  courtId: string,
  url: string
): Promise<ActionResult> {
  await requireAdmin();

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { images: true },
  });
  if (!court) return actionError("That court no longer exists.");

  // Only drop a URL this court actually owns, so a crafted request cannot
  // delete another court's image out of storage.
  if (!court.images.includes(url)) {
    return actionError("That image does not belong to this court.");
  }

  await prisma.court.update({
    where: { id: courtId },
    data: { images: court.images.filter((u) => u !== url) },
  });
  await deleteCourtImage(url);

  revalidatePath(`/admin/courts/${courtId}`);
  revalidatePath("/admin/courts");
  revalidateCatalogue();
  return { ok: true };
}

export async function deleteCourt(id: string): Promise<ActionResult> {
  await requireAdmin();

  const court = await prisma.court.findUnique({
    where: { id },
    select: { images: true, _count: { select: { bookings: true } } },
  });
  if (!court) return actionError("That court no longer exists.");

  // Bookings are the historical record — deleting the court would orphan them,
  // and the FK would refuse anyway. Deactivating hides it from the public site
  // while keeping history intact.
  if (court._count.bookings > 0) {
    return actionError(
      `This court has ${court._count.bookings} booking(s) against it. Switch it to inactive instead of deleting.`
    );
  }

  // Slot templates cascade with the court (schema onDelete: Cascade).
  await prisma.court.delete({ where: { id } });
  await deleteAllCourtImages(court.images);

  revalidatePath("/admin/courts");
  revalidateCatalogue();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Slot templates
// ---------------------------------------------------------------------------

export async function createSlotTemplate(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = slotTemplateSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, dayOfWeek, startTime, endTime, price, isActive } =
    parsed.data;

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { id: true },
  });
  if (!court) return actionError("That court no longer exists.");

  // Overlapping slots on the same weekday would offer the same wall-clock time
  // twice, and each could be booked independently — a double-booking the
  // unique constraint cannot catch, because the slot ids differ.
  const clash = await findOverlap({ courtId, dayOfWeek, startTime, endTime });
  if (clash) return actionError(clash);

  const created = await prisma.slotTemplate.create({
    data: {
      courtId,
      dayOfWeek,
      startTime: timeStringToDate(startTime),
      endTime: timeStringToDate(endTime),
      price,
      isActive,
    },
    select: { id: true },
  });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: created };
}

export async function updateSlotTemplate(
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = slotTemplateSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, dayOfWeek, startTime, endTime, price, isActive } =
    parsed.data;

  const clash = await findOverlap({
    courtId,
    dayOfWeek,
    startTime,
    endTime,
    excludeId: id,
  });
  if (clash) return actionError(clash);

  await prisma.slotTemplate.update({
    where: { id },
    data: {
      dayOfWeek,
      startTime: timeStringToDate(startTime),
      endTime: timeStringToDate(endTime),
      price,
      isActive,
    },
  });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { id } };
}

export async function deleteSlotTemplate(id: string): Promise<ActionResult> {
  await requireAdmin();

  const slot = await prisma.slotTemplate.findUnique({
    where: { id },
    // Reserved hours, not bookings: a slot template is referenced by one
    // BookingSlot per date it has been booked on.
    select: { courtId: true, _count: { select: { bookingSlots: true } } },
  });
  if (!slot) return actionError("That slot no longer exists.");

  if (slot._count.bookingSlots > 0) {
    return actionError(
      `This slot has ${slot._count.bookingSlots} booking(s) against it. Switch it off instead of deleting.`
    );
  }

  await prisma.slotTemplate.delete({ where: { id } });

  revalidatePath(`/admin/courts/${slot.courtId}`);
  revalidateCatalogue();
  return { ok: true };
}

/**
 * Returns an error message if the given time range overlaps an existing slot
 * on the same court and weekday. Half-open comparison, so 09:00-10:00 and
 * 10:00-11:00 sit back to back without clashing.
 */
async function findOverlap(args: {
  courtId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  excludeId?: string;
}): Promise<string | null> {
  const { courtId, dayOfWeek, startTime, endTime, excludeId } = args;

  const overlap = await prisma.slotTemplate.findFirst({
    where: {
      courtId,
      dayOfWeek,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startTime: { lt: timeStringToDate(endTime) },
      endTime: { gt: timeStringToDate(startTime) },
    },
    select: { id: true },
  });

  return overlap
    ? "That overlaps an existing slot on this day. Adjust the times."
    : null;
}

// ---------------------------------------------------------------------------
// Hourly schedule generation and whole-weekday operations
// ---------------------------------------------------------------------------

const hhmm = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/**
 * Generate a full weekday of 1-hour slots from an operating range and one
 * hourly rate: 06:00–22:00 becomes sixteen slots (06:00–07:00 … 21:00–22:00),
 * each priced the same. This is how an admin sets up a day — never by hand-
 * building oversized ranges, which the booking model no longer allows.
 *
 * Refuses to run on a day that already has slots: generation is an initial
 * setup, and silently merging into an existing schedule would either clash on
 * overlaps or double a day's hours. Clear the day first.
 */
export async function generateDaySchedule(
  input: unknown
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const parsed = generateScheduleSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, dayOfWeek, startTime, endTime, price } = parsed.data;

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { id: true },
  });
  if (!court) return actionError("That court no longer exists.");

  const existing = await prisma.slotTemplate.count({
    where: { courtId, dayOfWeek },
  });
  if (existing > 0) {
    return actionError(
      `${DAY_NAMES[dayOfWeek]} already has a schedule. Clear it before generating a new one.`
    );
  }

  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));

  const data = [];
  for (let hour = startHour; hour < endHour; hour++) {
    data.push({
      courtId,
      dayOfWeek,
      startTime: timeStringToDate(hhmm(hour)),
      endTime: timeStringToDate(hhmm(hour + 1)),
      price,
      isActive: true,
    });
  }

  await prisma.slotTemplate.createMany({ data });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { count: data.length } };
}

/** Toggle a single hour on or off. Inactive slots are never offered publicly. */
export async function setSlotActive(
  slotId: string,
  isActive: boolean
): Promise<ActionResult> {
  await requireAdmin();

  const slot = await prisma.slotTemplate.findUnique({
    where: { id: slotId },
    select: { courtId: true },
  });
  if (!slot) return actionError("That slot no longer exists.");

  await prisma.slotTemplate.update({
    where: { id: slotId },
    data: { isActive },
  });

  revalidatePath(`/admin/courts/${slot.courtId}`);
  revalidateCatalogue();
  return { ok: true };
}

/** Override one hour's rate, leaving the rest of the day untouched. */
export async function updateSlotPrice(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  const parsed = slotPriceSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const slot = await prisma.slotTemplate.findUnique({
    where: { id: parsed.data.slotId },
    select: { courtId: true },
  });
  if (!slot) return actionError("That slot no longer exists.");

  await prisma.slotTemplate.update({
    where: { id: parsed.data.slotId },
    data: { price: parsed.data.price },
  });

  revalidatePath(`/admin/courts/${slot.courtId}`);
  revalidateCatalogue();
  return { ok: true };
}

/** Open or close a whole weekday by toggling every hour on it. */
export async function setDayActive(
  input: unknown
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const parsed = dayActiveSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, dayOfWeek, isActive } = parsed.data;

  const result = await prisma.slotTemplate.updateMany({
    where: { courtId, dayOfWeek },
    data: { isActive },
  });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { count: result.count } };
}

/** Bulk-set the rate for every hour on a weekday. */
export async function setDayRate(
  input: unknown
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const parsed = dayRateSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, dayOfWeek, price } = parsed.data;

  const result = await prisma.slotTemplate.updateMany({
    where: { courtId, dayOfWeek },
    data: { price },
  });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { count: result.count } };
}

/** Bulk-set the rate for every hour of every weekday on a court. */
export async function setAllDaysRate(
  input: unknown
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const parsed = courtRateSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, price } = parsed.data;

  const result = await prisma.slotTemplate.updateMany({
    where: { courtId },
    data: { price },
  });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { count: result.count } };
}

/**
 * Delete a whole weekday's schedule. Refuses if any hour on it has been booked:
 * a `SlotTemplate` with `BookingSlot` children is part of the historical record
 * (and the FK is RESTRICT). Switch those hours off instead.
 */
export async function clearDaySchedule(
  input: unknown
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, dayOfWeek } = parsed.data;

  const booked = await prisma.slotTemplate.count({
    where: { courtId, dayOfWeek, bookingSlots: { some: {} } },
  });
  if (booked > 0) {
    return actionError(
      `${DAY_NAMES[dayOfWeek]} has hours with bookings against them. Switch those off instead of clearing the day.`
    );
  }

  const result = await prisma.slotTemplate.deleteMany({
    where: { courtId, dayOfWeek },
  });

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { count: result.count } };
}

/**
 * Copy one weekday's hourly schedule onto one or more other weekdays — the fast
 * path to a full week. Each target is overwritten with the source's hours,
 * rates and active flags. A target that has any booked hour is left untouched
 * (and the whole operation is rejected), so history is never destroyed.
 */
export async function copyDaySchedule(
  input: unknown
): Promise<ActionResult<{ days: number; slots: number }>> {
  await requireAdmin();

  const parsed = copyScheduleSchema.safeParse(input);
  if (!parsed.success) return actionError(firstIssue(parsed.error));

  const { courtId, fromDay, toDays } = parsed.data;

  const source = await prisma.slotTemplate.findMany({
    where: { courtId, dayOfWeek: fromDay },
    orderBy: { startTime: "asc" },
    select: { startTime: true, endTime: true, price: true, isActive: true },
  });
  if (source.length === 0) {
    return actionError(`${DAY_NAMES[fromDay]} has no schedule to copy.`);
  }

  // Any booked hour on a target blocks the overwrite — we cannot delete a
  // SlotTemplate that holds history.
  const bookedDays = await prisma.slotTemplate.findMany({
    where: {
      courtId,
      dayOfWeek: { in: toDays },
      bookingSlots: { some: {} },
    },
    select: { dayOfWeek: true },
    distinct: ["dayOfWeek"],
  });
  if (bookedDays.length > 0) {
    const names = bookedDays.map((d) => DAY_NAMES[d.dayOfWeek]).join(", ");
    return actionError(
      `Can't overwrite ${names} — ${
        bookedDays.length === 1 ? "it has" : "they have"
      } hours with bookings. Clear those days by hand first.`
    );
  }

  const newRows = toDays.flatMap((toDay) =>
    source.map((slot) => ({
      courtId,
      dayOfWeek: toDay,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price: slot.price,
      isActive: slot.isActive,
    }))
  );

  // Replace atomically: drop each target day's existing (unbooked) slots, then
  // recreate from the source.
  await prisma.$transaction([
    prisma.slotTemplate.deleteMany({
      where: { courtId, dayOfWeek: { in: toDays } },
    }),
    prisma.slotTemplate.createMany({ data: newRows }),
  ]);

  revalidatePath(`/admin/courts/${courtId}`);
  revalidateCatalogue();
  return { ok: true, data: { days: toDays.length, slots: newRows.length } };
}
