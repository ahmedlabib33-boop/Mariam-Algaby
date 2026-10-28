import { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";
import { isAdmin, denied } from "./_lib/auth.js";

const MENU_PATH = "menu/menu.json";
const MAX_ITEMS = 60;
const noStore = { "Cache-Control": "no-store" };

const missingMenu = () => Response.json({ items: null }, { status: 404, headers: noStore });
const unavailable = () => Response.json({ error: "The menu is unavailable right now. Please try again." }, { status: 503, headers: noStore });
const conflict = () => Response.json({ error: "The menu has changed since you opened it. Reload the editor before publishing again." }, { status: 409, headers: noStore });

// The Blob metadata API and CDN can format the same ETag with or without quotes.
const comparableEtag = (value) => typeof value === "string" ? value.trim().replace(/^"(.*)"$/, "$1") : "";

// GET /api/menu: the published menu, or 404 before the first publish
// (the site then falls back to data/menu.json). A storage outage is a 503,
// never a 404, so nobody is shown or edits the starting menu by mistake.
export async function GET(request) {
  const admin = request && isAdmin(request);
  let metadata;
  if (admin) {
    // Public Blob reads cannot bypass its CDN. Check authoritative metadata
    // before letting the editor use a body that could still be cached.
    try {
      metadata = await head(MENU_PATH);
    } catch (error) {
      return error instanceof BlobNotFoundError ? missingMenu() : unavailable();
    }
    if (!comparableEtag(metadata.etag)) return unavailable();
  }

  let result;
  try {
    result = await get(MENU_PATH, { access: "public", useCache: false });
  } catch {
    return unavailable();
  }
  if (!result || result.statusCode !== 200) {
    // Metadata already confirmed that a menu exists; a stale CDN 404 must
    // never make the editor start again from the bundled sample menu.
    return admin ? unavailable() : missingMenu();
  }
  if (admin && comparableEtag(metadata.etag) !== comparableEtag(result.blob.etag)) {
    await result.stream.cancel().catch(() => {});
    return Response.json({ error: "The latest menu is still updating. Please try again in a minute." }, { status: 503, headers: noStore });
  }
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/json",
      // Cached on Vercel's CDN for a few seconds, so changes show up almost straight away.
      ...(admin ? { ...noStore, ETag: metadata.etag } : {
        "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60",
      }),
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

  const ifMatch = request.headers.get("if-match");
  const ifNoneMatch = request.headers.get("if-none-match");
  if ((ifMatch && ifNoneMatch) || (ifMatch ? ifMatch === "*" || ifMatch.length > 512 || ifMatch.includes(",") : ifNoneMatch !== "*")) {
    return Response.json({ error: "Reload the editor before publishing so your changes use the latest menu." }, { status: 428, headers: noStore });
  }

  const json = JSON.stringify({ items, updatedAt: new Date().toISOString() });
  const options = { access: "public", contentType: "application/json", addRandomSuffix: false, cacheControlMaxAge: 60 };
  let published;
  try {
    published = await put(MENU_PATH, json, {
      ...options,
      ...(ifMatch ? { allowOverwrite: true, ifMatch } : { allowOverwrite: false }),
    });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return conflict();
    if (!ifMatch) {
      // The SDK can report a conditional-create collision as a generic error.
      // Checking metadata keeps it a conflict without risking an overwrite.
      try { await head(MENU_PATH); return conflict(); } catch { /* unavailable or still absent */ }
    }
    return Response.json({ error: "Your menu could not be published. Please try again." }, { status: 503, headers: noStore });
  }

  let warning;
  // Keep every published version, in case an old menu is ever needed back.
  try {
    await put(`menu/history/${Date.now()}.json`, json, options);
  } catch {
    // The live menu was saved already. A backup outage must not claim that
    // publishing failed or invite a repeat that overwrites a newer version.
    warning = "Your menu is published, but its backup could not be saved.";
  }

  return Response.json({ ok: true, items, etag: published.etag, ...(warning ? { warning } : {}) }, {
    headers: { ...noStore, ...(published.etag ? { ETag: published.etag } : {}) },
  });
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
      ingredients: text(raw.ingredients, 600),
      portion: text(raw.portion, 40),
      price: Math.round(price),
      photo,
      soldOut: raw.soldOut === true,
    });
  }
  return out;
}
