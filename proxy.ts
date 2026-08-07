import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh ONLY. (Next.js 16 renamed the `middleware` convention to
 * `proxy`; this is the same interception layer.)
 *
 * Supabase access tokens are short-lived; Server Components cannot write
 * cookies, so the refreshed token has to be written here.
 *
 * This proxy deliberately makes NO authorization decisions and performs NO
 * redirects. This layer can be bypassed with a forged
 * `x-middleware-subrequest` header (CVE-2025-29927), so treating it as a
 * security boundary would mean protected routes could be reached by anyone.
 * Every protected page/action/handler calls `requireUser()` / `requireAdmin()`
 * from `lib/auth.ts` itself, and RLS backs that up in Postgres.
 */

/**
 * Refresh only when the token is actually close to expiring.
 *
 * Access tokens last an hour, but `getUser()` is a network call to Supabase's
 * auth server, and this proxy runs in front of **every** request — every page,
 * every navigation, every RSC prefetch. That was one unavoidable
 * server-to-server round trip added to every single one, almost always to
 * re-affirm a token with fifty-odd minutes left on it.
 *
 * Five minutes of headroom is far more than the seconds a request takes, and it
 * absorbs any clock skew between this function and Supabase.
 */
const REFRESH_MARGIN_SECONDS = 5 * 60;

/**
 * Seconds left on the access token in the request's cookies, or `null` when
 * that cannot be established with certainty.
 *
 * `null` is the safe answer and every unexpected shape returns it: no cookie, a
 * cookie format this does not recognise, a token with no `exp`. The caller then
 * does exactly what it always did and asks the auth server. This function can
 * only ever *skip* a refresh it is sure is unnecessary — it never decides that
 * somebody is signed in, which is `lib/auth.ts`'s job alone.
 */
function secondsUntilExpiry(request: NextRequest): number | null {
  try {
    // @supabase/ssr stores the session as JSON in `sb-<ref>-auth-token`, and
    // splits it across `.0`, `.1`, … when it outgrows one cookie.
    const chunks = request.cookies
      .getAll()
      .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

    if (chunks.length === 0) return null;

    const raw = chunks.map((c) => c.value).join("");
    const json = raw.startsWith("base64-")
      ? atob(raw.slice("base64-".length))
      : raw;

    const accessToken: unknown = JSON.parse(json)?.access_token;
    if (typeof accessToken !== "string") return null;

    // Decode the JWT payload — read only, NOT a verification. Nothing is
    // trusted from it: an attacker forging a far-future `exp` only buys
    // themselves a skipped token refresh, and still fails `getUser()` on the
    // page itself.
    const payload = accessToken.split(".")[1];
    if (!payload) return null;

    const claims: unknown = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    const exp = (claims as { exp?: unknown })?.exp;
    if (typeof exp !== "number") return null;

    return exp - Math.floor(Date.now() / 1000);
  } catch {
    // Anything unexpected: fall back to asking Supabase.
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const remaining = secondsUntilExpiry(request);
  if (remaining !== null && remaining > REFRESH_MARGIN_SECONDS) {
    // Plenty of life left: there is nothing to refresh and no cookie to write.
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what triggers the refresh-and-set-cookie cycle.
  // Its result is intentionally ignored here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
