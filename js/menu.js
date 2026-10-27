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
    { id: "mains",  name: "Mains",           note: "Savoury" },
    { id: "sweets", name: "Oriental Sweets", note: "Egyptian classics" },
    { id: "pastry", name: "Pastry",          note: "Tarts & bakes" }
  ],

  // icon: pot | tray | tart | cake | jar
  items: [
    { id: "mahshi", cat: "mains", icon: "pot",
      name: "House Mahshi",
      desc: "Vine leaves, courgettes and peppers rolled one by one. Herbed rice and a light tomato broth.",
      portion: "Serves 3–4", price: 450 },
    { id: "bechamel", cat: "mains", icon: "tray",
      name: "Macaroni Béchamel",
      desc: "Slow-cooked spiced beef and a béchamel made from scratch, baked golden.",
      portion: "Family tray, 4–6", price: 550 },
    { id: "molokhia", cat: "mains", icon: "pot",
      name: "Molokhia & Roast Chicken",
      desc: "Garlic and coriander molokhia with a half roast chicken and vermicelli rice.",
      portion: "Serves 2–3", price: 520 },
    { id: "fatta", cat: "mains", icon: "tray",
      name: "Garlic Fatta",
      desc: "Crisp bread, rice, garlic-vinegar tomato sauce and tender braised meat.",
      portion: "Serves 3–4", price: 600 },

    { id: "basbousa", cat: "sweets", icon: "cake",
      name: "Basbousa with Cream",
      desc: "Semolina cake soaked in orange-blossom syrup, filled with fresh eshta.",
      portion: "Box of 12", price: 320 },
    { id: "konafa", cat: "sweets", icon: "tart",
      name: "Pistachio Konafa",
      desc: "Buttery golden konafa filled with cream and finished with crushed pistachio.",
      portion: "Round tray, 6–8", price: 480 },
    { id: "omali", cat: "sweets", icon: "jar",
      name: "Caramelised Om Ali",
      desc: "Classic Om Ali with nuts and coconut, under a caramelised crust.",
      portion: "4 individual pots", price: 300 },

    { id: "citron", cat: "pastry", icon: "tart",
      name: "Lemon Tart",
      desc: "Shortcrust pastry, a sharp lemon curd and torched meringue.",
      portion: "20 cm tart", price: 420 },
    { id: "caramel", cat: "pastry", icon: "jar",
      name: "Crème Caramel",
      desc: "Silky vanilla custard with an amber caramel, in glass jars.",
      portion: "4 jars", price: 260 },
    { id: "cookies", cat: "pastry", icon: "cake",
      name: "Sea Salt Cookies",
      desc: "Brown-butter chocolate cookies with a pinch of sea salt, baked that morning.",
      portion: "Box of 9", price: 280 }
  ]
};
