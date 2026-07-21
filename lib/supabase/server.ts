import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Server Components, server actions and route handlers.
 *
 * Reads the session from cookies and writes refreshed tokens back. Still uses
 * the anon key, so RLS applies — this client acts *as the logged-in user*.
 *
 * Must be created per-request (never cached in a module-level variable), or
 * one user's session would leak into another's request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, which cannot write cookies.
            // The middleware refreshes the session instead, so this is safe
            // to swallow.
          }
        },
      },
    }
  );
}
