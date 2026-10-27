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
    { id: "desserts", name: "Desserts", note: "Baked to order" }
  ],

  // photo: an image in assets/photos/ (ideally 900 × 675, landscape 4:3)
  items: [
    { id: "molten", cat: "desserts", photo: "assets/photos/molten-cake.jpg",
      name: "Molten Cake",
      desc: "Dark chocolate cake with a warm, flowing centre. Warm for 15 seconds before serving.",
      portion: "Box of 4", price: 380 },
    { id: "brownies", cat: "desserts", photo: "assets/photos/brownies.jpg",
      name: "Brownies",
      desc: "Dense, fudgy dark-chocolate brownies with a crackly top.",
      portion: "Box of 9", price: 320 },
    { id: "carrot", cat: "desserts", photo: "assets/photos/carrot-cake.jpg",
      name: "Carrot Cake",
      desc: "Spiced carrot and walnut sponge layered with cream cheese frosting.",
      portion: "20 cm cake", price: 600 },
    { id: "honey", cat: "desserts", photo: "assets/photos/honey-cake.jpg",
      name: "Honey Cake",
      desc: "Thin honey-caramel layers with a light, tangy cream, rested overnight to soften.",
      portion: "20 cm cake", price: 650 },
    { id: "souffle", cat: "desserts", photo: "assets/photos/souffle-cheesecake.jpg",
      name: "Soufflé Cheesecake",
      desc: "Light, airy Japanese-style cheesecake that melts in the mouth.",
      portion: "20 cm cake", price: 550 }
  ]
};
