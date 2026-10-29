(function () {
  "use strict";

  // Delivery apps and listings: one place with each app's sign-up link, what it asks for,
  // and the business details and menu ready to copy. Progress is saved in this browser only.
  var KEY = "maison-gaby-partners-v1";
  var SITE = "https://maison-mariam.vercel.app";
  var $ = function (id) { return document.getElementById(id); };
  var started = false, items = [], state = load();

  // Facts come from each app's own partner pages (checked 29 October 2026). Where an app
  // doesn't publish its requirements, the checklist says "have ready" rather than guessing.
  var APPS = [
    {
      id: "talabat", name: "Talabat", kind: "Delivery app",
      signup: "https://eg.partner.talabat.com/s/?language=en_US",
      about: "Egypt's biggest delivery app. Its partner page says home-based kitchens in Egypt can sign up.",
      facts: [
        "A Commercial Registration is required: Talabat says it can't list a business without one.",
        "There is a one-time registration fee, paid by cash deposit or bank transfer.",
        "Talabat gives you a tablet to receive and manage orders, and pays every 3 weeks.",
        "Customers are within about a 15-minute drive. App orders expect desserts ready the same day, so keep some cakes ready for them.",
        "Menu photos must be landscape, and the cover photo wide, showing your desserts."
      ],
      checklist: [
        "Commercial Registration (سجل تجاري)",
        "National ID with a clear signature",
        "Bank certificate (if you have a business account)",
        "Email declaration, signed (Talabat sends the form)",
        "Proof of the registration-fee payment",
        "Logo",
        "Wide cover photo of your desserts",
        "Menu with a landscape photo for each dessert"
      ]
    },
    {
      id: "mrsool", name: "Mrsool", kind: "Delivery app",
      signup: "https://business.mrsool.co/public/registration/",
      info: "https://mrsool.co/partnership/",
      about: "A courier app: customers order from any shop. As a partner, your menu and photos show in the app.",
      facts: [
        "Its partnership page invites you to add your own menu and product photos.",
        "The registration form's requirements aren't published, so have the items below ready."
      ],
      checklist: ["National ID", "Phone number and area", "Menu with prices", "Logo", "A photo for each dessert"]
    },
    {
      id: "elmenus", name: "elmenus", kind: "Delivery app",
      signup: "http://unbouncepages.com/joinelmenus/en/",
      about: "Cairo's restaurant discovery and ordering app. Sign-up is the “Join us” form linked from elmenus.com.",
      facts: [
        "elmenus doesn't publish its requirements; its team contacts you after the form.",
        "Mention that you're a home patisserie taking orders a day ahead."
      ],
      checklist: ["Business name, phone and area", "Menu with prices", "Logo", "A photo for each dessert"]
    },
    {
      id: "google", name: "Google Maps", kind: "Free listing",
      signup: "https://business.google.com",
      about: "Your free Business Profile on Google Search and Maps. Already started.",
      facts: [
        "Choose “No” for a place customers can visit, so the home address stays private.",
        "After video verification, add the desserts as Products and copy the review link."
      ],
      checklist: ["Video verification", "Categories: Dessert shop, Cake shop, Pastry shop", "Add the desserts as Products", "Copy the “Ask for reviews” link"]
    },
    {
      id: "instagram", name: "Instagram", kind: "Free listing",
      signup: "https://www.instagram.com/accounts/emailsignup/",
      about: "Create the account on Mariam's phone. The setup guide has the bio, profile picture and first posts.",
      facts: ["Switch to a Business account and add the WhatsApp button and the website link."],
      checklist: ["Account created on Mariam's phone", "Business account, category Bakery", "Bio, website link and WhatsApp button", "First six posts"]
    }
  ];

  var STATUSES = [["todo", "Not started"], ["applying", "Applying"], ["waiting", "Waiting for approval"], ["live", "Live"]];

  var PROFILE = [
    ["name", "Business name", "Maison de Gaby"],
    ["owner", "Owner", "Mariam Algaby"],
    ["category", "Category", "Desserts · Cakes · Bakery"],
    ["area", "Area", "Heliopolis (Masr El Gedida), Cairo"],
    ["phone", "Phone / WhatsApp", "0155 050 5386"],
    ["email", "Email", ""],
    ["website", "Website", SITE],
    ["hours", "Hours", "Orders daily 10:00–20:00 · Deliveries 13:00–21:00"],
    ["notice", "Ordering", "Made to order, 24 hours ahead"],
    ["cr", "Commercial Registration no.", ""],
    ["short", "Short description", "Handmade French-inspired cakes from a home patisserie in Heliopolis.", 120],
    ["long", "Full description", "", 700]
  ];

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object") return { profile: s.profile || {}, apps: s.apps || {} };
    } catch (e) { /* private mode or bad data */ }
    return { profile: {}, apps: {} };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { say("This browser can't save your progress, but everything still works."); return false; }
  }
  function app(id) {
    var a = state.apps[id];
    if (!a || typeof a !== "object") a = state.apps[id] = { status: "todo", url: "", notes: "", checks: {} };
    if (!a.checks || typeof a.checks !== "object") a.checks = {};
    return a;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\/[^\s"'<>]+$/i.test(u || "") ? u : ""; }
  var statusTimer;
  function say(msg) {
    $("ptStatus").textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { $("ptStatus").textContent = ""; }, 3000);
  }

  // ---- business details -------------------------------------------------
  function defaultLong() {
    var names = items.map(function (it) { return it.name; }).filter(Boolean);
    return "Maison de Gaby is a home patisserie in Heliopolis (Masr El Gedida), Cairo, founded in 2026 by Mariam Algaby. " +
      "Every cake is baked to order by hand, with real butter and cream, and delivered in a gift box." +
      (names.length ? " The menu: " + names.join(", ") + "." : "") +
      " Order a day ahead on our website or WhatsApp.";
  }
  function value(key) {
    var saved = state.profile[key];
    if (typeof saved === "string") return saved;
    if (key === "long") return defaultLong();
    for (var i = 0; i < PROFILE.length; i++) if (PROFILE[i][0] === key) return PROFILE[i][2];
    return "";
  }
  function renderProfile() {
    $("ptProfile").innerHTML = PROFILE.map(function (p) {
      var long = p[3] > 120;
      var input = long
        ? '<textarea name="' + p[0] + '" rows="4" maxlength="' + p[3] + '">' + esc(value(p[0])) + "</textarea>"
        : '<input type="text" name="' + p[0] + '" maxlength="' + (p[3] || 160) + '" value="' + esc(value(p[0])) + '"' +
          (p[0] === "cr" ? ' placeholder="Add it once you have it"' : p[0] === "email" ? ' placeholder="Mariam’s business email"' : "") + ">";
      return '<div class="pt-field"><label class="field">' + esc(p[1]) + input + "</label>" +
        '<button type="button" class="link-btn pt-copy" data-copy-field="' + p[0] + '">Copy</button></div>';
    }).join("");
  }
  function profileText() {
    return PROFILE.map(function (p) {
      var v = value(p[0]).trim();
      return v ? p[1] + ": " + v : "";
    }).filter(Boolean).join("\n");
  }

  // ---- menu -----------------------------------------------------------------
  function photoUrl(p) { return !p ? "" : /^https?:/i.test(p) ? p : SITE + "/" + p.replace(/^\/+/, ""); }
  function menuText() {
    return items.map(function (it) {
      return it.name + " — " + it.price + " EGP" + (it.portion ? " (" + it.portion + ")" : "") +
        (it.desc ? "\n" + it.desc : "") + (it.ingredients ? "\nIngredients: " + it.ingredients : "");
    }).join("\n\n");
  }
  function renderMenu() {
    if (!items.length) {
      $("ptMenu").innerHTML = '<li class="muted">No desserts are published yet. Publish your menu first.</li>';
      return;
    }
    $("ptMenu").innerHTML = items.map(function (it) {
      var src = photoUrl(it.photo);
      return '<li class="pt-dish">' + (src ? '<img src="' + esc(it.photo) + '" alt="" width="96" height="72" loading="lazy">' : '<span class="pt-thumb"></span>') +
        '<div><strong>' + esc(it.name) + '</strong><span class="small muted">' + esc(it.portion ? it.portion + " · " : "") + esc(it.price) + " EGP" +
        (it.soldOut ? " · sold out" : "") + "</span></div>" +
        (src ? '<a class="link-btn" href="' + esc(it.photo) + '" download>Stand-in photo</a>' : "") + "</li>";
    }).join("");
  }
  function csv() {
    var cell = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var rows = [["Name", "Description", "Size", "Price (EGP)", "Ingredients and allergens", "Photo"]].concat(items.map(function (it) {
      return [it.name, it.desc, it.portion, it.price, it.ingredients, photoUrl(it.photo)];
    }));
    // A byte-order mark so Excel opens the accents (Crème, Brûlée) correctly.
    var blob = new Blob(["﻿" + rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "maison-de-gaby-menu.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---- apps -----------------------------------------------------------------
  function renderApps() {
    $("ptApps").innerHTML = APPS.map(function (p) {
      var a = app(p.id), live = a.status === "live" && safeUrl(a.url);
      var done = p.checklist.filter(function (c, i) { return a.checks[i]; }).length;
      return '<article class="pt-app is-' + esc(a.status) + '" data-app="' + p.id + '">' +
        '<header class="pt-app-head"><div><span class="pt-kind">' + esc(p.kind) + "</span><h3>" + esc(p.name) + "</h3></div>" +
          '<span class="pt-pill">' + esc(label(a.status)) + "</span></header>" +
        '<p class="pt-about">' + esc(p.about) + "</p>" +
        '<div class="pt-buttons">' +
          (live ? '<a class="btn btn-primary" href="' + esc(a.url) + '" target="_blank" rel="noopener">Open my listing ↗</a>'
                : '<a class="btn btn-primary" href="' + esc(p.signup) + '" target="_blank" rel="noopener" data-start="' + p.id + '">Start sign-up ↗</a>') +
          '<button type="button" class="btn btn-outline" data-copy-app="' + p.id + '">Copy everything for ' + esc(p.name) + "</button>" +
        "</div>" +
        '<details class="pt-more"><summary>What ' + esc(p.name) + " asks for · " + done + "/" + p.checklist.length + " ready</summary>" +
          '<ul class="pt-facts">' + p.facts.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
          (p.info ? '<p class="small"><a href="' + esc(p.info) + '" target="_blank" rel="noopener">Read ' + esc(p.name) + "’s partner page ↗</a></p>" : "") +
          '<p class="pt-sub">Have ready</p><ul class="pt-checks">' + p.checklist.map(function (c, i) {
            return '<li><label class="check"><input type="checkbox" data-check="' + i + '"' + (a.checks[i] ? " checked" : "") + "> " + esc(c) + "</label></li>";
          }).join("") + "</ul>" +
          '<div class="field-row"><label class="field">Status<select data-status>' + STATUSES.map(function (s) {
            return '<option value="' + s[0] + '"' + (a.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>";
          }).join("") + "</select></label>" +
          '<label class="field">Your listing link<input type="url" data-url maxlength="400" inputmode="url" placeholder="Paste it once you’re live" value="' + esc(a.url) + '"></label></div>' +
          '<label class="field">Notes<textarea data-notes rows="2" maxlength="400" placeholder="Who you spoke to, dates, account email…">' + esc(a.notes) + "</textarea></label>" +
        "</details></article>";
    }).join("");
  }
  function label(status) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i][0] === status) return STATUSES[i][1];
    return STATUSES[0][1];
  }
  function appText(p) {
    return "Maison de Gaby — application for " + p.name + "\n\n" + profileText() + "\n\nMENU\n\n" + menuText() +
      "\n\nLogo: " + SITE + "/assets/icon-512.png";
  }

  // ---- copy -----------------------------------------------------------------
  function copy(text, done) {
    function fallback() {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      t.remove();
      say(ok ? done : "Couldn't copy here. Select the text and copy it by hand.");
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { say(done); }, fallback);
    else fallback();
  }

  // ---- events -----------------------------------------------------------------
  function wire() {
    $("ptProfile").addEventListener("input", function (e) {
      if (!e.target.name) return;
      state.profile[e.target.name] = e.target.value;
      save();
    });
    $("partners").addEventListener("click", function (e) {
      var f = e.target.closest("[data-copy-field]");
      if (f) { copy(value(f.dataset.copyField), "Copied."); return; }
      var c = e.target.closest("[data-copy-app]");
      if (c) {
        var p = APPS.filter(function (x) { return x.id === c.dataset.copyApp; })[0];
        copy(appText(p), "Copied everything for " + p.name + ". Paste it into the form or an email.");
        return;
      }
      var s = e.target.closest("[data-start]");
      if (s && app(s.dataset.start).status === "todo") {
        app(s.dataset.start).status = "applying";
        save();
        setTimeout(renderApps, 0);
      }
    });
    $("ptApps").addEventListener("change", function (e) {
      var card = e.target.closest("[data-app]");
      if (!card) return;
      var a = app(card.dataset.app);
      if (e.target.matches("[data-check]")) a.checks[e.target.dataset.check] = e.target.checked;
      else if (e.target.matches("[data-status]")) a.status = e.target.value;
      else if (e.target.matches("[data-url]")) {
        var u = e.target.value.trim();
        if (u && !safeUrl(u)) { say("Paste the full link, starting with https://"); return; }
        a.url = u;
      } else if (e.target.matches("[data-notes]")) a.notes = e.target.value;
      else return;
      save();
      if (!e.target.matches("[data-notes]")) {
        var open = card.querySelector("details").open;
        renderApps();
        var again = $("ptApps").querySelector('[data-app="' + card.dataset.app + '"] details');
        if (again) again.open = open;
      }
    });
    $("ptCopyProfile").addEventListener("click", function () { copy(profileText(), "Copied your business details."); });
    $("ptCopyMenu").addEventListener("click", function () {
      if (!items.length) { say("Publish your menu first."); return; }
      copy(menuText(), "Copied your menu.");
    });
    $("ptCsv").addEventListener("click", function () {
      if (!items.length) { say("Publish your menu first."); return; }
      csv();
    });
  }

  function loadMenu() {
    fetch("api/menu?t=" + Date.now()).then(function (r) {
      return r.status === 404 ? fetch("data/menu.json") : r;
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      items = (d && Array.isArray(d.items) ? d.items : []).filter(function (it) { return it && it.name; });
      renderMenu();
      renderProfile();
    }).catch(function () {
      $("ptMenu").innerHTML = '<li class="muted">Your menu couldn’t load just now. Open this tab again in a minute.</li>';
    });
  }

  window.MAISON_PARTNERS = {
    show: function () {
      if (!started) {
        started = true;
        renderProfile();
        renderApps();
        wire();
      }
      loadMenu();
    }
  };
})();
