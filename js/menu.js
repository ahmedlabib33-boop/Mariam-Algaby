/*
 * Maison Mariam: site settings and menu.
 * Edit this file to change the phone number, prices or dishes.
 * You don't need to touch any other file.
 */
window.MAISON = {
  // WhatsApp number in international format, digits only (Egypt = 20, then the number without the leading 0).
  // Example: 01012345678  ->  "201012345678"
  whatsapp: "201012710244",
  instagram: "https://instagram.com/maison.mariam",

  currency: "EGP",

  categories: [
    { id: "plats",    fr: "Les Plats",    en: "Mains" },
    { id: "douceurs", fr: "Les Douceurs", en: "Oriental sweets" },
    { id: "patisserie", fr: "La Pâtisserie", en: "French pastry" }
  ],

  // icon: pot | tray | tart | cake | jar
  items: [
    { id: "mahshi", cat: "plats", icon: "pot",
      name: "Mahshi Maison", ar: "محشي مشكل",
      desc: "Vine leaves, courgettes and peppers rolled one by one. Herbed rice and a light tomato broth.",
      portion: "Serves 3–4", price: 450 },
    { id: "bechamel", cat: "plats", icon: "tray",
      name: "Macaroni Béchamel", ar: "مكرونة بشاميل",
      desc: "Slow-cooked spiced beef and a béchamel made from scratch, baked golden.",
      portion: "Family tray, 4–6", price: 550 },
    { id: "molokhia", cat: "plats", icon: "pot",
      name: "Molokhia & Poulet Rôti", ar: "ملوخية وفراخ",
      desc: "Garlic and coriander molokhia with a half roast chicken and vermicelli rice.",
      portion: "Serves 2–3", price: 520 },
    { id: "fatta", cat: "plats", icon: "tray",
      name: "Fatta à l'Ail", ar: "فتة",
      desc: "Crisp bread, rice, garlic-vinegar tomato sauce and tender braised meat.",
      portion: "Serves 3–4", price: 600 },

    { id: "basbousa", cat: "douceurs", icon: "cake",
      name: "Basbousa à la Crème", ar: "بسبوسة بالقشطة",
      desc: "Semolina cake soaked in orange-blossom syrup, filled with fresh eshta.",
      portion: "Box of 12", price: 320 },
    { id: "konafa", cat: "douceurs", icon: "tart",
      name: "Konafa Pistache", ar: "كنافة بالفستق",
      desc: "Buttery golden konafa filled with cream and finished with crushed pistachio.",
      portion: "Round tray, 6–8", price: 480 },
    { id: "omali", cat: "douceurs", icon: "jar",
      name: "Om Ali Brûlée", ar: "أم علي",
      desc: "Classic Om Ali with nuts and coconut, under a caramelised crust.",
      portion: "4 individual pots", price: 300 },

    { id: "citron", cat: "patisserie", icon: "tart",
      name: "Tarte au Citron", ar: "تارت ليمون",
      desc: "Shortcrust pastry, a sharp lemon curd and torched meringue.",
      portion: "20 cm tart", price: 420 },
    { id: "caramel", cat: "patisserie", icon: "jar",
      name: "Crème Caramel", ar: "كريم كراميل",
      desc: "Silky vanilla custard with an amber caramel, in glass jars.",
      portion: "4 jars", price: 260 },
    { id: "cookies", cat: "patisserie", icon: "cake",
      name: "Cookies Fleur de Sel", ar: "كوكيز",
      desc: "Brown-butter chocolate cookies with a pinch of sea salt, baked that morning.",
      portion: "Box of 9", price: 280 }
  ]
};
