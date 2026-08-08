import { z } from "zod";

import { MAX_DURATION_HOURS } from "@/lib/slots";

/**
 * Validation schemas shared by the client forms and the server actions.
 *
 * The client copy gives instant feedback; the server copy is the one that
 * actually matters — a server action is a public HTTP endpoint and can be
 * called without ever loading the form.
 */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Whole hours only — slot templates are strictly 1-hour blocks, so an operating
// range must start and end on the hour.
const HOUR_RE = /^([01]\d|2[0-3]):00$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const priceField = z.coerce
  .number<number>()
  .min(0, "Price cannot be negative.")
  .max(1_000_000, "That price looks wrong.");

const dayOfWeekField = z.coerce.number<number>().int().min(0).max(6);

// ---------------------------------------------------------------------------
// Accounts — credentials and profile
// ---------------------------------------------------------------------------

/**
 * Deliberately permissive: Sri Lankan numbers get written as 0771234567,
 * +94 77 123 4567 or 077-123 4567, and rejecting any of those spellings would
 * only push people into entering a fake number. We check it plausibly *is* a
 * phone number (7–15 digits, optional leading +) and store it as typed.
 */
const phoneField = z
  .string()
  .trim()
  .min(1, "Enter a phone number.")
  .max(30, "That phone number is too long.")
  .refine((v) => /^\+?[\d\s().-]+$/.test(v), {
    message: "Use digits, spaces, and + ( ) - only.",
  })
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    },
    { message: "That does not look like a complete phone number." }
  );

const nameField = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(80, "Name must be 80 characters or fewer.");

const addressField = z
  .string()
  .trim()
  .min(5, "Enter your address.")
  .max(300, "Address must be 300 characters or fewer.");

/**
 * Sri Lankan NIC, in either of the two formats in circulation:
 *
 *   old — 9 digits then V or X   e.g. 123456789V
 *   new — 12 digits              e.g. 199012345678
 *
 * Normalised before it is checked: spaces stripped (people write "123456789 V")
 * and upper-cased, so `123456789v` and `123456789V` cannot become two accounts
 * for one person. The column is UNIQUE and carries the same regex as a CHECK
 * constraint, so this is the friendly layer, not the guarantee.
 *
 * SENSITIVE — see ARCHITECTURE.md. Never rendered on a public page.
 */
const nicField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
  .refine((v) => v.length > 0, { message: "Enter your NIC number." })
  .refine((v) => /^(\d{9}[VX]|\d{12})$/.test(v), {
    message: "Enter a valid NIC — 9 digits and a V (123456789V), or 12 digits.",
  });

/** The four options, and the only four. Mirrors the `Affiliation` enum. */
export const AFFILIATIONS = [
  { value: "old_boy", label: "Old Boy" },
  { value: "parent", label: "Parent" },
  { value: "staff", label: "Staff" },
  { value: "outsider", label: "Outsider" },
] as const;

export type AffiliationValue = (typeof AFFILIATIONS)[number]["value"];

export const AFFILIATION_LABEL: Record<AffiliationValue, string> =
  Object.fromEntries(AFFILIATIONS.map((a) => [a.value, a.label])) as Record<
    AffiliationValue,
    string
  >;

const affiliationField = z.enum(
  AFFILIATIONS.map((a) => a.value) as [AffiliationValue, ...AffiliationValue[]],
  { message: "Choose how you are connected to the school." }
);

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

/**
 * The profile fields a user owns and may edit.
 *
 * One schema, used by signup, the account page's Details tab and the
 * "Complete your profile" step, so the three can never ask for different
 * things. `role` is deliberately absent — the profile writer must not be able
 * to express a role change however the request is crafted.
 */
export const profileSchema = z.object({
  name: nameField,
  phone: phoneField,
  address: addressField,
  nic: nicField,
  affiliation: affiliationField,
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

/** Email/password signup collects the full profile up front. */
export const signUpSchema = profileSchema.extend({
  email: emailField,
  password: passwordField,
});

/** "Email me a reset link" — the address is all we ask for. */
export const passwordResetRequestSchema = z.object({ email: emailField });

/**
 * Setting a new password from a recovery link. The confirmation field is
 * validated server-side too: the server action is a public endpoint and can be
 * called without the form, and a mistyped password here locks someone out.
 */
export const newPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Those passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * The Google path collects everything Google cannot give us — which is now
 * phone, address, NIC and affiliation. `name` is included because the OIDC
 * claim can be absent or unhelpful, and the user should be able to correct it.
 * The same schema also catches accounts created before a field existed: they
 * are simply incomplete profiles and are asked for the missing values here.
 */
export const completeProfileSchema = profileSchema;

// ---------------------------------------------------------------------------
// Admin conduct ratings (private — never shown to the rated user)
// ---------------------------------------------------------------------------

/**
 * One conduct note. The comment is REQUIRED: a bare star is an unaccountable
 * mark on someone's record, and an admin reading the history months later
 * needs the reason, not the score. Both rules are CHECK constraints too.
 */
export const userRatingSchema = z.object({
  userId: z.uuid("Choose a user to rate."),
  rating: z.coerce
    .number<number>()
    .int()
    .min(1, "Give a rating from 1 to 5 stars.")
    .max(5, "Give a rating from 1 to 5 stars."),
  comment: z
    .string()
    .trim()
    .min(5, "Say why — at least 5 characters.")
    .max(1000, "Keep the reason to 1000 characters or fewer."),
});

/**
 * Which accounts the Users tab shows.
 *
 * The *ordering* vocabulary lives in `lib/admin-filters.ts` with the other
 * admin-table query params — it is view state, not a validated form input, and
 * it is shared with the Bookings table.
 */
export const USER_RATING_FILTERS = [
  "all",
  "flagged",
  "rated",
  "unrated",
] as const;

export type UserRatingFilter = (typeof USER_RATING_FILTERS)[number];

/** Average at or below this is "flagged" — the problem-user shortlist. */
export const FLAGGED_RATING_MAX = 2.5;

export function parseUserRatingFilter(
  value: string | undefined
): UserRatingFilter {
  return USER_RATING_FILTERS.includes(value as UserRatingFilter)
    ? (value as UserRatingFilter)
    : "all";
}

/** Public "Contact us" submission. No auth — anyone may send one. */
export const contactMessageSchema = z.object({
  name: nameField,
  email: emailField,
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters.")
    .max(2000, "Message must be 2000 characters or fewer."),
});

/** Roles an admin UI may assign. `super_admin` is never handed out this way. */
export const assignableRoleSchema = z.enum(["user", "admin"]);

export const courtTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(50, "Name must be 50 characters or fewer."),
  playerOptions: z
    .array(z.coerce.number<number>().int().min(1).max(100))
    .min(1, "Add at least one player-count option.")
    .max(12, "That is more options than a dropdown should hold.")
    // Duplicates would render as repeated dropdown entries later.
    .refine((opts) => new Set(opts).size === opts.length, {
      message: "Player-count options must be unique.",
    }),
});

export const courtSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be 80 characters or fewer."),
  courtTypeId: z.uuid("Choose a court type."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean(),
});

export const slotTemplateSchema = z
  .object({
    courtId: z.uuid(),
    dayOfWeek: dayOfWeekField,
    startTime: z.string().regex(TIME_RE, "Use HH:MM, e.g. 09:00."),
    endTime: z.string().regex(TIME_RE, "Use HH:MM, e.g. 10:00."),
    price: priceField,
    isActive: z.boolean(),
  })
  // A slot that ends before it starts would never match any availability query.
  .refine((s) => s.endTime > s.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

/**
 * Generate a full weekday of hourly slots from an operating range and a single
 * hourly rate. The server expands this into one `SlotTemplate` per hour, so the
 * admin never has to create 16 rows by hand and no oversized block is possible.
 */
export const generateScheduleSchema = z
  .object({
    courtId: z.uuid(),
    dayOfWeek: dayOfWeekField,
    startTime: z.string().regex(HOUR_RE, "Use a whole hour, e.g. 06:00."),
    endTime: z.string().regex(HOUR_RE, "Use a whole hour, e.g. 22:00."),
    price: priceField,
  })
  .refine((s) => s.endTime > s.startTime, {
    message: "The closing time must be after the opening time.",
    path: ["endTime"],
  });

/** A whole-weekday operation: bulk rate, open/close, clear. */
export const daySchema = z.object({
  courtId: z.uuid(),
  dayOfWeek: dayOfWeekField,
});

export const dayRateSchema = daySchema.extend({ price: priceField });

/** Set one rate across every hour of every weekday on a court. */
export const courtRateSchema = z.object({
  courtId: z.uuid(),
  price: priceField,
});

export const dayActiveSchema = daySchema.extend({ isActive: z.boolean() });

/** Copy one weekday's schedule onto one or more other weekdays. */
export const copyScheduleSchema = z
  .object({
    courtId: z.uuid(),
    fromDay: dayOfWeekField,
    toDays: z
      .array(dayOfWeekField)
      .min(1, "Pick at least one day to copy to.")
      .max(6, "That is more days than a week has to spare."),
  })
  // Copying a day onto itself is a no-op that would only delete-then-recreate it.
  .refine((c) => !c.toDays.includes(c.fromDay), {
    message: "A day cannot be copied onto itself.",
    path: ["toDays"],
  })
  .refine((c) => new Set(c.toDays).size === c.toDays.length, {
    message: "Duplicate target days.",
    path: ["toDays"],
  });

/** A single hour's price override. */
export const slotPriceSchema = z.object({
  slotId: z.uuid(),
  price: priceField,
});

export const blockSlotSchema = z.object({
  courtId: z.uuid(),
  slotId: z.uuid(),
  bookingDate: z.string().regex(DATE_RE, "Pick a date."),
});

/**
 * A booking request.
 *
 * Deliberately carries no price: the total is summed from the slot templates
 * on the server. Accepting an amount from the client would let anyone book six
 * hours for the price of one.
 */
export const createBookingSchema = z.object({
  courtId: z.uuid("Choose a court."),
  bookingDate: z.string().regex(DATE_RE, "Pick a date."),
  startSlotId: z.uuid("Choose a start time."),
  durationHours: z.coerce
    .number<number>()
    .int()
    .min(1, "Book at least one hour.")
    .max(MAX_DURATION_HOURS, `Book at most ${MAX_DURATION_HOURS} hours.`),
  playerCount: z.coerce
    .number<number>()
    .int()
    .min(1, "Choose the number of players."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
export type UserRatingInput = z.infer<typeof userRatingSchema>;
export type AssignableRole = z.infer<typeof assignableRoleSchema>;
export type CourtTypeInput = z.infer<typeof courtTypeSchema>;
export type CourtInput = z.infer<typeof courtSchema>;
export type SlotTemplateInput = z.infer<typeof slotTemplateSchema>;
export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type DayInput = z.infer<typeof daySchema>;
export type DayRateInput = z.infer<typeof dayRateSchema>;
export type CourtRateInput = z.infer<typeof courtRateSchema>;
export type DayActiveInput = z.infer<typeof dayActiveSchema>;
export type CopyScheduleInput = z.infer<typeof copyScheduleSchema>;
export type SlotPriceInput = z.infer<typeof slotPriceSchema>;
export type BlockSlotInput = z.infer<typeof blockSlotSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Uniform shape every admin server action returns. */
export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? { data?: never } : { data: T }))
  | { ok: false; error: string };

export function actionError(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** First human-readable message out of a ZodError. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That input is not valid.";
}
