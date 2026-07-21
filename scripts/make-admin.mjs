/**
 * Promote (or demote) a user by email.
 *
 *   npm run make-admin -- you@example.com
 *   npm run make-admin -- you@example.com user     # demote back
 *
 * Uses the service-role key, which bypasses RLS — that is why this is a local
 * CLI script and not an app route. Never expose this logic over HTTP without a
 * `requireAdmin()` check in front of it.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const [email, role = "admin"] = process.argv.slice(2);

if (!email) {
  console.error("Usage: npm run make-admin -- <email> [admin|user]");
  process.exit(1);
}

if (role !== "admin" && role !== "user") {
  console.error(`Invalid role "${role}". Use "admin" or "user".`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find the auth user first, so we can tell "never signed up" apart from
// "signed up but the profile row is missing".
const { data: list, error: listError } = await supabase.auth.admin.listUsers({
  perPage: 1000,
});

if (listError) {
  console.error("Could not list auth users:", listError.message);
  process.exit(1);
}

const authUser = list.users.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase()
);

if (!authUser) {
  console.error(
    `No Supabase Auth user with email "${email}". Sign up at /signup first.`
  );
  process.exit(1);
}

// Upsert covers the case where the on_auth_user_created trigger did not run.
const { data, error } = await supabase
  .from("User")
  .upsert({ id: authUser.id, email: authUser.email, role }, { onConflict: "id" })
  .select("id, email, role")
  .single();

if (error) {
  console.error("Could not update the profile row:", error.message);
  process.exit(1);
}

console.log(`${data.email} is now role "${data.role}" (id ${data.id})`);
console.log("Log out and back in to see the change in the app.");
