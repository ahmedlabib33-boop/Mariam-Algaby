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
  var recipesLoading = false;
  var session = 0;
  var signedIn = false;
  var menuRequest = 0;
  var photoRequest = 0;
  var publishing = false;
  var draft = null;
  var menuETag = null;

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
    var stores = ["localStorage", "sessionStorage"];
    for (var i = 0; i < stores.length; i++) {
      try { var value = window[stores[i]].getItem(PW_KEY); if (value) return value; } catch (e) { /* try the other store */ }
    }
    return "";
  }
  function storePassword(pw, remember) {
    forgetPassword();
    try {
      (remember ? localStorage : sessionStorage).setItem(PW_KEY, pw);
    } catch (e) { /* private mode: stays signed in for this page only */ }
  }
  function forgetPassword() {
    ["localStorage", "sessionStorage"].forEach(function (name) {
      try { window[name].removeItem(PW_KEY); } catch (e) { /* ignore */ }
    });
  }

  function currentSession(value) { return signedIn && session === value; }
  function cancelled(err) { return err.message === "signed out" || err.message === "session ended"; }

  // ---- API ------------------------------------------------------------
  function api(path, options) {
    var requestSession = session;
    options = options || {};
    options.headers = Object.assign({ "x-admin-password": password }, options.headers || {});
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!currentSession(requestSession)) throw new Error("session ended");
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
    var etag = null;
    // Authenticated reads verify the stored version; publishes use its ETag.
    return fetch("api/menu?t=" + Date.now(), { headers: { "x-admin-password": password }, cache: "no-store" }).then(function (res) {
      if (res.status === 404) return fetch("data/menu.json");
      etag = res.headers.get("ETag");
      if (res.ok && !etag) throw new Error("Reload the editor to load the current menu version.");
      return res;
    }).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    }).then(function (d) {
      if (!d || !Array.isArray(d.items)) throw new Error("no items");
      return { items: d.items, etag: etag };
    });
  }

  // ---- screens --------------------------------------------------------
  function showLogin(message) {
    $("login").hidden = false;
    $("editor").hidden = true;
    $("recipes").hidden = true;
    $("couriers").hidden = true;
    $("tabs").hidden = true;
    $("bar").hidden = true;
    recipesLoaded = false;
    $("signOut").hidden = true;
    $("loginError").textContent = message || "";
    $("loginForm").password.focus();
  }

  function showEditor() {
    var requestSession = session;
    var request = ++menuRequest;
    $("login").hidden = true;
    $("signOut").hidden = false;
    $("tabs").hidden = false;
    $("loadError").hidden = true;
    $("retryLoad").disabled = true;
    menuReady = false;
    $("list").hidden = true;
    $("empty").hidden = true;
    $("addItem").hidden = true;
    showTab(tab);
    loadMenu().then(function (data) {
      if (!currentSession(requestSession) || request !== menuRequest) return;
      items = data.items;
      menuETag = data.etag;
      menuReady = true;
      $("list").hidden = false;
      $("addItem").hidden = false;
      setDirty(false);
      render();
    }).catch(function () {
      if (!currentSession(requestSession) || request !== menuRequest) return;
      items = [];
      $("list").hidden = true;
      $("empty").hidden = true;
      $("addItem").hidden = true;
      $("loadError").hidden = false;
    }).then(function () {
      if (!currentSession(requestSession) || request !== menuRequest) return;
      showTab(tab);
      $("retryLoad").disabled = false;
    });
  }

  function signOut(message) {
    session++;
    signedIn = false;
    window.MAISON_COURIERS.signOut();
    menuRequest++;
    photoRequest++;
    if ($("sheet").open) $("sheet").close();
    editing = -1;
    draft = null;
    items = [];
    menuETag = null;
    menuReady = false;
    uploading = 0;
    publishing = false;
    dirty = false;
    recipesLoading = false;
    tab = "menu";
    $("list").textContent = "";
    $("recipeList").textContent = "";
    $("itemForm").reset();
    $("loginForm").reset();
    $("photoFrame").textContent = "";
    $("photoFrame").classList.remove("busy");
    $("doneItem").disabled = false;
    $("choosePhoto").disabled = false;
    $("pdfError").textContent = "";
    $("downloadPdf").disabled = false;
    $("downloadPdf").textContent = "Download the recipe book (PDF)";
    forgetPassword();
    password = "";
    showLogin(message);
  }

  function showTab(name) {
    if (!signedIn || ["menu", "recipes", "couriers"].indexOf(name) < 0) return;
    tab = name;
    $("editor").hidden = name !== "menu";
    $("recipes").hidden = name !== "recipes";
    $("couriers").hidden = name !== "couriers";
    $("bar").hidden = !(name === "menu" && menuReady);
    Array.prototype.forEach.call(document.querySelectorAll(".ad-tab"), function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
    });
    if (name === "recipes" && !recipesLoaded && !recipesLoading) loadRecipes();
    if (name === "couriers") window.MAISON_COURIERS.show();
  }

  // ---- recipes (private, read-only here) --------------------------------
  function loadRecipes() {
    var requestSession = session;
    recipesLoading = true;
    $("recipesMsg").hidden = false;
    $("recipesMsg").textContent = "Loading your recipes…";
    api("api/recipes?t=" + Date.now()).then(function (data) {
      if (!currentSession(requestSession)) return;
      recipesLoading = false;
      recipesLoaded = true;
      var list = data.recipes || [];
      $("recipesMsg").hidden = list.length > 0;
      $("recipesMsg").textContent = "No recipes yet.";
      $("recipeList").innerHTML = (data.guide ? renderGuide(data.guide) : "") + list.map(renderRecipe).join("");
    }).catch(function (err) {
      if (!currentSession(requestSession) || cancelled(err)) return;
      recipesLoading = false;
      $("recipesMsg").textContent = "Your recipes couldn't be loaded. Please try again in a moment.";
    });
  }

  function table(head, rows, cls) {
    return '<table class="' + cls + '"><thead><tr>' + head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.map(function (row) {
        return "<tr>" + row.map(function (cell) { return "<td>" + esc(cell) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table>";
  }

  function renderGuide(g) {
    return '<details class="rc rc-guide">' +
      '<summary><span class="rc-name">' + esc(g.title) + '</span><span class="rc-src">Costs, prices and suppliers</span></summary>' +
      '<div class="rc-body">' +
        (g.intro ? '<p class="rc-intro">' + esc(g.intro) + "</p>" : "") +
        (g.summary ? "<h3>Prices &amp; profit</h3>" + table(["Dessert", "Cost", "Price", "Profit", "Margin"], g.summary, "rc-money") : "") +
        (g.method ? '<p class="rc-note">' + esc(g.method) + "</p>" : "") +
        (g.places ? "<h3>Where to buy</h3><ul class=\"rc-bullets\">" + g.places.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
        (g.prices ? "<h3>Ingredient prices</h3>" + table(["Ingredient", "Price", "Source"], g.prices, "rc-money rc-prices") : "") +
      "</div></details>";
  }

  function renderCosting(c) {
    var rows = c.lines.map(function (l) { return [l[0], l[1], l[2] + " EGP"]; });
    return "<h3>Cost &amp; price</h3>" +
      '<p class="rc-note">' + esc(c.basis) + "</p>" +
      table(["Ingredient", "Amount", "Cost"], rows, "rc-money") +
      '<table class="rc-money rc-total"><tbody>' +
        "<tr><td>Ingredients</td><td>" + c.ingredients + " EGP</td></tr>" +
        "<tr><td>Packaging (box, ribbon, seal, card)</td><td>" + c.packaging + " EGP</td></tr>" +
        "<tr><td>Oven energy</td><td>" + c.energy + " EGP</td></tr>" +
        '<tr class="strong"><td>Total cost</td><td>' + c.total + " EGP</td></tr>" +
        '<tr class="strong gold"><td>Suggested price</td><td>' + c.price.toLocaleString("en-US") + " EGP</td></tr>" +
        "<tr><td>Profit</td><td>" + c.profit + " EGP (" + c.margin + "% margin)</td></tr>" +
      "</tbody></table>" +
      (c.competitors && c.competitors.length ? "<h4>What others charge</h4><ul class=\"rc-bullets\">" +
        c.competitors.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
      (c.note ? '<p class="rc-note">' + esc(c.note) + "</p>" : "");
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
        (r.costing ? renderCosting(r.costing) : "") +
        (r.sourceUrl ? '<p class="rc-link">Source: <a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">' + esc(r.source) + "</a></p>" : "") +
      "</div></details>";
  }

  // The PDF is private too, so it is fetched with the password and saved from memory.
  function downloadPdf() {
    var requestSession = session;
    var btn = $("downloadPdf");
    $("pdfError").textContent = "";
    btn.disabled = true;
    btn.textContent = "Preparing the PDF…";
    fetch("api/recipes?format=pdf&t=" + Date.now(), { headers: { "x-admin-password": password } })
      .then(function (res) {
        if (!currentSession(requestSession)) throw new Error("session ended");
        if (res.status === 401) { signOut("Your password has changed. Please sign in again."); throw new Error("signed out"); }
        if (!res.ok) throw new Error("The recipe book isn't available right now. Please try again later.");
        return res.blob();
      })
      .then(function (blob) {
        if (!currentSession(requestSession)) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "Maison-de-Gaby-Recipe-Book.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      })
      .catch(function (err) {
        if (currentSession(requestSession) && !cancelled(err)) $("pdfError").textContent = err.message;
      })
      .then(function () {
        if (!currentSession(requestSession)) return;
        btn.disabled = false;
        btn.textContent = "Download the recipe book (PDF)";
      });
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
    updateControls();
  }

  function updateControls() {
    $("publish").disabled = !menuReady || !dirty || uploading > 0 || publishing;
    $("addItem").disabled = publishing || items.length >= 60;
    Array.prototype.forEach.call($("list").querySelectorAll("button, input"), function (control) {
      var boundary = control.dataset.move !== undefined &&
        (Number(control.dataset.move) + Number(control.dataset.dir) < 0 ||
         Number(control.dataset.move) + Number(control.dataset.dir) >= items.length);
      control.disabled = publishing || boundary;
    });
  }

  function setDirty(value) {
    dirty = value;
    var el = $("status");
    el.className = "ad-status" + (value ? " dirty" : "");
    el.textContent = value ? "You have changes that aren't on the website yet." : "Everything is published.";
    updateControls();
  }

  // ---- edit sheet -----------------------------------------------------
  function openSheet(i) {
    if (publishing || !menuReady) return;
    editing = i;
    var it = items[i];
    draft = Object.assign({}, it);
    var f = $("itemForm");
    f.name.value = it.name || "";
    f.desc.value = it.desc || "";
    f.ingredients.value = it.ingredients || "";
    f.portion.value = it.portion || "";
    f.price.value = it.price == null ? "" : it.price;
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
    if (!f.price.value || !Number.isFinite(price) || price < 0 || price > 1000000) {
      $("itemError").textContent = "Please enter a price from 0 to 1,000,000 EGP."; f.price.focus(); return false;
    }
    var it = items[editing];
    it.name = name;
    it.desc = f.desc.value.trim();
    it.ingredients = f.ingredients.value.trim();
    it.portion = f.portion.value.trim();
    it.price = Math.round(price);
    it.soldOut = f.soldOut.checked;
    it.photo = draft.photo;
    return true;
  }

  function closeSheet() {
    photoRequest++;
    uploading = 0;
    draft = null;
    $("photoFrame").classList.remove("busy");
    $("doneItem").disabled = false;
    $("choosePhoto").disabled = false;
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
    if (editing < 0 || uploading || !draft) return;
    var requestSession = session;
    var request = ++photoRequest;
    var photoDraft = draft;
    function active() { return currentSession(requestSession) && request === photoRequest && draft === photoDraft; }
    uploading = 1;
    $("publish").disabled = true;
    $("doneItem").disabled = true;
    $("choosePhoto").disabled = true;
    $("photoFrame").classList.add("busy");
    $("itemError").textContent = "";
    shrink(file)
      .then(function (blob) {
        if (!active()) throw new Error("session ended");
        return api("api/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      })
      .then(function (data) {
        if (!active()) return;
        photoDraft.photo = data.url;
        showPhoto(photoDraft.photo);
      })
      .catch(function (err) {
        if (active() && !cancelled(err)) $("itemError").textContent = err.message;
      })
      .then(function () {
        if (!active()) return;
        uploading = 0;
        $("photoFrame").classList.remove("busy");
        $("doneItem").disabled = false;
        $("choosePhoto").disabled = false;
        updateControls();
      });
  }

  // ---- publish --------------------------------------------------------
  function publish() {
    if (!signedIn || !menuReady || publishing || uploading || !dirty) return;
    var requestSession = session;
    var missing = items.filter(function (it) { return !it.name; });
    if (missing.length) { toast("Every dessert needs a name before publishing."); return; }
    publishing = true;
    updateControls();
    $("status").textContent = "Publishing…";
    api("api/menu", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, menuETag ? { "If-Match": menuETag } : { "If-None-Match": "*" }),
      body: JSON.stringify({ items: items })
    }).then(function (data) {
      if (!currentSession(requestSession)) return;
      publishing = false;
      items = data.items;
      menuETag = data.etag;
      render();
      setDirty(false);
      $("status").className = "ad-status ok";
      $("status").textContent = data.warning || "Published ✓ Your changes will be on the website within a minute.";
    }).catch(function (err) {
      if (!currentSession(requestSession) || cancelled(err)) return;
      publishing = false;
      setDirty(true);
      $("status").textContent = err.message;
    });
  }

  // ---- events ---------------------------------------------------------
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var requestSession = session;
    var f = e.target;
    var pw = f.password.value;
    $("loginError").textContent = "";
    f.querySelector("button").disabled = true;
    fetch("api/login", { method: "POST", headers: { "x-admin-password": pw } })
      .then(function (res) {
        if (requestSession !== session) return;
        if (res.status === 401) throw new Error("That password isn't right. Please try again.");
        if (!res.ok) throw new Error("The editor isn't available right now. Please try again later.");
        password = pw;
        signedIn = true;
        window.MAISON_COURIERS.signIn();
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
    if (!signedIn || !menuReady || publishing) return;
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
    if (!signedIn || !menuReady || publishing) return;
    var t = e.target;
    if (t.dataset.avail === undefined) return;
    items[Number(t.dataset.avail)].soldOut = !t.checked;
    setDirty(true);
    render();
  });

  $("addItem").addEventListener("click", function () {
    if (!signedIn || !menuReady || publishing || items.length >= 60) return;
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
    var named = !!it.name;
    items.splice(editing, 1);
    editing = -1;
    if (named) setDirty(true);
    closeSheet();
  });

  $("choosePhoto").addEventListener("click", function () { $("photoInput").click(); });
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
  $("tabs").addEventListener("keydown", function (e) {
    var tabs = Array.prototype.slice.call($("tabs").querySelectorAll("[data-tab]"));
    var index = tabs.indexOf(e.target);
    if (index < 0) return;
    if (e.key === "ArrowRight") index = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") index = (index + tabs.length - 1) % tabs.length;
    else if (e.key === "Home") index = 0;
    else if (e.key === "End") index = tabs.length - 1;
    else return;
    e.preventDefault();
    showTab(tabs[index].dataset.tab);
    tabs[index].focus();
  });
  $("downloadPdf").addEventListener("click", downloadPdf);
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
  var initialSession = session;
  fetch("api/login", { method: "POST", headers: { "x-admin-password": password } })
    .then(function (res) {
      if (initialSession !== session) return;
      if (res.ok) { signedIn = true; window.MAISON_COURIERS.signIn(); showEditor(); }
      else if (res.status === 401) signOut();
      else showLogin("The editor isn't available right now. Please try again later.");
    })
    .catch(function () { showLogin("The editor isn't available right now. Please try again later."); });
})();
