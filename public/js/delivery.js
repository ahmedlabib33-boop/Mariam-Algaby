(function () {
  "use strict";

  var form = document.getElementById("orderForm");
  var panel = document.getElementById("deliveryMapPanel");
  if (!form || !panel) return;

  var mapElement = document.getElementById("deliveryMap");
  var currentButton = document.getElementById("useMyLocation");
  var otherButton = document.getElementById("chooseDeliveryLocation");
  var centerButton = document.getElementById("useMapCenter");
  var clearButton = document.getElementById("clearDeliveryLocation");
  var summary = document.getElementById("deliveryLocationSummary");
  var coordinates = document.getElementById("deliveryCoordinates");
  var link = document.getElementById("deliveryMapLink");
  var status = document.getElementById("deliveryLocationStatus");
  var error = document.getElementById("deliveryLocationError");
  var assetRoot = new URL("../assets/", document.currentScript.src);
  var areas = {
    "Heliopolis / Masr El Gedida": [30.0876, 31.3302],
    "Nasr City": [30.0566, 31.3442],
    "El Nozha / Sheraton": [30.1058, 31.3710],
    "New Cairo / Fifth Settlement": [30.0223, 31.4770]
  };
  var selected = null, map = null, marker = null, accuracyCircle = null;
  var leafletPromise = null, requestId = 0, mode = "";
  var locationError = "", tileError = "", mapError = "";

  function validPoint(lat, lng) {
    return typeof lat === "number" && typeof lng === "number" &&
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  }
  function mapsUrl(point) {
    return "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(point.lat.toFixed(6) + "," + point.lng.toFixed(6));
  }
  window.MAISON_DELIVERY = {
    getLocation: function () {
      return selected ? { lat: selected.lat, lng: selected.lng, url: mapsUrl(selected) } : null;
    }
  };

  function changed() { form.dispatchEvent(new Event("input", { bubbles: true })); }
  function showErrors() { error.textContent = [locationError, mapError, tileError].filter(Boolean).join(" "); }
  function setMode(next) {
    mode = next;
    currentButton.setAttribute("aria-pressed", String(next === "current"));
    otherButton.setAttribute("aria-pressed", String(next === "manual"));
  }
  function cancelLocation() {
    requestId++;
    currentButton.disabled = false;
    currentButton.removeAttribute("aria-busy");
    return requestId;
  }
  function removeSelection(notify) {
    selected = null;
    if (marker) { marker.remove(); marker = null; }
    if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null; }
    summary.hidden = true;
    clearButton.hidden = true;
    link.removeAttribute("href");
    coordinates.textContent = "";
    if (notify) changed();
  }
  function areaCenter() { return areas[form.area.value] || areas["Heliopolis / Masr El Gedida"]; }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = new URL("vendor/leaflet/leaflet.js", assetRoot).href;
      script.onload = function () {
        if (window.L) resolve(window.L);
        else { leafletPromise = null; script.remove(); reject(new Error("Map library unavailable")); }
      };
      script.onerror = function () {
        leafletPromise = null;
        script.remove();
        reject(new Error("Map library unavailable"));
      };
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function drawSelection() {
    if (!map || !selected) return;
    var point = [selected.lat, selected.lng];
    if (!marker) {
      marker = window.L.marker(point, {
        draggable: true,
        keyboard: true,
        title: "Delivery location. Drag to adjust.",
        alt: "Selected delivery location",
        icon: window.L.icon({
          iconUrl: new URL("location-pin.svg", assetRoot).href,
          iconSize: [30, 40], iconAnchor: [15, 39]
        })
      }).addTo(map);
      marker.on("dragstart", cancelLocation);
      marker.on("dragend", function () {
        var point = marker.getLatLng().wrap();
        cancelLocation();
        setMode("manual");
        selectPoint(point.lat, point.lng);
      });
    } else marker.setLatLng(point);
    if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null; }
    if (selected.accuracy && selected.accuracy > 0) {
      accuracyCircle = window.L.circle(point, {
        radius: Math.min(selected.accuracy, 1000), color: "#18283f",
        weight: 1, fillOpacity: 0.07, interactive: false
      }).addTo(map);
    }
  }

  function selectPoint(lat, lng, accuracy) {
    if (!validPoint(lat, lng)) return false;
    selected = { lat: lat, lng: lng, accuracy: accuracy || null };
    locationError = "";
    showErrors();
    drawSelection();
    coordinates.textContent = "Delivery pin: " + lat.toFixed(6) + ", " + lng.toFixed(6);
    link.href = mapsUrl(selected);
    summary.hidden = false;
    clearButton.hidden = false;
    status.textContent = accuracy > 100
      ? "Your device’s location is approximate. Move the pin to the correct entrance, then add any building or flat details below."
      : "Delivery pin selected. Check the entrance and add any building or flat details below.";
    changed();
    return true;
  }

  function resizeMap() {
    if (map && !panel.hidden) map.invalidateSize({ pan: false });
  }
  function showMap() {
    panel.hidden = false;
    currentButton.setAttribute("aria-expanded", "true");
    otherButton.setAttribute("aria-expanded", "true");
    return loadLeaflet().then(function (L) {
      // A reset while the local library loads must not reopen the map or restore an old location.
      if (panel.hidden) return;
      mapError = "";
      showErrors();
      if (!map) {
        map = L.map(mapElement, {
          scrollWheelZoom: false, minZoom: 2, maxZoom: 19,
          maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 1
        }).setView(selected ? [selected.lat, selected.lng] : areaCenter(), selected ? 16 : 13);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        }).on("tileerror", function () {
          if (panel.hidden) return;
          tileError = "Map imagery couldn’t load. You can still use your location link or enter the full address below.";
          showErrors();
        }).on("tileload", function () {
          if (panel.hidden) return;
          tileError = "";
          showErrors();
        }).addTo(map);
        map.on("click", function (event) {
          var point = event.latlng.wrap();
          cancelLocation();
          setMode("manual");
          selectPoint(point.lat, point.lng);
        });
      }
      centerButton.disabled = false;
      drawSelection();
      resizeMap();
    }).catch(function () {
      if (panel.hidden) return;
      mapError = "The map couldn’t open. You can still use your location link or enter the full address below.";
      showErrors();
      centerButton.disabled = true;
    });
  }

  currentButton.addEventListener("click", function () {
    var token = cancelLocation();
    removeSelection(true);
    setMode("current");
    locationError = "";
    showErrors();
    status.textContent = "Finding your location…";
    currentButton.disabled = true;
    currentButton.setAttribute("aria-busy", "true");
    showMap();
    if (!navigator.geolocation || !window.isSecureContext) {
      cancelLocation();
      status.textContent = "";
      locationError = "Your browser can’t share a location here. Choose a point on the map or enter the full address below.";
      showErrors();
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(function (position) {
        if (token !== requestId) return;
        cancelLocation();
        var c = position.coords;
        if (!selectPoint(c.latitude, c.longitude, Number.isFinite(c.accuracy) ? c.accuracy : null)) {
          locationError = "Your device couldn’t provide a valid location. Choose a point on the map instead.";
          status.textContent = "";
          showErrors();
          return;
        }
        if (map) map.setView([selected.lat, selected.lng], 16);
      }, function (failure) {
        if (token !== requestId) return;
        cancelLocation();
        status.textContent = "";
        locationError = failure.code === 1
          ? "Location access was declined. Choose a point on the map or enter the full address below."
          : failure.code === 3
            ? "Finding your location took too long. Try again, or choose a point on the map."
            : "Your location couldn’t be found. Choose a point on the map or enter the full address below.";
        showErrors();
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    } catch (failure) {
      if (token !== requestId) return;
      cancelLocation();
      status.textContent = "";
      locationError = "Your browser couldn’t share its location. Choose a point on the map or enter the full address below.";
      showErrors();
    }
  });

  otherButton.addEventListener("click", function () {
    cancelLocation();
    removeSelection(true);
    setMode("manual");
    locationError = "";
    showErrors();
    status.textContent = "Choose the delivery area above, then place the pin at the correct entrance.";
    showMap().then(function () { if (map && mode === "manual" && !selected) map.setView(areaCenter(), 13); });
  });

  centerButton.addEventListener("click", function () {
    if (!map) return;
    cancelLocation();
    setMode("manual");
    var point = map.getCenter().wrap();
    selectPoint(point.lat, point.lng);
  });
  clearButton.addEventListener("click", function () {
    cancelLocation();
    removeSelection(true);
    setMode("manual");
    locationError = "";
    showErrors();
    status.textContent = "Pin removed. Choose a new point, or enter the full address below.";
  });
  form.area.addEventListener("change", function () {
    if (panel.hidden) return;
    cancelLocation();
    removeSelection(true);
    setMode("manual");
    locationError = "";
    showErrors();
    if (map) map.setView(areaCenter(), 13);
    status.textContent = "Delivery area changed. Choose its location on the map.";
  });

  document.getElementById("drawer").addEventListener("transitionend", resizeMap);
  window.addEventListener("resize", resizeMap);
  document.addEventListener("maison:new-box", function () {
    cancelLocation();
    removeSelection(false);
    setMode("");
    panel.hidden = true;
    currentButton.setAttribute("aria-expanded", "false");
    otherButton.setAttribute("aria-expanded", "false");
    centerButton.disabled = true;
    locationError = "";
    tileError = "";
    mapError = "";
    status.textContent = "";
    showErrors();
  });
})();
