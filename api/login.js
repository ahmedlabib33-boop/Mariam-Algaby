import { isAdmin, denied } from "./_lib/auth.js";

// POST /api/login: lets the admin page check the password before showing the editor.
export async function POST(request) {
  if (!isAdmin(request)) return denied();
  return Response.json({ ok: true });
}
