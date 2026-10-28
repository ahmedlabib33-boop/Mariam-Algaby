# Maison de Gaby

Website for **Maison de Gaby**, a home patisserie by Mariam Algaby, Heliopolis (Masr El Gedida), Cairo.
Live at https://maison-mariam.vercel.app

Customers fill a box from the menu and press **Send order on WhatsApp**. The full order opens in WhatsApp,
already written out, with an order number (e.g. `MG-2810-K4F`), the items and total, the delivery day and time
window, the area and address, and, for gifts, the recipient's name and phone and the card message.

What the site does for customers:

- Menu filters (Whole cakes / Boxes / Gluten-free) and allergen tags, read from the "Contains:" part of each
  dessert's ingredients. A dessert whose allergens don't include gluten gets a **Gluten-free** badge, so keep the
  "Contains:" line accurate in /admin.
- A **Send it as a gift** option, a delivery time window, and name/area/address remembered on the customer's
  own phone (only there, never sent anywhere else).
- A literary gift-card collection: two editable messages for each of 13 occasions. Browse the collection on
  `/packaging#card-collection`, or choose a card directly in the gift order form.
- A delivery map: use the customer's current location with browser permission, or choose another address
  by placing or dragging a pin. The WhatsApp order includes a Google Maps link and any written address details.
- On phones, a bar at the bottom shows the box total; a **Questions?** button opens a WhatsApp chat.
- An FAQ, an occasions section, a preview image for links shared on WhatsApp (`assets/og.jpg`), icons for
  "Add to Home Screen", a sitemap and a branded 404 page.

The hero photos (crème brûlée and honey cake) are set in `index.html`, not in /admin.

## Editing the menu: /admin

Mariam edits the menu herself at **https://maison-mariam.vercel.app/admin**, from her phone or a computer.

- Sign in with the admin password (tick "Keep me signed in on this phone" so it's asked only once).
- Tap a dessert to change its photo, name, description, ingredients, size or price.
- Use the **Available** switch to mark a dessert sold out for the day. It stays on the site, greyed out, and can't be ordered.
- **↑ ↓** change the order, **+ Add a dessert** adds a new one, and **Delete** is inside each dessert.
- Press **Publish**. Changes are on the website within a minute.

Menu controls pause while publishing. If another device has published a newer menu, the editor keeps your
draft and asks you to reload rather than overwriting it. Menu storage failures pause editing; **Try again**
loads the current version safely.

Photos taken on the phone are shrunk automatically before upload. A new photo is applied when you press
**Done**; closing the dessert sheet discards it. Published menus are backed up in the Blob store under
`menu/history/`. If only the backup fails, the editor confirms that the live menu was published and shows a warning.

**Changing the password:** Vercel → project `maison-mariam` → Settings → Environment Variables →
`ADMIN_PASSWORD`, then redeploy.

**Recipes:** the **Recipes** tab in /admin has step-by-step recipes for the desserts. They are private:
stored in the Blob store at a secret path (`RECIPES_KEY` in Vercel) and only shown after signing in.
They are not in this repository.

## How it works

- `public/`: the website (plain HTML/CSS/JS, no build step)
  - `index.html`, `packaging.html`, `admin.html`, `404.html`
  - `js/menu.js`: WhatsApp numbers and Instagram link
  - `data/menu.json`: the starting menu, used until the first publish from /admin
- `api/`: four small Vercel Functions
  - `menu.js`: `GET` returns the published menu, `POST` publishes it (password required)
  - `upload.js`: stores a dessert photo (password required)
  - `recipes.js`: the private recipe book for the Recipes tab (password required)
  - `login.js`: checks the password
- Storage: a Vercel Blob store (`maison-mariam-menu`) holds `menu/menu.json` and the uploaded photos.

Vercel settings: `BLOB_READ_WRITE_TOKEN` (added automatically when the Blob store was connected) and
`ADMIN_PASSWORD`.

## Handwritten gift cards

`public/data/cards.json` contains 26 cards grouped by occasion. Each card separates a verified literary
quotation and author credit from an original personal message. Customers can choose a card on the packaging
page or in their box, then edit or sign the complete message before it is included in the WhatsApp order.
A choice from the packaging page stays in that browser tab until the customer edits it, disables the gift
option, or starts a new box. If the collection is unavailable, writing a custom message still works.

To update the wording, edit the card data and keep exactly two choices per occasion. Preserve the quotation's
wording, credit, and source link; the personal message is not attributed to the author. The readable collection
and source references are in [docs/gift-cards.md](docs/gift-cards.md). `public/js/cards.js` renders both places;
`public/css/cards.css` styles the collection. No new service or build step is required.

## Delivery locations

The checkout's **Use my location** button requests browser location permission and shows the delivery pin.
**Choose another address** opens a map where customers can tap, drag the pin, or pan with the arrow keys and
select **Use map centre**. The initial area view is only a starting point; it is not a selected address.
Written street/building/floor/flat details remain editable, and a gift can use either a selected map pin or a
full written address. For gifts, customers choose the recipient's destination themselves.

`public/js/delivery.js` lazy-loads the locally vendored Leaflet 1.9.4 library. Interactive map tiles come from
OpenStreetMap with attribution; there is no geocoder, API key, or paid mapping dependency. GPS provides a
coordinate pin, not a street-address lookup. Map pins stay in the current page's memory and reset with a new
box; they are not added to remembered customer details. The selected map link is included in the WhatsApp
order. If location permission or the map is unavailable, written-address ordering still works.

The browser location API needs HTTPS in production (localhost is supported for development). Map imagery
requires access to `tile.openstreetmap.org`. For automated browser checks, intercept tiles with local fixtures
rather than generating automated traffic to the public tile service. Vendor license and asset information are
in `public/assets/vendor/leaflet/`.

## Hosting

Hosted on Vercel's free plan. Every push to the production branch redeploys the site. To use a custom domain,
such as `maisonmariam.com`, add it under **Settings → Domains**.

## Previewing locally

```sh
cd public && python3 -m http.server 8000
# open http://localhost:8000 (the menu comes from data/menu.json; /admin needs Vercel)
```

Run `npm ci` then `npm test` for the admin menu API regression checks. They use local storage fixtures with
network access disabled, and do not read real admin credentials or change the production menu.

## Photos

The starting photos in `public/assets/photos/` are stand-ins from Unsplash (free for commercial use under the
[Unsplash License](https://unsplash.com/license)). Replace them with photos of Mariam's own desserts from
/admin. Customers should see what they will get.

- molten-cake.jpg: https://unsplash.com/photos/chocolate-cake-on-white-ceramic-plate-Pzjez86SsvQ
- brownies.jpg: https://unsplash.com/photos/a-pile-of-brownies-sitting-on-top-of-a-white-plate-LjtviHokbr4 (Anna Przepiorka)
- carrot-cake.jpg: https://unsplash.com/photos/a-piece-of-carrot-cake-on-a-plate-with-a-fork-EvfXG4aK9d8 (Orkun Orcan)
- honey-cake.jpg: https://unsplash.com/photos/sliced-of-cake-on-white-ceramic-plate-diVU8-tGO0U (Diliara Garifullina)
- souffle-cheesecake.jpg: https://unsplash.com/photos/a-cake-with-berries-and-powdered-sugar-on-a-plate-AHKlSCTEf3c
- `assets/og.jpg` (link preview) is made from creme-brulee.jpg and honey-cake.jpg.
- creme-caramel.jpg: https://unsplash.com/photos/sweet-flan-dessert-with-caramel-sauce-and-a-spoon-gynfA2P1dis
- creme-brulee.jpg: https://unsplash.com/photos/creme-brulee-dessert-with-strawberry-6We0b1jY6ms
