import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. **Bypasses RLS entirely.**
 *
 * `import "server-only"` above makes the build fail if this file is ever
 * pulled into a Client Component, so the service-role key can never reach
 * the browser.
 *
 * Use only for admin/back-office operations that have *already* passed an
 * explicit server-side authorization check (see `requireAdmin()` in
 * `lib/auth.ts`). Never hand it a user-supplied filter without validating it.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
