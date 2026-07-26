import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  COURT_IMAGES_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_COURT,
} from "@/lib/storage-constants";

/**
 * Court image storage.
 *
 * Uploads go through the service-role client, so **every caller must have
 * passed `requireAdmin()` first** — there is no authorization check in here.
 */

export { COURT_IMAGES_BUCKET, MAX_IMAGE_BYTES, MAX_IMAGES_PER_COURT };

/**
 * Extension is derived from the sniffed MIME type, never from the uploaded
 * filename — a filename is attacker-controlled and could carry a path or a
 * misleading extension.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type UploadResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

function publicUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${COURT_IMAGES_BUCKET}/${path}`;
}

/** Recover the object path from a public URL, or null if it isn't one of ours. */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${COURT_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}

/**
 * Upload images for a court. Returns the public URLs, in the order given.
 *
 * Files are stored under `<courtId>/<uuid>.<ext>` so a court's images are easy
 * to find and purge together.
 */
export async function uploadCourtImages(
  courtId: string,
  files: File[]
): Promise<UploadResult> {
  const usable = files.filter((f) => f.size > 0);
  if (usable.length === 0) return { ok: true, urls: [] };

  for (const file of usable) {
    if (!MIME_EXTENSIONS[file.type]) {
      return {
        ok: false,
        error: `"${file.name}" is a ${file.type || "unknown"} file. Use JPEG, PNG, WebP or AVIF.`,
      };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`,
      };
    }
  }

  const supabase = createAdminClient();
  const uploaded: string[] = [];

  for (const file of usable) {
    const path = `${courtId}/${crypto.randomUUID()}.${MIME_EXTENSIONS[file.type]}`;

    const { error } = await supabase.storage
      .from(COURT_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      // Roll back what this call already uploaded, so a partial failure does
      // not leave orphaned objects nobody can see or delete from the UI.
      if (uploaded.length > 0) {
        await supabase.storage.from(COURT_IMAGES_BUCKET).remove(uploaded);
      }
      return { ok: false, error: `Upload failed: ${error.message}` };
    }

    uploaded.push(path);
  }

  return { ok: true, urls: uploaded.map(publicUrlFor) };
}

/** Delete one image by its public URL. Ignores URLs from anywhere else. */
export async function deleteCourtImage(url: string): Promise<void> {
  const path = pathFromPublicUrl(url);
  if (!path) return;

  const supabase = createAdminClient();
  await supabase.storage.from(COURT_IMAGES_BUCKET).remove([path]);
}

/** Delete every stored image for a court — used when the court is deleted. */
export async function deleteAllCourtImages(urls: string[]): Promise<void> {
  const paths = urls
    .map(pathFromPublicUrl)
    .filter((p): p is string => p !== null);

  if (paths.length === 0) return;

  const supabase = createAdminClient();
  await supabase.storage.from(COURT_IMAGES_BUCKET).remove(paths);
}
