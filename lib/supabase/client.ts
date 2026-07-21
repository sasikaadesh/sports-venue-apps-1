import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components.
 *
 * Only ever sees the anon key, so every query it makes is subject to RLS.
 * Never use this to make an authorization decision — it runs in the browser
 * and the user controls it. Authorization belongs in server actions, route
 * handlers, and RLS policies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
