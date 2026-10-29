(function () {
  "use strict";

  var mounts = Array.from(document.querySelectorAll("[data-card-library]"));
  if (!mounts.length) return;

  var KEY = "maison-gaby-card-choice";
  var script = document.currentScript;
  var dataUrl = new URL("../data/cards.json", script.src);

  function stored() {
    try { return sessionStorage.getItem(KEY) || ""; }
    catch (e) { return ""; }
  }
  function remember(id) {
    try {
      if (id) sessionStorage.setItem(KEY, id);
      else sessionStorage.removeItem(KEY);
      return true;
    } catch (e) { return false; }
  }
  function removeNotice() {
    var notice = document.getElementById("giftCardNotice");
    if (notice) notice.remove();
  }
  // Reset stored choices immediately, even while the collection is still loading.
  document.addEventListener("maison:new-box", function () {
    remember("");
    removeNotice();
  });
  function element(tag, className, value) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function cardText(card) {
    return "“" + card.quote.replace(/\n/g, " ") + "”\n— " + card.author + "\n\n" + card.message;
  }
  function findChoice(occasions, id) {
    for (var occasion of occasions) {
      var card = occasion.cards.find(function (item) { return item.id === id; });
      if (card) return { occasion: occasion, card: card };
    }
    return null;
  }

  mounts.forEach(function (mount) {
    mount.appendChild(element("p", "card-library-loading", "Finding a few lovely words…"));
  });

  fetch(dataUrl).then(function (response) {
    if (!response.ok) throw new Error("Card collection unavailable");
    return response.json();
  }).then(function (data) {
    if (!Array.isArray(data.occasions) || !data.occasions.length) throw new Error("No occasions");
    data.occasions.forEach(function (occasion) {
      if (!occasion.id || !occasion.label || !Array.isArray(occasion.cards) || occasion.cards.length !== 2) {
        throw new Error("Incomplete occasion");
      }
      occasion.cards.forEach(function (card) {
        if (!card.id || !card.title || !card.quote || !card.author || !card.message ||
          !card.source || new URL(card.source.url).protocol !== "https:" || cardText(card).length > 400) {
          throw new Error("Incomplete card");
        }
      });
    });
    var checkoutController = null;
    mounts.forEach(function (mount, index) {
      var controller = initialise(mount, data.occasions, index);
      if (controller) checkoutController = controller;
    });
    initialiseHome(data.occasions, checkoutController);
  }).catch(function () {
    mounts.forEach(function (mount) {
      mount.replaceChildren(element("p", "card-library-error", "The card collection couldn’t load just now. You can still write your own message in your box."));
    });
    var choose = document.getElementById("chooseCard");
    var status = document.getElementById("giftStatus");
    if (choose) choose.disabled = true;
    if (status) status.textContent = "The notes couldn’t load just now. You can still write your own message in your box.";
  });

  function initialise(mount, occasions, index) {
    var checkout = mount.dataset.cardMode === "checkout";
    var field = checkout ? document.querySelector('#orderForm [name="card"]') : null;
    var gift = checkout ? document.getElementById("giftToggle") : null;
    var pending = findChoice(occasions, stored());
    if (checkout && field.value && pending && field.value !== cardText(pending.card)) {
      pending = null;
      remember("");
    }
    var selected = pending ? pending.card.id : "";
    var current = pending ? pending.occasion : occasions[0];
    var listeners = [];
    var applyingChoice = false;

    function notify(reason) {
      var choice = selected ? findChoice(occasions, selected) : null;
      listeners.forEach(function (listener) { listener(choice, reason); });
    }

    mount.replaceChildren();
    var toolbar = element("div", "card-library-toolbar");
    var label = element("label", "card-occasion-label", "The occasion");
    var select = element("select", "card-occasion-select");
    select.id = "card-occasion-" + index;
    select.name = "cardOccasion";
    label.htmlFor = select.id;
    occasions.forEach(function (occasion) {
      var option = element("option", "", occasion.label);
      option.value = occasion.id;
      select.appendChild(option);
    });
    select.value = current.id;
    label.appendChild(select);
    toolbar.appendChild(label);
    var count = element("p", "card-library-count", "Two little ways to say it.");
    toolbar.appendChild(count);
    var grid = element("div", "literary-card-grid");
    var status = element("p", "card-library-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    mount.append(toolbar, grid, status);

    select.addEventListener("change", function () {
      current = occasions.find(function (occasion) { return occasion.id === select.value; });
      render();
      status.textContent = "Two cards for " + current.label + ".";
    });

    function markSelected() {
      grid.querySelectorAll("[data-card-choice]").forEach(function (button) {
        var active = button.dataset.cardChoice === selected;
        button.setAttribute("aria-pressed", String(active));
        button.textContent = active ? "Selected for your gift" : "Choose this card";
      });
    }

    function render() {
      grid.replaceChildren();
      current.cards.forEach(function (card, i) {
        var article = element("article", "literary-card");
        article.setAttribute("aria-label", current.label + ": " + card.title);
        var sheet = element("div", "literary-card-sheet");
        var number = element("p", "literary-card-eyebrow", current.label + " · " + (i + 1 === 1 ? "I" : "II"));
        var title = element("h3", "literary-card-title", card.title);
        var quotation = element("blockquote", "literary-card-quote");
        quotation.appendChild(element("p", "", "“" + card.quote + "”"));
        quotation.appendChild(element("cite", "", "— " + card.author));
        var message = element("p", "literary-card-message", card.message);
        sheet.append(number, title, quotation, message);
        var actions = element("div", "literary-card-actions");
        var source = element("a", "literary-card-source", "Read the original");
        source.href = card.source.url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.title = card.source.title + " · " + card.source.locator;
        source.setAttribute("aria-label", "Read the original in " + card.source.title + " by " + card.author + " (opens a new tab)");
        var citation = element("span", "literary-card-work", card.source.title);
        var button = element("button", "btn btn-outline literary-card-choose", "Choose this card");
        button.type = "button";
        button.dataset.cardChoice = card.id;
        button.setAttribute("aria-label", "Choose “" + card.title + "” for " + current.label);
        button.addEventListener("click", function () { choose(card); });
        actions.append(citation, source, button);
        article.append(sheet, actions);
        grid.appendChild(article);
      });
      markSelected();
    }

    function choose(card, focus) {
      if (!checkout) {
        if (remember(card.id)) window.location.assign("./#menu");
        else status.textContent = "This browser couldn’t save your choice. Copy your favourite words and add them to the gift message in your box.";
        return;
      }
      applyingChoice = true;
      field.value = cardText(card);
      // Let the existing order form clear a previous sent state before marking the selection.
      field.dispatchEvent(new Event("input", { bubbles: true }));
      applyingChoice = false;
      selected = card.id;
      remember(card.id);
      gift.checked = true;
      if (focus === false) document.getElementById("giftFields").hidden = false;
      else gift.dispatchEvent(new Event("change", { bubbles: true }));
      var choice = findChoice(occasions, card.id);
      if (choice && current.id !== choice.occasion.id) {
        current = choice.occasion;
        select.value = current.id;
        render();
      } else markSelected();
      status.textContent = "“" + card.title + "” is in your gift message. Make it yours below.";
      var disclosure = mount.closest("details");
      if (disclosure) disclosure.open = false;
      if (focus !== false) field.focus();
      notify("chosen");
    }

    if (checkout) {
      field.addEventListener("input", function () {
        if (applyingChoice) return;
        selected = "";
        remember("");
        markSelected();
        status.textContent = "Your personal message will be handwritten on the card.";
        removeNotice();
        notify("edited");
      });
      gift.addEventListener("change", function () {
        if (!gift.checked) {
          selected = "";
          remember("");
          markSelected();
          removeNotice();
          status.textContent = "";
          notify("cleared");
        }
      });
      document.addEventListener("maison:new-box", function () {
        selected = "";
        remember("");
        status.textContent = "";
        markSelected();
        removeNotice();
        notify("reset");
      });
    }

    render();
    if (checkout && pending && !field.value) {
      // Restore the choice without moving focus away from the menu.
      choose(pending.card, false);
      var note = element("p", "gift-card-notice", "Your “" + pending.card.title + "” card is saved. Choose your desserts, then personalise it in My box.");
      note.id = "giftCardNotice";
      note.setAttribute("role", "status");
      var nextDelivery = document.getElementById("nextDelivery");
      if (nextDelivery) nextDelivery.insertAdjacentElement("afterend", note);
    }
    if (checkout) return {
      choose: function (card) { choose(card, false); },
      selected: function () { return selected ? findChoice(occasions, selected) : null; },
      subscribe: function (listener) { listeners.push(listener); }
    };
  }

  function initialiseHome(occasions, checkout) {
    var editor = document.getElementById("homeCardEditor");
    if (!editor) return;
    var select = document.getElementById("occasionSelect");
    var choices = document.getElementById("messageChoices");
    var choose = document.getElementById("chooseCard");
    var status = document.getElementById("giftStatus");
    var selectedLabel = document.getElementById("selectedCardLabel");
    var currentCard = null;
    var selectedChoice = checkout ? checkout.selected() : null;
    var currentOccasion = selectedChoice ? selectedChoice.occasion : occasions[0];
    if (!select || !choices || !choose || !status || !selectedLabel) return;
    if (!checkout) {
      choose.disabled = true;
      status.textContent = "You can choose and personalise a card in your box.";
      return;
    }

    function text(id, value) {
      var field = document.getElementById(id);
      if (field) field.textContent = value;
    }
    function markSelected() {
      selectedLabel.textContent = selectedChoice ? selectedChoice.occasion.label + " · " + selectedChoice.card.title : "";
      choose.setAttribute("aria-pressed", String(!!selectedChoice && !!currentCard && selectedChoice.card.id === currentCard.id));
    }
    function preview(card) {
      currentCard = card;
      text("cardTitle", card.title);
      text("cardQuote", "“" + card.quote + "”");
      text("cardAuthor", card.author);
      text("cardMessage", card.message);
      choices.querySelectorAll("[data-message-id]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.messageId === card.id));
      });
      choose.disabled = false;
      markSelected();
    }
    function renderChoices(card) {
      choices.replaceChildren();
      currentOccasion.cards.forEach(function (entry) {
        var button = element("button", "message-option");
        button.type = "button";
        button.dataset.messageId = entry.id;
        button.setAttribute("aria-pressed", "false");
        button.appendChild(element("span", "message-option-title", entry.title));
        button.appendChild(element("small", "", entry.author));
        button.addEventListener("click", function () { preview(entry); });
        choices.appendChild(button);
      });
      preview(card || currentOccasion.cards[0]);
    }

    select.replaceChildren();
    occasions.forEach(function (occasion) {
      var option = element("option", "", occasion.label);
      option.value = occasion.id;
      select.appendChild(option);
    });
    select.value = currentOccasion.id;
    select.addEventListener("change", function () {
      currentOccasion = occasions.find(function (occasion) { return occasion.id === select.value; });
      renderChoices();
    });
    choose.addEventListener("click", function () {
      if (currentCard) checkout.choose(currentCard);
    });
    checkout.subscribe(function (choice, reason) {
      selectedChoice = choice;
      if (choice) {
        currentOccasion = choice.occasion;
        select.value = currentOccasion.id;
        renderChoices(choice.card);
        status.textContent = "“" + choice.card.title + "” is in your gift message. Personalise it in Your box.";
      } else {
        markSelected();
        status.textContent = reason === "edited" ? "Your personal message is in your box. Choose a note to replace it." : "";
      }
    });
    renderChoices(selectedChoice ? selectedChoice.card : null);
    if (selectedChoice) status.textContent = "“" + selectedChoice.card.title + "” is in your gift message. Personalise it in Your box.";
  }
})();
