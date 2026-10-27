import { put } from "@vercel/blob";
import { isAdmin, denied } from "./_lib/auth.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024; // the admin page shrinks photos to well under this

// POST /api/upload: store one dessert photo and return its public URL.
export async function POST(request) {
  if (!isAdmin(request)) return denied();

  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) return Response.json({ error: "Please choose a JPG, PNG or WebP photo." }, { status: 415 });

  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_BYTES) {
    return Response.json({ error: "That photo is too large. Please choose a smaller one." }, { status: 413 });
  }

  const blob = await put(`photos/dessert.${ext}`, data, {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
  });
  return Response.json({ url: blob.url });
}
