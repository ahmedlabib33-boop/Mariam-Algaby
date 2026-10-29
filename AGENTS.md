# Working on Maison de Gaby

Shared guide for every AI agent on this repo (Codex reads this file; Claude reads it through `CLAUDE.md`).
Two agents work here, often on the same day. Read this before you start, and update **Status** before you stop.

## The project

Website for **Maison de Gaby**, Mariam Algaby's home patisserie in Heliopolis (Masr El Gedida), Cairo.
Live at https://maison-mariam.vercel.app. Customers fill a box and send the order on WhatsApp; Mariam edits the
menu at `/admin`. All customer-facing text is in English. Brand: navy `#1E2A44`, cream `#F4EEE3`, paper
`#FBF8F2`, sand `#E8DDCB`, gold `#B08D57`; Cormorant Garamond + Jost (self-hosted in `public/assets/fonts/`).

- `public/`: static site, plain HTML/CSS/JS, no build step. Vercel serves it with `cleanUrls`.
- `api/`: Vercel Functions (`menu`, `upload`, `recipes`, `login`), Web-standard `GET/POST/PUT(request)`.
- Storage: Vercel Blob store `maison-mariam-menu` (`menu/menu.json`, `menu/history/`, photos, private recipes).
- `README.md` is the owner-facing manual. `docs/gift-cards.md` sources the gift-card quotes.

## Rules (both agents)

1. **Recipes are private.** Recipe text, costing and the recipe-book PDF live only in Blob storage at
   `private/recipes-<RECIPES_KEY>.*` and are served by `/api/recipes` to the signed-in admin. Never commit
   them, never put them in `public/`, never paste them into issues or PRs.
2. **No secrets in the repo.** `ADMIN_PASSWORD`, `RECIPES_KEY` and `BLOB_READ_WRITE_TOKEN` are Vercel
   environment variables. Tests use dummy values and mocked storage only.
3. **Never overwrite Mariam's live menu.** `public/data/menu.json` is only the starting menu. To change the live
   menu, fetch `/api/menu`, change the items you mean to by `id`, and publish that. Never publish the starting
   menu over the live one.
4. **Honest content.** Don't present stock or generated photos as Mariam's desserts (on the site the stock
   photos are credited in `README.md` and are meant to be replaced). No invented reviews, ratings or policies:
   anything the site promises (delivery hours, storage times, gift wrapping) must be something Mariam does.
5. **WhatsApp:** orders go to `201550505386` (main). `201012710244` is the second number, footer only.
   Settings are in `public/js/menu.js`. The Instagram link stays hidden (`instagram: ""`) until the real
   account exists.
6. Match the surrounding code: vanilla JS in an IIFE, `var`, no frameworks, no build tools. Keep the brand
   tokens. Bump the `?v=` query on CSS/JS links when you change those files (they are cached for 5 minutes).

## Git workflow

- `main` deploys to production on every push. Keep it green.
- Work on your own branch (Claude: `claude/...`; Codex: `codex/...` or as configured), and **pull `main`
  first**: `git fetch origin main && git merge origin/main`.
- Before pushing: `npm test` must pass (19 API tests). If you change the admin rider screen and have Python
  Playwright, also run `npm run test:browser`.
- Fast-forward or merge into `main`; never force-push `main`, never rewrite the other agent's commits.
- Small commits with clear messages. Don't put model names in commits or code.

## Who does what (proposed; the owner can change it)

| Area | Lead |
|---|---|
| Site features, admin screens, delivery, couriers, gift cards, tests | Codex |
| Private recipes, costing and PDF, menu content and prices, marketing kit (Instagram, Google), reviews of changes | Claude |

If you need to change the other agent's area, keep the change small and note it under **Status**.

## Status

Newest first. One or two lines each: date, agent, what changed, what's left.

- 2026-10-29 · Codex: reviewed the five-dessert menu; fixed saved-cart cleanup. 19 API and customer browser checks pass.
  Sizes await owner confirmation; corrected README hero names. Live endpoint access remains blocked here.
- 2026-10-29 · Codex: read the shared guide and synced this checkout with `main`. Individual rider search
  awaits activation of saved search-domain access; no real rider contact has been verified yet.
- 2026-10-29 · Claude: new menu of five (Golden Carrot Crumb 300, Milk Cloud 300, Toffee Cuddle 400, Cinnamon
  Kisses 400, Chocolate Crush 350 EGP) replaces the old seven, live and in `data/menu.json`; sizes left blank for
  Mariam to fill in /admin. Private recipes added (no costing, at the owner's request). Homepage photos, FAQ,
  meta description and `og.jpg` updated to match. Small fix in `main.js`: no stray "()" or "·" when a dessert
  has no size.
- 2026-10-29 · Claude → Codex: fixed a live bug in `api/menu.js`. The Blob CDN sends a weak ETag (`W/"…"`) when it
  serves the menu compressed, which is what server-side `fetch()` gets, so `comparableEtag` never matched the
  metadata ETag and every admin menu load returned 503 "still updating". It now strips `W/`; two tests added.
- 2026-10-29 · Claude: added this guide. Reviewed Codex's commits up to `50da09d` (heritage redesign, gift
  cards, delivery map, admin publishing fix, couriers): `npm test` passes (17/17), live site checked on desktop
  and phone with no console errors. Fixed a README line that still listed the removed occasions section.
- 2026-10-28 · Codex: heritage redesign, literary gift cards, map-based delivery location, admin publishing and
  session safety, individual courier contacts in admin.
- 2026-10-28 · Claude: homepage upgrade (filters, allergen tags, gift orders, mobile box bar, FAQ, OG image,
  icons, sitemap, 404), Crème Caramel and Crème Brûlée added to the menu and private recipes.

## Open tasks

- Menu: confirm the size/quantity for each price and the allergen declaration for Milk Cloud's almond extract.
- Real dessert photos from Mariam → replace the stock photos (site, Google, Instagram).
- Instagram account → put the real handle in `public/js/menu.js` and unhide the footer link.
- Google Business Profile: waiting on video verification; then add products and a "Review us on Google" link.
- Owner to-dos: make the GitHub repo private (old commit `10ffa54` has an early public recipe file) and set
  the default branch to `main`.
