(function () {
  "use strict";

  var toggle = document.querySelector("[data-menu-toggle]");
  var navigation = document.getElementById("mobileNav");
  if (!toggle || !navigation) return;

  function close(returnFocus) {
    navigation.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    navigation.hidden = open;
    toggle.setAttribute("aria-expanded", String(!open));
  });
  navigation.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () { close(false); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !navigation.hidden) close(true);
  });
  var desktop = window.matchMedia("(min-width: 761px)");
  desktop.addEventListener("change", function (event) {
    if (event.matches) close(false);
  });
})();
