# Maison Mariam

Website for **Maison Mariam**, a home patisserie by Mariam Algaby, Heliopolis (Masr El Gedida), Cairo.

It's a plain HTML/CSS/JS site with no build step, no database and no monthly cost. Customers fill a box from the menu and press **Send order on WhatsApp**. The full order (items, total, name, date, area, address, gift note) opens in WhatsApp, already written out.

- `index.html`: home, story, menu, how to order, the box (cart)
- `packaging.html`: the packaging guide (box, seal, label, card, bag, colours, fonts)
- `js/menu.js`: **the only file you need to edit**: WhatsApp number, Instagram, cakes and prices
- `assets/`: monogram, favicon and dessert photos

## Before going live

1. Open `js/menu.js` and set `whatsapp` to Mariam's number in international format, digits only.
   `01012345678` becomes `"201012345678"`.
2. `whatsapp2` is an optional second number shown in the footer. Set it to `""` to hide it.
3. Set `instagram` to the real account.
4. Edit the desserts and prices. Each one has a `photo` in `assets/photos/` (landscape 4:3, about 900 × 675).

## Hosting on Vercel (free)

1. Sign in at vercel.com with GitHub (the free Hobby plan is enough).
2. **Add New → Project**, then import this repository. Framework preset: **Other**. No build command.
3. Deploy. You get a free address such as `maison-mariam.vercel.app`.
   Every push to GitHub updates the site automatically.
4. Optional: buy a domain such as `maisonmariam.com` and add it under **Settings → Domains**.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Photos

The dessert photos in `assets/photos/` are stand-ins from Unsplash (free for commercial use under the
[Unsplash License](https://unsplash.com/license)). Replace them with photos of Mariam's own desserts,
keeping the same file names, before the business grows. Customers should see what they will get.

- molten-cake.jpg: https://unsplash.com/photos/chocolate-cake-on-white-ceramic-plate-Pzjez86SsvQ
- brownies.jpg: https://unsplash.com/photos/a-pile-of-brownies-sitting-on-top-of-a-white-plate-LjtviHokbr4 (Anna Przepiorka)
- carrot-cake.jpg: https://unsplash.com/photos/a-piece-of-carrot-cake-on-a-plate-with-a-fork-EvfXG4aK9d8 (Orkun Orcan)
- honey-cake.jpg: https://unsplash.com/photos/sliced-of-cake-on-white-ceramic-plate-diVU8-tGO0U (Diliara Garifullina)
- souffle-cheesecake.jpg: https://unsplash.com/photos/a-cake-with-berries-and-powdered-sugar-on-a-plate-AHKlSCTEf3c
