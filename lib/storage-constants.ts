/**
 * Storage limits shared by the server upload code and the client picker.
 *
 * Kept apart from `lib/storage.ts` because that module is `server-only` — the
 * client form needs these numbers to show limits, but must never pull the
 * service-role client into the bundle.
 */

export const COURT_IMAGES_BUCKET = "court-images";

/** Keep in sync with the bucket's file_size_limit in the storage migration. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGES_PER_COURT = 8;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
