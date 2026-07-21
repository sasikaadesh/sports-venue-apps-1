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
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
