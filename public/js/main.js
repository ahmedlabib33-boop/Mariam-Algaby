(function () {
  "use strict";

  var M = window.MAISON;
  var STORE_KEY = "maison-mariam-box";
  var DETAILS_KEY = "maison-gaby-details";
  M.items = [];

  // ---- state ----------------------------------------------------------
  var box = load(STORE_KEY);
  var filter = "all";

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch (e) { return {}; }
  }
  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* private mode */ }
  }
  function save() { store(STORE_KEY, box); }
  function byId(id) {
    for (var i = 0; i < M.items.length; i++) if (M.items[i].id === id) return M.items[i];
    return null;
  }
  function money(n) { return n.toLocaleString("en-US") + " " + M.currency; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var $ = function (id) { return document.getElementById(id); };
  var waBase = "https://wa.me/" + M.whatsapp;

  // ---- menu -----------------------------------------------------------
  // The live menu is edited at /admin and served by /api/menu.
  // Only a 404 (nothing published yet, or a local preview) falls back to the
  // starting menu in data/menu.json; any other failure must not show it, or
  // customers would see old prices and desserts marked sold out.
  function loadMenu() {
    return fetch("api/menu").then(function (res) {
      return res.status === 404 ? fetch("data/menu.json") : res;
    }).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    }).then(function (d) {
      if (!d || !Array.isArray(d.items)) throw new Error("no items");
      return d.items;
    });
  }

  // "… Contains: eggs, dairy, nuts (pecans). Gluten-free." -> ["eggs", "dairy", "nuts (pecans)"]
  // Returns null when the ingredients don't list allergens, so nothing is claimed.
  function allergens(it) {
    var m = /contains:\s*([^.]*)/i.exec(it.ingredients || "");
    if (!m) return null;
    return m[1].split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function glutenFree(it) {
    var a = allergens(it);
    return !!a && !a.some(function (x) { return /gluten|wheat|flour/i.test(x); });
  }
  // Whole cakes are sized in cm ("20 cm cake"); everything else is a box or a piece.
  function kind(it) { return /\bcm\b/i.test(it.portion || "") ? "cakes" : "boxes"; }

  var FILTERS = [
    ["all", "All"],
    ["cakes", "Whole cakes"],
    ["boxes", "Boxes"],
    ["gf", "Gluten-free"]
  ];
  function matches(it) {
    if (filter === "all") return true;
    if (filter === "gf") return glutenFree(it);
    return kind(it) === filter;
  }
  function renderFilters() {
    var counts = { all: M.items.length, cakes: 0, boxes: 0, gf: 0 };
    M.items.forEach(function (it) { counts[kind(it)]++; if (glutenFree(it)) counts.gf++; });
    // Filters only help when the menu actually splits into groups.
    var useful = M.items.length > 4 && counts.cakes && counts.boxes;
    $("filters").hidden = !useful;
    if (!useful) { filter = "all"; return; }
    if (!counts[filter]) filter = "all";
    $("filters").innerHTML = FILTERS.filter(function (f) { return counts[f[0]]; }).map(function (f) {
      return '<button type="button" class="chip-btn" data-filter="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' +
        f[1] + ' <span>' + counts[f[0]] + "</span></button>";
    }).join("");
  }

  var PLACEHOLDERS = '<div class="dish placeholder"></div><div class="dish placeholder"></div><div class="dish placeholder"></div>';

  function start() {
    $("menuGrid").innerHTML = PLACEHOLDERS;
    loadMenu().then(function (items) {
      M.items = items;
      renderFilters();
      renderMenu();
      // Only animate the cards on first load, not on every add/remove.
      setTimeout(function () { $("menuGrid").classList.add("ready"); }, 900);
      renderBox();
    }).catch(function () {
      // The saved box is left untouched, so nothing is lost when the menu comes back.
      $("menuGrid").innerHTML = '<p class="menu-note">The menu couldn\'t load just now. ' +
        '<button type="button" class="link-btn" data-retry>Try again</button></p>';
    });
  }

  function dishCard(it, n) {
    var qty = box[it.id] || 0;
    var a = allergens(it);
    var gf = glutenFree(it);
    return '<article class="dish' + (it.soldOut ? " is-sold-out" : "") + '" style="--i:' + n + '">' +
      '<div class="dish-art">' + (it.photo ? '<img src="' + esc(it.photo) + '" alt="' + esc(it.name) + '" width="900" height="675" loading="lazy" decoding="async">' : "") +
        '<span class="dish-no">N° ' + String(n).padStart(2, "0") + "</span>" +
        (gf ? '<span class="dish-badge">Gluten-free</span>' : "") +
        (it.soldOut ? '<span class="sold-tag">Sold out today</span>' : "") + "</div>" +
      '<div class="dish-body">' +
        "<h3>" + esc(it.name) + "</h3>" +
        '<p class="dish-desc">' + esc(it.desc) + "</p>" +
        (a && a.length ? '<p class="dish-allergens"><span class="sr">Contains: </span>' + a.map(esc).join('<i aria-hidden="true"> · </i>') + "</p>" : "") +
        (it.ingredients ? '<details class="dish-ingr" data-id="' + esc(it.id) + '"><summary>Ingredients</summary><p>' + esc(it.ingredients) + "</p></details>" : "") +
        '<div class="dish-meta"><span>' + esc(it.portion) + '</span><span class="price">' + money(it.price) + "</span></div>" +
        (it.soldOut
          ? '<button class="btn btn-outline btn-block" disabled>Sold out</button>'
          : qty
          ? '<div class="stepper" data-id="' + esc(it.id) + '"><button data-act="dec" aria-label="Remove one ' + esc(it.name) + '">−</button><span aria-live="polite">' + qty +
            ' in your box</span><button data-act="inc" aria-label="Add one more ' + esc(it.name) + '">+</button></div>'
          : '<button class="btn btn-outline btn-block" data-act="add" data-id="' + esc(it.id) + '">Add to my box</button>') +
      "</div></article>";
  }

  function renderMenu() {
    if (!M.items.length) {
      $("menuGrid").innerHTML = '<p class="menu-note">There are no desserts on the menu right now. Please check back soon.</p>';
      return;
    }
    // Keep any open ingredients lists open when the cards are redrawn.
    var open = {};
    document.querySelectorAll(".dish-ingr[open]").forEach(function (d) { open[d.dataset.id] = true; });
    var html = "";
    M.items.forEach(function (it, i) { if (matches(it)) html += dishCard(it, i + 1); });
    $("menuGrid").innerHTML = html;
    Object.keys(open).forEach(function (id) {
      var d = $("menuGrid").querySelector('.dish-ingr[data-id="' + CSS.escape(id) + '"]');
      if (d) d.open = true;
    });
  }

  // ---- box ------------------------------------------------------------
  function totals() {
    var count = 0, sum = 0;
    Object.keys(box).forEach(function (id) {
      var it = byId(id);
      if (!it || it.soldOut) { delete box[id]; return; }
      count += box[id];
      sum += box[id] * it.price;
    });
    return { count: count, sum: sum };
  }

  function renderBox() {
    var t = totals();
    $("boxCount").textContent = t.count;
    $("boxCount").classList.toggle("has", t.count > 0);
    $("boxTotal").textContent = money(t.sum);
    $("boxEmpty").hidden = t.count > 0;
    $("orderForm").hidden = t.count === 0;
    $("sendOrder").disabled = t.count === 0;
    $("mbarCount").textContent = t.count + (t.count === 1 ? " item" : " items");
    $("mbarTotal").textContent = money(t.sum);
    document.body.classList.toggle("has-box", t.count > 0);
    $("mbar").hidden = t.count === 0;
    if (t.count === 0) $("sentNote").hidden = true;
    $("boxList").innerHTML = Object.keys(box).map(function (id) {
      var it = byId(id);
      return '<li>' + (it.photo ? '<img src="' + esc(it.photo) + '" alt="" width="64" height="48" loading="lazy">' : '<span class="thumb"></span>') +
        '<div class="box-item"><strong>' + esc(it.name) + '</strong><span class="muted small">' + esc(it.portion) + " · " + money(it.price) + "</span></div>" +
        '<div class="stepper small" data-id="' + esc(id) + '"><button data-act="dec" aria-label="Remove one ' + esc(it.name) + '">−</button><span>' + box[id] +
        '</span><button data-act="inc" aria-label="Add one more ' + esc(it.name) + '">+</button></div></li>';
    }).join("");
  }

  function change(id, delta) {
    box[id] = (box[id] || 0) + delta;
    if (box[id] <= 0) delete box[id];
    save();
    renderMenu();
    renderBox();
    if (delta > 0) bump();
  }

  function bump() {
    [$("boxCount"), $("mbar")].forEach(function (el) {
      el.classList.remove("bump");
      void el.offsetWidth; // restart the animation
      el.classList.add("bump");
    });
  }

  // ---- drawer ---------------------------------------------------------
  var lastFocus = null;
  function isOpen() { return $("drawer").classList.contains("open"); }
  function openBox() {
    lastFocus = document.activeElement;
    $("toast").classList.remove("show");
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("openBox").setAttribute("aria-expanded", "true");
    $("scrim").hidden = false;
    document.body.classList.add("locked");
    setTimeout(function () { $("closeBox").focus(); }, 50);
  }
  function closeBox() {
    if (!isOpen()) return;
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("openBox").setAttribute("aria-expanded", "false");
    $("scrim").hidden = true;
    document.body.classList.remove("locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  // Keep keyboard focus inside the open drawer.
  function trapFocus(e) {
    if (e.key !== "Tab" || !isOpen()) return;
    var els = Array.prototype.filter.call(
      $("drawer").querySelectorAll("button, a[href], input, select, textarea"),
      function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  var toastTimer;
  function toast(msg, withAction) {
    var el = $("toast");
    el.innerHTML = esc(msg) + (withAction ? ' <button type="button" class="toast-act" data-open-box>View box</button>' : "");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2800);
  }

  // ---- dates ----------------------------------------------------------
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function niceDate(iso) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var minDate = isoDate(tomorrow);

  // ---- details (remembered on this device only) ------------------------
  var REMEMBER = ["name", "area", "address"];
  function restoreDetails() {
    var d = load(DETAILS_KEY), f = $("orderForm");
    REMEMBER.forEach(function (k) { if (d[k]) f[k].value = d[k]; });
    if (d.area && f.area.value !== d.area) f.area.selectedIndex = 0;
  }
  function rememberDetails() {
    var f = $("orderForm");
    if (!f.remember.checked) { store(DETAILS_KEY, null); return; }
    var d = {};
    REMEMBER.forEach(function (k) { d[k] = f[k].value.trim(); });
    store(DETAILS_KEY, d);
  }

  // ---- order ----------------------------------------------------------
  var lastUrl = "";
  function orderRef() {
    var now = new Date();
    var rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return "MG-" + String(now.getDate()).padStart(2, "0") + String(now.getMonth() + 1).padStart(2, "0") + "-" + rand;
  }

  function sendOrder() {
    var f = $("orderForm");
    var name = f.name.value.trim(), date = f.date.value;
    var gift = f.gift.checked;
    $("formError").textContent = "";
    var problem =
      !name ? ["name", "Please add your name."] :
      !date ? ["date", "Please choose a delivery date."] :
      date < minDate ? ["date", "Orders need 24 hours, so please pick tomorrow or later."] :
      gift && !f.toName.value.trim() ? ["toName", "Please add the name of the person receiving the gift."] :
      gift && !f.address.value.trim() ? ["address", "Please add the address the gift goes to."] :
      null;
    if (problem) {
      $("formError").textContent = problem[1];
      f[problem[0]].focus();
      return;
    }

    var t = totals();
    var lines = ["Hello Maison de Gaby! I'd like to order:", "Order " + orderRef(), ""];
    Object.keys(box).forEach(function (id) {
      var it = byId(id);
      lines.push("• " + box[id] + " × " + it.name + " (" + it.portion + ") = " + money(it.price * box[id]));
    });
    lines.push("", "Total: " + money(t.sum) + " + delivery", "",
      "Name: " + name,
      "Delivery: " + niceDate(date) + ", " + f.slot.value,
      "Area: " + f.area.value);
    if (f.address.value.trim()) lines.push("Address: " + f.address.value.trim());
    if (gift) {
      lines.push("", "It's a gift for: " + f.toName.value.trim() + (f.toPhone.value.trim() ? " (" + f.toPhone.value.trim() + ")" : ""));
      if (f.card.value.trim()) lines.push("Card message: \"" + f.card.value.trim() + "\"");
    }
    if (f.note.value.trim()) lines.push("", "Note: " + f.note.value.trim());
    lines.push("", "Thank you!");

    rememberDetails();
    lastUrl = waBase + "?text=" + encodeURIComponent(lines.join("\n"));
    window.open(lastUrl, "_blank", "noopener");
    $("sentNote").hidden = false;
  }

  function newBox() {
    box = {};
    save();
    var f = $("orderForm");
    ["date", "toName", "toPhone", "card", "note"].forEach(function (k) { f[k].value = ""; });
    f.gift.checked = false;
    $("giftFields").hidden = true;
    $("sentNote").hidden = true;
    $("dateHint").textContent = "";
    renderMenu();
    renderBox();
    closeBox();
    toast("Your box is empty and ready for a new order.");
  }

  // ---- wire up --------------------------------------------------------
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-retry]")) { start(); return; }
    if (e.target.closest("[data-open-box]")) { $("toast").classList.remove("show"); openBox(); return; }
    var chip = e.target.closest("[data-filter]");
    if (chip) {
      filter = chip.dataset.filter;
      renderFilters();
      renderMenu();
      return;
    }
    var btn = e.target.closest("[data-act]");
    if (btn) {
      var id = btn.dataset.id || btn.closest("[data-id]").dataset.id;
      var act = btn.dataset.act;
      if (act === "add") { change(id, 1); toast(byId(id).name + " added to your box", true); }
      else change(id, act === "inc" ? 1 : -1);
      return;
    }
    if (e.target.closest("[data-close]")) closeBox();
  });

  $("openBox").addEventListener("click", openBox);
  $("mbar").addEventListener("click", openBox);
  $("closeBox").addEventListener("click", closeBox);
  $("scrim").addEventListener("click", closeBox);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeBox();
    trapFocus(e);
  });
  $("sendOrder").addEventListener("click", sendOrder);
  $("resend").addEventListener("click", function () { if (lastUrl) window.open(lastUrl, "_blank", "noopener"); });
  $("newBox").addEventListener("click", newBox);
  $("giftToggle").addEventListener("change", function (e) {
    $("giftFields").hidden = !e.target.checked;
    if (e.target.checked) $("orderForm").toName.focus();
  });

  var f = $("orderForm");
  f.date.min = minDate;
  f.date.addEventListener("change", function () {
    $("dateHint").textContent = f.date.value && f.date.value >= minDate ? niceDate(f.date.value) : "";
  });
  restoreDetails();
  // Editing the form after sending means it's a new version of the order.
  f.addEventListener("input", function () { $("sentNote").hidden = true; $("formError").textContent = ""; });

  $("nextDelivery").textContent = "Order today for delivery from tomorrow, " + niceDate(minDate) + ".";

  // "201550505386" -> "0155 050 5386"
  function localNumber(n) { return ("0" + n.slice(2)).replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3"); }
  $("waLink").href = waBase;
  $("waLink").textContent = localNumber(M.whatsapp);
  if (M.whatsapp2) {
    $("waLink2").href = "https://wa.me/" + M.whatsapp2;
    $("waLink2").textContent = localNumber(M.whatsapp2);
    $("wa2Row").hidden = false;
  }
  var ask = waBase + "?text=" + encodeURIComponent("Hello Maison de Gaby! I have a question:");
  $("askLink").href = ask;
  $("askLink2").href = ask;
  $("igLink").href = M.instagram;
  $("year").textContent = new Date().getFullYear();

  // Sections fade in as they scroll into view.
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  start();
})();
