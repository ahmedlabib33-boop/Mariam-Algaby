import { get, put } from "@vercel/blob";
import { isAdmin, denied } from "./_lib/auth.js";

// The recipes are private: they live in Blob storage at a secret path (RECIPES_KEY, set in Vercel),
// never in the code repository, and are only served to the signed-in admin.
function recipesPath() {
  const key = process.env.RECIPES_KEY;
  return key && /^[a-f0-9]{32,}$/.test(key) ? `private/recipes-${key}.json` : null;
}

const noStore = { "Cache-Control": "no-store" };

// GET /api/recipes: the recipe book (password required).
export async function GET(request) {
  if (!isAdmin(request)) return denied();
  const path = recipesPath();
  if (!path) return Response.json({ error: "Recipes are not set up yet." }, { status: 503, headers: noStore });

  let result;
  try {
    result = await get(path, { access: "public", useCache: false });
  } catch {
    return Response.json({ error: "The recipes are unavailable right now." }, { status: 503, headers: noStore });
  }
  if (!result || result.statusCode !== 200) return Response.json({ recipes: [] }, { headers: noStore });
  return new Response(result.stream, { headers: { "Content-Type": "application/json", ...noStore } });
}

// PUT /api/recipes: replace the recipe book (password required).
export async function PUT(request) {
  if (!isAdmin(request)) return denied();
  const path = recipesPath();
  if (!path) return Response.json({ error: "Recipes are not set up yet." }, { status: 503, headers: noStore });

  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body || !Array.isArray(body.recipes) || body.recipes.length > 100) {
    return Response.json({ error: "The recipes could not be read." }, { status: 400, headers: noStore });
  }
  const json = JSON.stringify({ recipes: body.recipes, updatedAt: new Date().toISOString() });
  if (json.length > 500000) return Response.json({ error: "The recipe book is too large." }, { status: 413, headers: noStore });

  await put(path, json, {
    access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
  });
  return Response.json({ ok: true }, { headers: noStore });
}
