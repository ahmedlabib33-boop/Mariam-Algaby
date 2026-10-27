import { get, put } from "@vercel/blob";
import { isAdmin, denied } from "./_lib/auth.js";

const MENU_PATH = "menu/menu.json";
const MAX_ITEMS = 60;

// GET /api/menu: the published menu, or 404 before the first publish
// (the site then falls back to data/menu.json).
export async function GET() {
  const result = await get(MENU_PATH, { access: "public", useCache: false });
  if (!result || result.statusCode !== 200) {
    return Response.json({ items: null }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/json",
      // Cached on Vercel's CDN for a few seconds, so changes show up almost straight away.
      "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60",
    },
  });
}

// POST /api/menu: publish the menu from /admin.
export async function POST(request) {
  if (!isAdmin(request)) return denied();

  let body;
  try { body = await request.json(); } catch { body = null; }
  const items = clean(body && body.items);
  if (!items) return Response.json({ error: "The menu could not be read. Please try again." }, { status: 400 });

  const json = JSON.stringify({ items, updatedAt: new Date().toISOString() });
  const options = { access: "public", contentType: "application/json", addRandomSuffix: false, cacheControlMaxAge: 60 };
  await put(MENU_PATH, json, { ...options, allowOverwrite: true });
  // Keep every published version, in case an old menu is ever needed back.
  await put(`menu/history/${Date.now()}.json`, json, options);

  return Response.json({ ok: true, items });
}

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function isAllowedPhoto(url) {
  if (url === "") return true;
  if (/^assets\/photos\/[\w.-]+$/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function clean(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return null;
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const name = text(raw.name, 60);
    const price = Number(raw.price);
    const photo = text(raw.photo, 300);
    if (!name || !Number.isFinite(price) || price < 0 || price > 1e6 || !isAllowedPhoto(photo)) return null;

    let id = text(raw.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "") || "item";
    while (seen.has(id)) id += "-2";
    seen.add(id);

    out.push({
      id,
      name,
      desc: text(raw.desc, 300),
      portion: text(raw.portion, 40),
      price: Math.round(price),
      photo,
      soldOut: raw.soldOut === true,
    });
  }
  return out;
}
