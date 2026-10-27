import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s) => createHash("sha256").update(String(s)).digest();

// True when the request carries the admin password (set as ADMIN_PASSWORD in Vercel).
export function isAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD;
  const given = request.headers.get("x-admin-password");
  if (!expected || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

// Answer a wrong password slowly, so guessing it is impractical.
export async function denied() {
  await new Promise((r) => setTimeout(r, 800));
  return Response.json({ error: "Wrong password" }, { status: 401 });
}
