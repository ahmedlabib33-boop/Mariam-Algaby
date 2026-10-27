/*
 * Maison Mariam: site settings and menu.
 * Edit this file to change the phone number, prices or dishes.
 * You don't need to touch any other file.
 */
window.MAISON = {
  // WhatsApp number in international format, digits only (Egypt = 20, then the number without the leading 0).
  // Example: 01012345678  ->  "201012345678"
  whatsapp: "201550505386",
  // Optional second number, shown in the footer only. Set to "" to hide it.
  whatsapp2: "201012710244",
  instagram: "https://instagram.com/maison.mariam",

  currency: "EGP",

  categories: [
    { id: "cakes",  name: "Cakes",            note: "Whole, to share" },
    { id: "tarts",  name: "Tarts & Pastries", note: "Buttery & flaky" },
    { id: "treats", name: "Small Treats",     note: "Gift boxes" }
  ],

  // icon: cake | tart | eclair | roll | macaron | cookie | brownie | jar
  items: [
    { id: "fudgecake", cat: "cakes", icon: "cake",
      name: "Chocolate Fudge Cake",
      desc: "Three layers of dark chocolate sponge under a glossy fudge ganache.",
      portion: "20 cm cake", price: 650 },
    { id: "cheesecake", cat: "cakes", icon: "cake",
      name: "New York Cheesecake",
      desc: "Dense, creamy baked cheesecake on a biscuit base, with berry coulis on the side.",
      portion: "20 cm cake", price: 600 },
    { id: "lotus", cat: "cakes", icon: "cake",
      name: "Lotus Biscoff Cheesecake",
      desc: "Baked cheesecake on a Biscoff base, finished with Biscoff spread and crumbs.",
      portion: "20 cm cake", price: 650 },
    { id: "redvelvet", cat: "cakes", icon: "cake",
      name: "Red Velvet Cake",
      desc: "Soft cocoa sponge layered with a light cream cheese frosting.",
      portion: "20 cm cake", price: 600 },

    { id: "citron", cat: "tarts", icon: "tart",
      name: "Lemon Tart",
      desc: "Shortcrust pastry, a sharp lemon curd and torched meringue.",
      portion: "20 cm tart", price: 420 },
    { id: "strawberry", cat: "tarts", icon: "tart",
      name: "Strawberry Tart",
      desc: "Crisp pastry, vanilla custard cream and fresh glazed strawberries.",
      portion: "20 cm tart", price: 480 },
    { id: "eclairs", cat: "tarts", icon: "eclair",
      name: "Chocolate Eclairs",
      desc: "Choux pastry filled with chocolate cream and dipped in a dark glaze.",
      portion: "Box of 6", price: 360 },
    { id: "cinnamon", cat: "tarts", icon: "roll",
      name: "Cinnamon Rolls",
      desc: "Soft brioche swirls with brown-sugar cinnamon and cream cheese icing.",
      portion: "Box of 6", price: 340 },

    { id: "macarons", cat: "treats", icon: "macaron",
      name: "Macarons",
      desc: "Almond shells with pistachio, raspberry, salted caramel and vanilla fillings.",
      portion: "Box of 12", price: 480 },
    { id: "cookies", cat: "treats", icon: "cookie",
      name: "Sea Salt Cookies",
      desc: "Brown-butter chocolate cookies with a pinch of sea salt, baked that morning.",
      portion: "Box of 9", price: 280 },
    { id: "brownies", cat: "treats", icon: "brownie",
      name: "Fudgy Brownies",
      desc: "Dense dark-chocolate brownies with a crackly top.",
      portion: "Box of 9", price: 320 },
    { id: "tiramisu", cat: "treats", icon: "jar",
      name: "Tiramisu Jars",
      desc: "Coffee-soaked ladyfingers, mascarpone cream and a dusting of cocoa.",
      portion: "4 jars", price: 360 }
  ]
};
