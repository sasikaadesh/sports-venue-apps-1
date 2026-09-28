import "server-only";

/**
 * A tiny in-memory, fixed-window rate limiter for public, unauthenticated
 * write paths (currently just the contact form).
 *
 * In-memory means per-instance: on Vercel, a burst spread across multiple
 * serverless instances is not caught, and a redeploy or cold start clears the
 * table. That is an accepted trade-off for a "basic" limiter, not a bug — it
 * still stops the common case (one script hammering the endpoint from one
 * connection) with no external service or database table, and it sits behind
 * the honeypot rather than replacing it. If real spam gets past both, the
 * upgrade path is Cloudflare Turnstile (see docs/ARCHITECTURE.md → Contact
 * form spam protection), not a fancier version of this.
 */

const hits = new Map<string, { count: number; resetAt: number }>();

/** Keeps `hits` from growing without bound between windows. */
function prune(now: number) {
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
}

/**
 * True if `key` is still under `limit` submissions within `windowMs`, and
 * counts this call toward that window. Callers should key by something
 * cheap to spoof but costly to rotate at volume — an IP address is enough
 * for this to matter.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    if (hits.size > 5000) prune(now);
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}
