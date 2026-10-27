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
    { id: "mains",  name: "Mains",         note: "Savoury" },
    { id: "pasta",  name: "Pasta & Bakes", note: "From the oven" },
    { id: "sweets", name: "Desserts",      note: "Baked fresh" }
  ],

  // icon: plate | pot | tray | tart | cake | jar
  items: [
    { id: "cordonbleu", cat: "mains", icon: "plate",
      name: "Chicken Cordon Bleu",
      desc: "Golden breaded chicken filled with turkey and cheese, with creamy mashed potato.",
      portion: "Serves 2", price: 480 },
    { id: "mushroom", cat: "mains", icon: "pot",
      name: "Creamy Mushroom Chicken",
      desc: "Pan-seared chicken breast in a garlic, thyme and mushroom cream sauce, with buttered rice.",
      portion: "Serves 2–3", price: 520 },
    { id: "stroganoff", cat: "mains", icon: "pot",
      name: "Beef Stroganoff",
      desc: "Tender strips of beef in a mushroom and sour cream sauce, served with rice or pasta.",
      portion: "Serves 2–3", price: 580 },
    { id: "shepherds", cat: "mains", icon: "tray",
      name: "Shepherd's Pie",
      desc: "Slow-cooked minced beef and vegetables under a crown of baked mashed potato.",
      portion: "Family tray, 4", price: 550 },

    { id: "lasagna", cat: "pasta", icon: "tray",
      name: "Beef Lasagna",
      desc: "Layers of fresh pasta, rich beef ragù, béchamel and melted mozzarella.",
      portion: "Family tray, 4–6", price: 600 },
    { id: "alfredo", cat: "pasta", icon: "tray",
      name: "Chicken Alfredo Penne",
      desc: "Penne in a silky parmesan cream sauce with grilled chicken and a touch of black pepper.",
      portion: "Serves 3–4", price: 480 },
    { id: "maccheese", cat: "pasta", icon: "tray",
      name: "Baked Mac & Cheese",
      desc: "Three cheeses, a golden breadcrumb crust, and plenty of it.",
      portion: "Serves 3–4", price: 380 },
    { id: "quiche", cat: "pasta", icon: "tart",
      name: "Quiche Lorraine",
      desc: "Buttery shortcrust filled with smoked turkey, cheese and a creamy egg custard.",
      portion: "22 cm quiche", price: 420 },

    { id: "cheesecake", cat: "sweets", icon: "cake",
      name: "New York Cheesecake",
      desc: "Dense, creamy baked cheesecake on a biscuit base, with berry coulis on the side.",
      portion: "20 cm cake", price: 520 },
    { id: "tiramisu", cat: "sweets", icon: "jar",
      name: "Tiramisu",
      desc: "Coffee-soaked ladyfingers, mascarpone cream and a dusting of cocoa.",
      portion: "4 jars", price: 360 },
    { id: "citron", cat: "sweets", icon: "tart",
      name: "Lemon Tart",
      desc: "Shortcrust pastry, a sharp lemon curd and torched meringue.",
      portion: "20 cm tart", price: 420 },
    { id: "cookies", cat: "sweets", icon: "cake",
      name: "Sea Salt Cookies",
      desc: "Brown-butter chocolate cookies with a pinch of sea salt, baked that morning.",
      portion: "Box of 9", price: 280 }
  ]
};
