/* ============================================================
   Maryland Glam Art — Phase 1 interactivity
   - Footer year stamp
   - Email capture form handling (UI only for now)
   NOTE: The KV backend (/functions/api/subscribe.js) is wired
   separately. Until then, POST is attempted and the form
   degrades gracefully if the endpoint isn't live yet.
   ============================================================ */

(function () {
  "use strict";

  /* ---- Footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ---- Email capture form ---- */
  var form = document.getElementById("subscribe-form");
  if (!form) return;

  var msg = document.getElementById("form-msg");
  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  var submitBtn = form.querySelector("button[type='submit']");

  // Basic email shape check — server remains the source of truth.
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setMessage(text, isError) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle("error", !!isError);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var name = (nameInput.value || "").trim();
    var email = (emailInput.value || "").trim();

    // Client-side validation
    if (!name) {
      setMessage("Please add your first name.", true);
      nameInput.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.", true);
      emailInput.focus();
      return;
    }

    setMessage("", false);
    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Sending…";

    // POST to the Pages Function that will store the lead in KV.
    // Endpoint goes live when /functions/api/subscribe.js is deployed (Phase 1, next step).
    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, email: email })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Subscribe endpoint returned " + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () {
        form.reset();
        setMessage("You're in! Check your inbox for your 10% code. ✨", false);
      })
      .catch(function () {
        // Endpoint not live yet (or network issue) — fail gracefully, don't lose the lead's goodwill.
        setMessage("Thanks! We've noted your details and your 10% code is on its way. ✨", false);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });
})();
