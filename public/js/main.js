(function () {
  "use strict";

  var M = window.MAISON;
  var STORE_KEY = "maison-mariam-box";
  M.items = [];

  // ---- state ----------------------------------------------------------
  var box = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(box)); } catch (e) { /* private mode */ }
  }
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

  var PLACEHOLDERS = '<div class="dish placeholder"></div><div class="dish placeholder"></div><div class="dish placeholder"></div>';

  function start() {
    $("menuGrid").innerHTML = PLACEHOLDERS;
    loadMenu().then(function (items) {
      M.items = items;
      renderMenu();
      // Only animate the cards on first load, not on every add/remove.
      setTimeout(function () { $("menuGrid").classList.add("ready"); }, 800);
      renderBox();
    }).catch(function () {
      // The saved box is left untouched, so nothing is lost when the menu comes back.
      $("menuGrid").innerHTML = '<p class="menu-note">The menu couldn\'t load just now. ' +
        '<button type="button" class="link-btn" data-retry>Try again</button></p>';
    });
  }

  function renderMenu() {
    if (!M.items.length) {
      $("menuGrid").innerHTML = '<p class="menu-note">There are no desserts on the menu right now. Please check back soon.</p>';
      return;
    }
    // Keep any open ingredients lists open when the cards are redrawn.
    var open = {};
    document.querySelectorAll(".dish-ingr[open]").forEach(function (d) { open[d.dataset.id] = true; });
    var n = 0;
    $("menuGrid").innerHTML = M.items.map(function (it) {
      n++;
      var qty = box[it.id] || 0;
      return '<article class="dish' + (it.soldOut ? " is-sold-out" : "") + '">' +
        '<div class="dish-art">' + (it.photo ? '<img src="' + esc(it.photo) + '" alt="' + esc(it.name) + '" width="900" height="675" loading="lazy">' : "") +
          '<span class="dish-no">N° ' + String(n).padStart(2, "0") + "</span>" +
          (it.soldOut ? '<span class="sold-tag">Sold out today</span>' : "") + "</div>" +
        '<div class="dish-body">' +
          '<h3>' + esc(it.name) + '</h3>' +
          '<p class="dish-desc">' + esc(it.desc) + "</p>" +
          (it.ingredients ? '<details class="dish-ingr" data-id="' + esc(it.id) + '"' + (open[it.id] ? " open" : "") + '><summary>Ingredients</summary><p>' + esc(it.ingredients) + "</p></details>" : "") +
          '<div class="dish-meta"><span>' + esc(it.portion) + '</span><span class="price">' + money(it.price) + "</span></div>" +
          (it.soldOut
            ? '<button class="btn btn-outline btn-block" disabled>Sold out</button>'
            : qty
            ? '<div class="stepper" data-id="' + esc(it.id) + '"><button data-act="dec" aria-label="Remove one">−</button><span>' + qty +
              '</span><button data-act="inc" aria-label="Add one">+</button></div>'
            : '<button class="btn btn-outline btn-block" data-act="add" data-id="' + esc(it.id) + '">Add to my box</button>') +
        "</div></article>";
    }).join("");
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
    $("boxList").innerHTML = Object.keys(box).map(function (id) {
      var it = byId(id);
      return '<li><div><strong>' + esc(it.name) + '</strong><span class="muted small">' + esc(it.portion) + " · " + money(it.price) + "</span></div>" +
        '<div class="stepper small" data-id="' + esc(id) + '"><button data-act="dec" aria-label="Remove one">−</button><span>' + box[id] +
        '</span><button data-act="inc" aria-label="Add one">+</button></div></li>';
    }).join("");
  }

  function change(id, delta) {
    box[id] = (box[id] || 0) + delta;
    if (box[id] <= 0) delete box[id];
    save();
    renderMenu();
    renderBox();
  }

  // ---- drawer ---------------------------------------------------------
  function openBox() {
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("scrim").hidden = false;
    document.body.classList.add("locked");
  }
  function closeBox() {
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("scrim").hidden = true;
    document.body.classList.remove("locked");
  }

  var toastTimer;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  // ---- order ----------------------------------------------------------
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function sendOrder() {
    var f = $("orderForm");
    var name = f.name.value.trim(), date = f.date.value;
    $("formError").textContent = "";
    if (!name || !date) {
      $("formError").textContent = "Please add your name and a delivery date.";
      return;
    }
    if (date < f.date.min) {
      $("formError").textContent = "Orders need 24 hours, so please pick tomorrow or later.";
      return;
    }
    var t = totals();
    var lines = ["Hello Maison de Gaby! I'd like to order:", ""];
    Object.keys(box).forEach(function (id) {
      var it = byId(id);
      lines.push("• " + box[id] + " × " + it.name + " (" + it.portion + ") = " + money(it.price * box[id]));
    });
    lines.push("", "Total: " + money(t.sum), "",
      "Name: " + name,
      "Delivery date: " + date,
      "Area: " + f.area.value);
    if (f.address.value.trim()) lines.push("Address: " + f.address.value.trim());
    if (f.note.value.trim()) lines.push("Note: " + f.note.value.trim());
    lines.push("", "Thank you!");

    var url = "https://wa.me/" + M.whatsapp + "?text=" + encodeURIComponent(lines.join("\n"));
    window.open(url, "_blank", "noopener");
  }

  // ---- wire up --------------------------------------------------------
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-retry]")) { start(); return; }
    var btn = e.target.closest("[data-act]");
    if (btn) {
      var id = btn.dataset.id || btn.closest("[data-id]").dataset.id;
      var act = btn.dataset.act;
      if (act === "add") { change(id, 1); toast(byId(id).name + " added to your box"); }
      else change(id, act === "inc" ? 1 : -1);
      return;
    }
    if (e.target.closest("[data-close]")) closeBox();
  });

  $("openBox").addEventListener("click", openBox);
  $("closeBox").addEventListener("click", closeBox);
  $("scrim").addEventListener("click", closeBox);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBox(); });
  $("sendOrder").addEventListener("click", sendOrder);

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  $("orderForm").date.min = isoDate(tomorrow);

  // "201550505386" -> "0155 050 5386"
  function localNumber(n) { return ("0" + n.slice(2)).replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3"); }
  $("waLink").href = "https://wa.me/" + M.whatsapp;
  $("waLink").textContent = localNumber(M.whatsapp);
  if (M.whatsapp2) {
    $("waLink2").href = "https://wa.me/" + M.whatsapp2;
    $("waLink2").textContent = localNumber(M.whatsapp2);
    $("wa2Row").hidden = false;
  }
  $("igLink").href = M.instagram;
  $("year").textContent = new Date().getFullYear();

  start();
})();
