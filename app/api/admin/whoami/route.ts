import { requireAdminApi } from "@/lib/auth";

/**
 * Admin-only probe endpoint — the sample every future admin route handler
 * should copy.
 *
 * The role check happens right here in the handler, not in middleware. Verify
 * it with curl: signed out gives 401, a normal user gives 403, an admin gives
 * 200 — regardless of any header a client sends.
 */
export async function GET() {
  const { user, error } = await requireAdminApi();
  if (error) return error;

  return Response.json({
    ok: true,
    id: user.id,
    email: user.email,
    role: user.role,
  });
}
