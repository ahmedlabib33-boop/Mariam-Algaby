(function () {
  "use strict";

  var PW_KEY = "maison-mariam-admin";
  var MAX_PHOTO_SIDE = 1400;

  var password = "";
  var items = [];
  var dirty = false;
  var uploading = 0;
  var editing = -1; // index of the dessert open in the sheet
  var tab = "menu";
  var menuReady = false;
  var recipesLoaded = false;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return Number(n || 0).toLocaleString("en-US") + " EGP"; }

  var toastTimer;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  // ---- storage of the password on this device -------------------------
  function storedPassword() {
    try { return localStorage.getItem(PW_KEY) || sessionStorage.getItem(PW_KEY) || ""; }
    catch (e) { return ""; }
  }
  function storePassword(pw, remember) {
    try {
      (remember ? localStorage : sessionStorage).setItem(PW_KEY, pw);
    } catch (e) { /* private mode: stays signed in for this page only */ }
  }
  function forgetPassword() {
    try { localStorage.removeItem(PW_KEY); sessionStorage.removeItem(PW_KEY); } catch (e) { /* ignore */ }
  }

  // ---- API ------------------------------------------------------------
  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ "x-admin-password": password }, options.headers || {});
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { signOut("Your password has changed. Please sign in again."); throw new Error("signed out"); }
        if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
        return data;
      });
    });
  }

  // Only a 404 (nothing published yet) starts from data/menu.json. Any other
  // failure must stop here: editing the starting menu and publishing it would
  // replace Mariam's real menu.
  function loadMenu() {
    // The time stamp skips the CDN cache, so the editor always shows the latest menu.
    return fetch("api/menu?t=" + Date.now()).then(function (res) {
      return res.status === 404 ? fetch("data/menu.json") : res;
    }).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    }).then(function (d) {
      if (!d || !Array.isArray(d.items)) throw new Error("no items");
      return d.items;
    });
  }

  // ---- screens --------------------------------------------------------
  function showLogin(message) {
    $("login").hidden = false;
    $("editor").hidden = true;
    $("recipes").hidden = true;
    $("tabs").hidden = true;
    $("bar").hidden = true;
    recipesLoaded = false;
    $("signOut").hidden = true;
    $("loginError").textContent = message || "";
    $("loginForm").password.focus();
  }

  function showEditor() {
    $("login").hidden = true;
    $("signOut").hidden = false;
    $("tabs").hidden = false;
    $("loadError").hidden = true;
    $("retryLoad").disabled = true;
    menuReady = false;
    showTab(tab);
    loadMenu().then(function (list) {
      items = list;
      menuReady = true;
      $("list").hidden = false;
      $("addItem").hidden = false;
      setDirty(false);
      render();
    }).catch(function () {
      items = [];
      $("list").hidden = true;
      $("empty").hidden = true;
      $("addItem").hidden = true;
      $("loadError").hidden = false;
    }).then(function () {
      showTab(tab);
      $("retryLoad").disabled = false;
    });
  }

  function signOut(message) {
    if ($("sheet").open) $("sheet").close();
    editing = -1;
    forgetPassword();
    password = "";
    showLogin(message);
  }

  function showTab(name) {
    tab = name;
    $("editor").hidden = name !== "menu";
    $("recipes").hidden = name !== "recipes";
    $("bar").hidden = !(name === "menu" && menuReady);
    Array.prototype.forEach.call(document.querySelectorAll(".ad-tab"), function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on);
    });
    if (name === "recipes" && !recipesLoaded) loadRecipes();
  }

  // ---- recipes (private, read-only here) --------------------------------
  function loadRecipes() {
    $("recipesMsg").hidden = false;
    $("recipesMsg").textContent = "Loading your recipes…";
    api("api/recipes?t=" + Date.now()).then(function (data) {
      recipesLoaded = true;
      var list = data.recipes || [];
      $("recipesMsg").hidden = list.length > 0;
      $("recipesMsg").textContent = "No recipes yet.";
      $("recipeList").innerHTML = list.map(renderRecipe).join("");
    }).catch(function (err) {
      if (err.message === "signed out") return;
      $("recipesMsg").textContent = "Your recipes couldn't be loaded. Please try again in a moment.";
    });
  }

  function renderRecipe(r) {
    function list(items, cls) {
      return items && items.length ? '<ul class="' + cls + '">' + items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "";
    }
    var meta = [r.yield, r.time, r.oven].filter(Boolean).map(function (m) { return '<span class="rc-chip">' + esc(m) + "</span>"; }).join("");
    var groups = (r.ingredients || []).map(function (g) {
      return (g.title ? "<h4>" + esc(g.title) + "</h4>" : "") + '<table class="rc-ingr">' +
        g.items.map(function (row) { return "<tr><td>" + esc(row[0]) + "</td><td>" + esc(row[1]) + "</td></tr>"; }).join("") + "</table>";
    }).join("");
    var steps = (r.steps || []).map(function (s) {
      return '<li class="rc-step">' + (s.title ? "<strong>" + esc(s.title) + ".</strong> " : "") + esc(s.text) + "</li>";
    }).join("");
    return '<details class="rc">' +
      '<summary><span class="rc-name">' + esc(r.name) + '</span><span class="rc-src">' + esc(r.source) + "</span></summary>" +
      '<div class="rc-body">' +
        (meta ? '<div class="rc-meta">' + meta + "</div>" : "") +
        (r.intro ? '<p class="rc-intro">' + esc(r.intro) + "</p>" : "") +
        (r.equipment && r.equipment.length ? "<h3>Equipment</h3>" + list(r.equipment, "rc-bullets") : "") +
        "<h3>Ingredients</h3>" + groups +
        '<h3>Method</h3><ol class="rc-steps">' + steps + "</ol>" +
        (r.tips && r.tips.length ? "<h3>Tips</h3>" + list(r.tips, "rc-bullets") : "") +
        (r.storage ? "<h3>Storage</h3><p>" + esc(r.storage) + "</p>" : "") +
        (r.sourceUrl ? '<p class="rc-link">Source: <a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">' + esc(r.source) + "</a></p>" : "") +
      "</div></details>";
  }

  // ---- list -----------------------------------------------------------
  function render() {
    $("empty").hidden = items.length > 0;
    $("list").innerHTML = items.map(function (it, i) {
      var thumb = it.photo
        ? '<img class="ad-thumb" src="' + esc(it.photo) + '" alt="">'
        : '<span class="ad-thumb empty">No photo</span>';
      return '<li class="ad-item' + (it.soldOut ? " is-sold-out" : "") + '">' +
        '<button type="button" class="ad-edit" data-edit="' + i + '">' + thumb +
          '<span class="ad-text"><span class="ad-name">' + esc(it.name || "Untitled") + "</span>" +
          '<span class="ad-meta">' + money(it.price) + (it.portion ? " · " + esc(it.portion) : "") + "</span>" +
          (it.soldOut ? '<br><span class="ad-sold">Sold out</span>' : "") + "</span></button>" +
        '<div class="ad-tools">' +
          '<label class="switch">Available <input type="checkbox" data-avail="' + i + '"' + (it.soldOut ? "" : " checked") + "></label>" +
          '<div class="ad-move">' +
            '<button type="button" data-move="' + i + '" data-dir="-1" aria-label="Move up"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
            '<button type="button" data-move="' + i + '" data-dir="1" aria-label="Move down"' + (i === items.length - 1 ? " disabled" : "") + ">↓</button>" +
          "</div>" +
        "</div></li>";
    }).join("");
  }

  function setDirty(value) {
    dirty = value;
    var el = $("status");
    el.className = "ad-status" + (value ? " dirty" : "");
    el.textContent = value ? "You have changes that aren't on the website yet." : "Everything is published.";
    $("publish").disabled = !value || uploading > 0;
  }

  // ---- edit sheet -----------------------------------------------------
  function openSheet(i) {
    editing = i;
    var it = items[i];
    var f = $("itemForm");
    f.name.value = it.name || "";
    f.desc.value = it.desc || "";
    f.ingredients.value = it.ingredients || "";
    f.portion.value = it.portion || "";
    f.price.value = it.price || "";
    f.soldOut.checked = !!it.soldOut;
    $("itemError").textContent = "";
    showPhoto(it.photo);
    $("sheetTitle").textContent = it.name ? "Edit dessert" : "New dessert";
    $("sheet").showModal();
  }

  function showPhoto(url) {
    $("photoFrame").innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : '<span class="muted">No photo yet</span>';
    $("photoBtnText").textContent = url ? "Change photo" : "Choose a photo";
  }

  function saveSheet() {
    var f = $("itemForm");
    var name = f.name.value.trim();
    var price = Number(f.price.value);
    if (!name) { $("itemError").textContent = "Please give the dessert a name."; f.name.focus(); return false; }
    if (!f.price.value || !(price >= 0)) { $("itemError").textContent = "Please add a price."; f.price.focus(); return false; }
    var it = items[editing];
    it.name = name;
    it.desc = f.desc.value.trim();
    it.ingredients = f.ingredients.value.trim();
    it.portion = f.portion.value.trim();
    it.price = Math.round(price);
    it.soldOut = f.soldOut.checked;
    return true;
  }

  function closeSheet() {
    // A brand-new dessert that was never named is dropped.
    if (editing > -1 && !items[editing].name) items.splice(editing, 1);
    editing = -1;
    $("sheet").close();
    render();
  }

  // ---- photos ---------------------------------------------------------
  // Phone photos are often 5–10 MB; shrink them before uploading.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error("This photo could not be read. Please try another one."));
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("This photo could not be read. Please try a JPG or PNG."));
      };
      img.src = url;
    });
  }

  function uploadPhoto(file) {
    var it = items[editing];
    uploading++;
    $("publish").disabled = true;
    $("doneItem").disabled = true;
    $("photoFrame").classList.add("busy");
    $("itemError").textContent = "";
    shrink(file)
      .then(function (blob) {
        return api("api/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      })
      .then(function (data) {
        it.photo = data.url;
        if (items[editing] === it) showPhoto(it.photo);
        setDirty(true);
      })
      .catch(function (err) {
        if (err.message !== "signed out") $("itemError").textContent = err.message;
      })
      .then(function () {
        uploading--;
        $("photoFrame").classList.remove("busy");
        $("doneItem").disabled = false;
        setDirty(dirty);
      });
  }

  // ---- publish --------------------------------------------------------
  function publish() {
    var missing = items.filter(function (it) { return !it.name; });
    if (missing.length) { toast("Every dessert needs a name before publishing."); return; }
    $("publish").disabled = true;
    $("status").textContent = "Publishing…";
    api("api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items })
    }).then(function (data) {
      items = data.items;
      render();
      setDirty(false);
      $("status").className = "ad-status ok";
      $("status").textContent = "Published ✓ Your changes will be on the website within a minute.";
    }).catch(function (err) {
      if (err.message === "signed out") return;
      setDirty(true);
      $("status").textContent = err.message;
    });
  }

  // ---- events ---------------------------------------------------------
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    var pw = f.password.value;
    $("loginError").textContent = "";
    f.querySelector("button").disabled = true;
    fetch("api/login", { method: "POST", headers: { "x-admin-password": pw } })
      .then(function (res) {
        if (res.status === 401) throw new Error("That password isn't right. Please try again.");
        if (!res.ok) throw new Error("The editor isn't available right now. Please try again later.");
        password = pw;
        storePassword(pw, f.remember.checked);
        f.reset();
        showEditor();
      })
      .catch(function (err) { $("loginError").textContent = err.message; })
      .then(function () { f.querySelector("button").disabled = false; });
  });

  $("signOut").addEventListener("click", function () {
    if (dirty && !confirm("You have changes that aren't published. Sign out anyway?")) return;
    setDirty(false);
    signOut();
  });

  $("list").addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    if (edit) { openSheet(Number(edit.dataset.edit)); return; }
    var move = e.target.closest("[data-move]");
    if (move) {
      var i = Number(move.dataset.move), j = i + Number(move.dataset.dir);
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
      setDirty(true);
      render();
    }
  });

  $("list").addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.avail === undefined) return;
    items[Number(t.dataset.avail)].soldOut = !t.checked;
    setDirty(true);
    render();
  });

  $("addItem").addEventListener("click", function () {
    items.push({ id: "d" + Date.now().toString(36), name: "", desc: "", ingredients: "", portion: "", price: 0, photo: "", soldOut: false });
    openSheet(items.length - 1);
  });

  $("itemForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (uploading) return;
    if (saveSheet()) { setDirty(true); closeSheet(); }
  });

  $("sheet").addEventListener("click", function (e) {
    if (e.target.closest("[data-sheet-close]")) closeSheet();
  });
  $("sheet").addEventListener("cancel", function (e) { e.preventDefault(); closeSheet(); });

  $("deleteItem").addEventListener("click", function () {
    var it = items[editing];
    if (it.name && !confirm("Delete " + it.name + " from the menu?")) return;
    items.splice(editing, 1);
    editing = -1;
    $("sheet").close();
    setDirty(true);
    render();
  });

  $("photoInput").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) uploadPhoto(file);
  });

  $("publish").addEventListener("click", publish);
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (b) showTab(b.dataset.tab);
  });
  $("recipeList").addEventListener("click", function (e) {
    var step = e.target.closest(".rc-step");
    if (step) step.classList.toggle("done");
  });
  $("retryLoad").addEventListener("click", showEditor);

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---- start ----------------------------------------------------------
  password = storedPassword();
  if (!password) { showLogin(); return; }
  fetch("api/login", { method: "POST", headers: { "x-admin-password": password } })
    .then(function (res) { res.ok ? showEditor() : signOut(); })
    .catch(function () { showLogin("The editor isn't available right now. Please try again later."); });
})();
