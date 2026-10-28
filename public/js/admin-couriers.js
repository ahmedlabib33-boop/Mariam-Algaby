(function () {
  "use strict";

  var KEY = "maison-gaby-couriers-v1";
  var MAX_COURIERS = 100;
  var vehicles = ["Motorcycle", "Car", "Van", "Bicycle"];
  var active = false, generation = 0, copyRequest = 0, contacts = [], editing = null;
  var storageReadable = true;
  var $ = function (id) { return document.getElementById(id); };
  var field = function (form, name) { return form.elements.namedItem(name); };
  var form = $("courierForm"), requestForm = $("deliveryRequestForm");

  function newId() {
    return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "r" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function text(value, max, label, required) {
    if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
      throw new Error("Please check " + label + ".");
    }
    return value.trim();
  }
  function phone(value) {
    var number = String(value || "").trim().replace(/[\u0660-\u0669\u06f0-\u06f9]/g, function (digit) {
      return String(digit.charCodeAt(0) - (digit.charCodeAt(0) < 0x6f0 ? 0x660 : 0x6f0));
    });
    if (!/^\+?[\d\s().-]+$/.test(number)) throw new Error("Enter an Egyptian mobile number or a number with its country code.");
    number = number.replace(/[\s().-]/g, "").replace(/^\+/, "").replace(/^00/, "");
    if (/^01[0125]\d{8}$/.test(number)) number = "20" + number.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(number) || (number.indexOf("20") === 0 && !/^201[0125]\d{8}$/.test(number))) {
      throw new Error("Enter an Egyptian mobile number or a number with its country code.");
    }
    return number;
  }
  function cleanContact(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("This backup contains an invalid rider.");
    var vehicle = raw.vehicle || "Motorcycle";
    if (vehicles.indexOf(vehicle) < 0 || (raw.available !== undefined && typeof raw.available !== "boolean")) throw new Error("This backup contains an invalid rider.");
    return {
      id: typeof raw.id === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(raw.id) ? raw.id : newId(),
      name: text(raw.name, 60, "the rider’s name", true),
      phone: phone(raw.phone),
      vehicle: vehicle,
      area: text(raw.area || "", 160, "the service areas"),
      notes: text(raw.notes || "", 240, "the rider’s notes"),
      available: raw.available !== false
    };
  }
  function parseBackup(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.couriers) || value.couriers.length > MAX_COURIERS) throw new Error("Choose a Maison de Gaby rider backup with up to 100 contacts.");
    var seenPhones = new Set(), seenIds = new Set();
    return value.couriers.map(function (raw) {
      var contact = cleanContact(raw);
      if (seenPhones.has(contact.phone)) throw new Error("This backup contains duplicate phone numbers.");
      seenPhones.add(contact.phone);
      if (seenIds.has(contact.id)) contact.id = newId();
      seenIds.add(contact.id);
      return contact;
    });
  }
  function loadContacts() {
    contacts = [];
    storageReadable = true;
    $("courierStorageNotice").textContent = "";
    try {
      var saved = localStorage.getItem(KEY);
      if (saved) contacts = parseBackup(JSON.parse(saved));
    } catch (err) {
      storageReadable = false;
      $("courierStorageNotice").textContent = "Saved contacts could not be loaded. Contacts added now last for this session only. Export a backup before signing out.";
    }
  }
  function saveContacts(next) {
    contacts = next;
    if (storageReadable) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ version: 1, couriers: contacts }));
        $("courierStorageNotice").textContent = "";
        return true;
      } catch (err) { /* the in-memory directory remains usable */ }
    }
    $("courierStorageNotice").textContent = "Browser storage is unavailable. These contacts last for this session only. Export a backup before signing out.";
    return false;
  }
  function element(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function button(label, attribute, id) {
    var node = element("button", "btn btn-ghost", label);
    node.type = "button";
    node.setAttribute(attribute, id);
    return node;
  }
  function chosen() {
    var id = field(requestForm, "courierId").value;
    return contacts.find(function (contact) { return contact.id === id; });
  }
  function render() {
    if (!active) return;
    var selected = field(requestForm, "courierId").value;
    var current = contacts.find(function (contact) { return contact.id === selected && contact.available; });
    if (!current) selected = "";
    var list = $("courierList"), select = $("deliveryCourier");
    list.replaceChildren();
    select.replaceChildren(new Option("Choose a rider", ""));
    contacts.forEach(function (contact) {
      var option = new Option(contact.name + (contact.available ? " · " + contact.vehicle : " · Unavailable"), contact.id);
      option.disabled = !contact.available;
      select.appendChild(option);
      var li = element("li", "courier-card" + (selected === contact.id ? " courier-selected" : ""));
      var head = element("div", "courier-card-head");
      head.appendChild(element("h3", "courier-name", contact.name));
      head.appendChild(element("span", "courier-availability", contact.available ? "Available for requests" : "Unavailable"));
      li.appendChild(head);
      li.appendChild(element("p", "courier-card-meta", contact.vehicle + " · +" + contact.phone + (contact.area ? " · " + contact.area : "")));
      if (contact.notes) li.appendChild(element("p", "courier-card-note", contact.notes));
      var actions = element("div", "courier-card-actions");
      var choose = button(selected === contact.id ? "Selected for delivery" : "Use for delivery", "data-courier-select", contact.id);
      choose.disabled = !contact.available;
      choose.setAttribute("aria-pressed", String(selected === contact.id));
      actions.appendChild(choose);
      var call = element("a", "btn btn-outline", "Call");
      call.href = "tel:+" + contact.phone;
      call.setAttribute("aria-label", "Call " + contact.name);
      actions.appendChild(call);
      var chat = element("a", "btn btn-outline", "WhatsApp");
      chat.href = "https://wa.me/" + contact.phone + "?text=" + encodeURIComponent("Hello " + contact.name + ", this is Maison de Gaby. Are you available for a delivery?");
      chat.target = "_blank";
      chat.rel = "noopener noreferrer";
      chat.setAttribute("aria-label", "Open WhatsApp with " + contact.name);
      actions.appendChild(chat);
      actions.appendChild(button("Edit", "data-courier-edit", contact.id));
      li.appendChild(actions);
      list.appendChild(li);
    });
    select.value = selected;
    $("courierEmpty").hidden = contacts.length > 0;
    $("addCourier").disabled = contacts.length >= MAX_COURIERS;
    $("exportCouriers").disabled = contacts.length === 0;
    updatePreview();
  }
  function openContact(id) {
    if (!active) return;
    var contact = contacts.find(function (item) { return item.id === id; });
    editing = contact ? contact.id : null;
    form.reset();
    ["name", "phone", "vehicle", "area", "notes"].forEach(function (name) {
      if (contact) field(form, name).value = contact[name];
    });
    field(form, "available").checked = contact ? contact.available : true;
    $("courierSheetTitle").textContent = contact ? "Edit rider" : "Add a rider";
    $("deleteCourier").hidden = !contact;
    $("courierFormError").textContent = "";
    $("courierSheet").showModal();
    field(form, "name").focus();
  }
  function closeContact() {
    $("courierSheet").close();
    form.reset();
    editing = null;
    $("courierFormError").textContent = "";
  }
  function mapLink(value) {
    value = value.trim();
    if (!value) return "";
    try {
      var url = new URL(value);
      var host = url.hostname.toLowerCase();
      var google = (host === "google.com" || host === "www.google.com" || host === "maps.google.com") && (host === "maps.google.com" || /^\/maps(?:\/|$)/.test(url.pathname));
      var short = host === "maps.app.goo.gl" || (host === "goo.gl" && /^\/maps\//.test(url.pathname));
      if (url.protocol !== "https:" || url.username || url.password || !(google || short) || value.length > 400) throw new Error();
      return url.href;
    } catch (err) { throw new Error("Paste a valid HTTPS Google Maps link from the customer’s order."); }
  }
  function requestMessage(validate) {
    var rider = chosen();
    var values = {};
    ["orderRef", "pickup", "pickupTime", "recipientName", "recipientPhone", "address", "mapUrl", "contents", "collect", "note"].forEach(function (name) {
      values[name] = field(requestForm, name).value.trim();
    });
    if (validate) {
      if (!rider || !rider.available) return invalid("courierId", "Choose an available rider for this request.");
      if (!values.pickup) return invalid("pickup", "Add the pickup address.");
      if (!values.pickupTime) return invalid("pickupTime", "Add the pickup time agreed for this order.");
      if (!values.recipientName) return invalid("recipientName", "Add the recipient’s name.");
      try { values.recipientPhone = "+" + phone(values.recipientPhone); }
      catch (err) { return invalid("recipientPhone", err.message); }
      if (!values.address && !values.mapUrl) return invalid("address", "Add the full delivery address or the customer’s map link.");
      try { values.mapUrl = mapLink(values.mapUrl); }
      catch (err) { return invalid("mapUrl", err.message); }
      if (!field(requestForm, "collect").validity.valid || (values.collect && (!Number.isFinite(Number(values.collect)) || Number(values.collect) < 0 || Number(values.collect) > 1000000))) return invalid("collect", "Enter cash to collect from 0 to 1,000,000 EGP, with up to two decimal places.");
    }
    if (!rider && !Object.keys(values).some(function (key) { return key !== "note" && values[key]; })) return "Choose a rider and add the confirmed delivery details to preview your request.";
    var lines = ["Hello" + (rider ? " " + rider.name : "") + ", delivery request from Maison de Gaby."];
    if (values.orderRef) lines.push("Order: " + values.orderRef);
    if (values.pickup) lines.push("", "Pickup: " + values.pickup);
    if (values.pickupTime) lines.push("Ready for pickup: " + values.pickupTime);
    if (values.recipientName) lines.push("", "Deliver to: " + values.recipientName);
    if (values.recipientPhone) lines.push("Recipient phone: " + values.recipientPhone);
    if (values.address) lines.push("Address: " + values.address);
    if (values.mapUrl) lines.push("Delivery map: " + values.mapUrl);
    if (values.contents) lines.push("", "Contents: " + values.contents);
    if (values.collect !== "") lines.push("Cash to collect: " + Number(values.collect).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " EGP");
    if (values.note) lines.push("", "Handling / notes: " + values.note);
    lines.push("", "Please confirm availability, the delivery fee and estimated arrival time before arranging pickup. Thank you!");
    return lines.join("\n");
  }
  function invalid(name, message) {
    $("courierRequestError").textContent = message;
    field(requestForm, name).focus();
    return null;
  }
  function updatePreview() {
    if (!active) return;
    $("deliveryRequestPreview").textContent = requestMessage(false);
  }
  function clearRequest() {
    copyRequest++;
    requestForm.reset();
    $("courierRequestError").textContent = "";
    $("courierRequestStatus").textContent = "";
    if (active) render();
    else $("deliveryRequestPreview").textContent = "";
  }

  $("addCourier").addEventListener("click", function () { if (active && contacts.length < MAX_COURIERS) openContact(); });
  $("courierList").addEventListener("click", function (event) {
    if (!active) return;
    var edit = event.target.closest("[data-courier-edit]");
    if (edit) return openContact(edit.dataset.courierEdit);
    var select = event.target.closest("[data-courier-select]");
    if (!select) return;
    var contact = contacts.find(function (rider) { return rider.id === select.dataset.courierSelect && rider.available; });
    if (!contact) return;
    field(requestForm, "courierId").value = contact.id;
    render();
    $("courierRequestStatus").textContent = contact.name + " selected. Add the confirmed delivery details below.";
    field(requestForm, "pickup").focus();
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!active) return;
    try {
      var raw = { id: editing || newId(), available: field(form, "available").checked };
      ["name", "phone", "vehicle", "area", "notes"].forEach(function (name) { raw[name] = field(form, name).value; });
      var contact = cleanContact(raw);
      if (contacts.some(function (item) { return item.phone === contact.phone && item.id !== editing; })) throw new Error("That phone number is already saved. Edit the existing rider instead.");
      var next = contacts.slice();
      if (editing) next = next.map(function (item) { return item.id === editing ? contact : item; });
      else {
        if (next.length >= MAX_COURIERS) throw new Error("You can save up to 100 riders.");
        next.push(contact);
      }
      var saved = saveContacts(next);
      closeContact(); render();
      $("courierStatus").textContent = saved ? "Rider saved on this device." : "Rider added for this session. Export a backup to keep this contact.";
    } catch (err) { $("courierFormError").textContent = err.message; }
  });
  $("courierSheet").addEventListener("click", function (event) { if (event.target.closest("[data-courier-close]")) closeContact(); });
  $("courierSheet").addEventListener("cancel", function (event) { event.preventDefault(); closeContact(); });
  $("deleteCourier").addEventListener("click", function () {
    if (!active || !editing) return;
    var contact = contacts.find(function (item) { return item.id === editing; });
    if (!contact || !confirm("Remove " + contact.name + " from your saved riders?")) return;
    var saved = saveContacts(contacts.filter(function (item) { return item.id !== editing; }));
    closeContact(); render();
    $("courierStatus").textContent = saved ? "Rider removed from this device." : "Rider removed for this session. Browser storage could not be updated.";
  });
  $("exportCouriers").addEventListener("click", function () {
    if (!active || !contacts.length) return;
    var blob = new Blob([JSON.stringify({ version: 1, couriers: contacts }, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = "Maison-de-Gaby-riders.json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $("courierStatus").textContent = "Rider backup downloaded. It contains your riders’ contact details; keep it for your own use.";
  });
  $("importCouriers").addEventListener("click", function () { if (active) $("courierImportInput").click(); });
  $("courierImportInput").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0], requestGeneration = generation;
    event.target.value = "";
    if (!active || !file) return;
    if (file.size > 100000) { $("courierStatus").textContent = "Choose a rider backup smaller than 100 KB."; return; }
    file.text().then(function (source) {
      if (!active || requestGeneration !== generation) return;
      var incoming = parseBackup(JSON.parse(source));
      var next = contacts.slice(), added = 0;
      incoming.forEach(function (contact) {
        if (next.some(function (existing) { return existing.phone === contact.phone; })) return;
        contact.id = newId(); next.push(contact); added++;
      });
      if (next.length > MAX_COURIERS) throw new Error("This import would exceed the limit of 100 riders. Existing contacts have been kept.");
      var saved = saveContacts(next);
      render();
      $("courierStatus").textContent = added + " rider" + (added === 1 ? "" : "s") + " imported. Existing phone numbers were kept." + (saved ? "" : " Export a backup before signing out; browser storage is unavailable.");
    }).catch(function (err) {
      if (active && requestGeneration === generation) $("courierStatus").textContent = "Import failed. Your current riders have been kept. " + (err instanceof SyntaxError ? "Choose a valid JSON rider backup." : err.message);
    });
  });
  requestForm.addEventListener("input", function () {
    if (!active) return;
    copyRequest++;
    $("courierRequestError").textContent = "";
    $("courierRequestStatus").textContent = "";
    updatePreview();
  });
  $("deliveryCourier").addEventListener("change", function () { if (active) render(); });
  requestForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!active) return;
    $("courierRequestError").textContent = "";
    var message = requestMessage(true);
    if (!message) return;
    $("deliveryRequestPreview").textContent = message;
    window.open("https://wa.me/" + chosen().phone + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
    $("courierRequestStatus").textContent = "Request opened in WhatsApp. Press send there, then agree the fee and pickup with your rider.";
  });
  $("copyCourierRequest").addEventListener("click", function () {
    if (!active) return;
    $("courierRequestError").textContent = "";
    var message = requestMessage(true), requestGeneration = generation, request = ++copyRequest;
    if (!message) return;
    $("deliveryRequestPreview").textContent = message;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      $("courierRequestStatus").textContent = "Select and copy the request from the message preview.";
      return;
    }
    navigator.clipboard.writeText(message).then(function () {
      if (active && requestGeneration === generation && request === copyRequest) $("courierRequestStatus").textContent = "Request copied. Paste it into your chat with the rider.";
    }).catch(function () {
      if (active && requestGeneration === generation && request === copyRequest) $("courierRequestStatus").textContent = "Select and copy the request from the message preview.";
    });
  });
  $("clearCourierRequest").addEventListener("click", function () { if (active) clearRequest(); });

  window.MAISON_COURIERS = {
    signIn: function () {
      generation++; active = true; loadContacts(); clearRequest();
      $("courierStatus").textContent = "";
    },
    show: function () { if (active) updatePreview(); },
    signOut: function () {
      generation++; active = false; contacts = [];
      if ($("courierSheet").open) $("courierSheet").close();
      form.reset(); editing = null;
      $("courierList").replaceChildren();
      $("deliveryCourier").replaceChildren();
      $("courierStatus").textContent = "";
      $("courierFormError").textContent = "";
      $("courierStorageNotice").textContent = "";
      $("courierImportInput").value = "";
      clearRequest();
      $("couriers").hidden = true;
    }
  };
})();
