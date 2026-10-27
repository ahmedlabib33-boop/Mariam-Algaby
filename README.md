# Maison Mariam

Website for **Maison Mariam**, home-made food by Mariam Algaby, Héliopolis (Masr El Gedida), Cairo.

It's a plain HTML/CSS/JS site with no build step, no database and no monthly cost. Customers fill a box from the menu and press **Send order on WhatsApp**. The full order (dishes, total, name, date, area, address, gift note) opens in WhatsApp, already written out.

- `index.html`: home, story, menu, how to order, the box (cart)
- `packaging.html`: the packaging guide (box, seal, label, card, bag, colours, fonts)
- `js/menu.js`: **the only file you need to edit**: WhatsApp number, Instagram, dishes, prices
- `assets/`: monogram and favicon

## Before going live

1. Open `js/menu.js` and set `whatsapp` to Mariam's number in international format, digits only.
   `01012345678` becomes `"201012345678"`.
2. Set `instagram` to the real account.
3. Edit the dishes and prices. Each dish has a `cat` (plats / douceurs / patisserie) and an `icon` (pot / tray / tart / cake / jar).

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
