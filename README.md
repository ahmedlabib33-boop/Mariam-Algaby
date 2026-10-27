# Maison de Gaby

Website for **Maison de Gaby**, a home patisserie by Mariam Algaby, Heliopolis (Masr El Gedida), Cairo.
Live at https://maison-mariam.vercel.app

Customers fill a box from the menu and press **Send order on WhatsApp**. The full order (items, total,
name, date, area, address, gift note) opens in WhatsApp, already written out.

## Editing the menu: /admin

Mariam edits the menu herself at **https://maison-mariam.vercel.app/admin**, from her phone or a computer.

- Sign in with the admin password (tick "Keep me signed in on this phone" so it's asked only once).
- Tap a dessert to change its photo, name, description, size or price.
- Use the **Available** switch to mark a dessert sold out for the day. It stays on the site, greyed out, and can't be ordered.
- **↑ ↓** change the order, **+ Add a dessert** adds a new one, and **Delete** is inside each dessert.
- Press **Publish**. Changes are on the website within a minute.

Photos taken on the phone are shrunk automatically before upload. Every published menu is also kept as a
backup in the Blob store under `menu/history/`.

**Changing the password:** Vercel → project `maison-mariam` → Settings → Environment Variables →
`ADMIN_PASSWORD`, then redeploy.

## How it works

- `public/`: the website (plain HTML/CSS/JS, no build step)
  - `index.html`, `packaging.html`, `admin.html`
  - `js/menu.js`: WhatsApp numbers and Instagram link
  - `data/menu.json`: the starting menu, used until the first publish from /admin
- `api/`: three small Vercel Functions
  - `menu.js`: `GET` returns the published menu, `POST` publishes it (password required)
  - `upload.js`: stores a dessert photo (password required)
  - `login.js`: checks the password
- Storage: a Vercel Blob store (`maison-mariam-menu`) holds `menu/menu.json` and the uploaded photos.

Vercel settings: `BLOB_READ_WRITE_TOKEN` (added automatically when the Blob store was connected) and
`ADMIN_PASSWORD`.

## Hosting

Hosted on Vercel's free plan. Every push to the production branch redeploys the site. To use a custom domain,
such as `maisonmariam.com`, add it under **Settings → Domains**.

## Previewing locally

```sh
cd public && python3 -m http.server 8000
# open http://localhost:8000 (the menu comes from data/menu.json; /admin needs Vercel)
```

## Photos

The starting photos in `public/assets/photos/` are stand-ins from Unsplash (free for commercial use under the
[Unsplash License](https://unsplash.com/license)). Replace them with photos of Mariam's own desserts from
/admin. Customers should see what they will get.

- molten-cake.jpg: https://unsplash.com/photos/chocolate-cake-on-white-ceramic-plate-Pzjez86SsvQ
- brownies.jpg: https://unsplash.com/photos/a-pile-of-brownies-sitting-on-top-of-a-white-plate-LjtviHokbr4 (Anna Przepiorka)
- carrot-cake.jpg: https://unsplash.com/photos/a-piece-of-carrot-cake-on-a-plate-with-a-fork-EvfXG4aK9d8 (Orkun Orcan)
- honey-cake.jpg: https://unsplash.com/photos/sliced-of-cake-on-white-ceramic-plate-diVU8-tGO0U (Diliara Garifullina)
- souffle-cheesecake.jpg: https://unsplash.com/photos/a-cake-with-berries-and-powdered-sugar-on-a-plate-AHKlSCTEf3c
