(function () {
  "use strict";

  var M = window.MAISON;
  var STORE_KEY = "maison-mariam-box";

  var ICONS = {
    pot: '<path d="M14 30h52M18 30v18a8 8 0 0 0 8 8h28a8 8 0 0 0 8-8V30M10 30h4M66 30h4M30 22c0-4 4-4 4-8M40 22c0-4 4-4 4-8M50 22c0-4 4-4 4-8"/>',
    tray: '<path d="M8 40h64l-6 14H14zM16 40c2-8 10-12 24-12s22 4 24 12M28 34h2M38 32h2M48 34h2"/>',
    tart: '<path d="M10 44c0-8 13-14 30-14s30 6 30 14-13 12-30 12-30-4-30-12zM10 44c0 4 13 8 30 8s30-4 30-8M24 36l4 6M38 33l2 7M54 36l-4 6"/>',
    cake: '<path d="M14 34h52v20H14zM14 44h52M22 34v-4M34 34v-4M46 34v-4M58 34v-4M22 30a2 2 0 1 1 0-.1M34 30a2 2 0 1 1 0-.1M46 30a2 2 0 1 1 0-.1M58 30a2 2 0 1 1 0-.1"/>',
    jar: '<path d="M28 22h24M30 22v6c-6 2-8 6-8 12v10a6 6 0 0 0 6 6h24a6 6 0 0 0 6-6V40c0-6-2-10-8-12v-6M22 42h36"/>'
  };

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
  var activeCat = M.categories[0].id;

  function renderTabs() {
    $("tabs").innerHTML = M.categories.map(function (c) {
      var on = c.id === activeCat;
      return '<button role="tab" aria-selected="' + on + '" class="tab' + (on ? " is-active" : "") +
        '" data-cat="' + c.id + '"><span class="tab-fr">' + esc(c.fr) + '</span><span class="tab-en">' + esc(c.en) + "</span></button>";
    }).join("");
  }

  function renderMenu() {
    var n = 0;
    $("menuGrid").innerHTML = M.items.filter(function (it) { return it.cat === activeCat; }).map(function (it) {
      n++;
      var qty = box[it.id] || 0;
      return '<article class="dish">' +
        '<div class="dish-art"><svg viewBox="0 0 80 70" aria-hidden="true">' + (ICONS[it.icon] || ICONS.pot) + "</svg>" +
          '<span class="dish-no">N° ' + String(n).padStart(2, "0") + "</span></div>" +
        '<div class="dish-body">' +
          '<h3>' + esc(it.name) + '</h3>' +
          '<p class="dish-ar" lang="ar" dir="rtl">' + esc(it.ar) + "</p>" +
          '<p class="dish-desc">' + esc(it.desc) + "</p>" +
          '<div class="dish-meta"><span>' + esc(it.portion) + '</span><span class="price">' + money(it.price) + "</span></div>" +
          (qty
            ? '<div class="stepper" data-id="' + it.id + '"><button data-act="dec" aria-label="Remove one">−</button><span>' + qty +
              '</span><button data-act="inc" aria-label="Add one">+</button></div>'
            : '<button class="btn btn-outline btn-block" data-act="add" data-id="' + it.id + '">Ajouter à ma boîte</button>') +
        "</div></article>";
    }).join("");
  }

  // ---- box ------------------------------------------------------------
  function totals() {
    var count = 0, sum = 0;
    Object.keys(box).forEach(function (id) {
      var it = byId(id);
      if (!it) { delete box[id]; return; }
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
        '<div class="stepper small" data-id="' + id + '"><button data-act="dec" aria-label="Remove one">−</button><span>' + box[id] +
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
    var lines = ["Bonjour Maison Mariam! I'd like to order:", ""];
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
    lines.push("", "Merci!");

    var url = "https://wa.me/" + M.whatsapp + "?text=" + encodeURIComponent(lines.join("\n"));
    window.open(url, "_blank", "noopener");
  }

  // ---- wire up --------------------------------------------------------
  document.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-cat]");
    if (tab) { activeCat = tab.dataset.cat; renderTabs(); renderMenu(); return; }

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

  $("waLink").href = "https://wa.me/" + M.whatsapp;
  $("igLink").href = M.instagram;
  $("year").textContent = new Date().getFullYear();

  renderTabs();
  renderMenu();
  renderBox();
})();
