/* ============================================================
   Passcode gate.

   The passcode lives in the SITE_PASSCODE repository secret, never in this
   repo. tools/inject_passcode.py stamps a salt and a PBKDF2 verifier into the
   placeholders below during the Pages deploy.

   PBKDF2 rather than a plain hash because the verifier is, by necessity,
   readable in the served JavaScript — the check runs in the browser. A bare
   SHA-256 of a short passcode falls to a wordlist in seconds; 250k iterations
   with a salt makes that expensive instead of instant.

   WHAT THIS DOES: keeps the site from being readable by someone who stumbles
   onto the URL.

   WHAT THIS DOES NOT DO: protect the photos and clips. GitHub Pages serves
   every file to anyone who asks for it by name, and this check runs after
   those files are already reachable. Anyone who knows a path like
   assets/gallery/full/x.jpg can fetch it without seeing this prompt. While
   the repo is public they are also downloadable straight from github.com.
   Treat it as a doormat, not a lock.
   ============================================================ */
(function () {
  "use strict";

  /* Stamped at deploy time — see tools/inject_passcode.py. */
  var SALT = "__SITE_PASSCODE_SALT__";
  var VERIFIER = "__SITE_PASSCODE_VERIFIER__";
  var ITERATIONS = 250000;

  var KEY = "travels-unlocked";
  var ROOT = document.documentElement;

  function reveal() {
    ROOT.classList.remove("gated");
    var g = document.getElementById("gate");
    if (g) g.remove();
  }

  /* No passcode stamped in (local checkout, or an injection that didn't run).
     Fail open rather than bricking the page — the deploy workflow verifies the
     stamp separately, so an unstamped build should never reach production. */
  if (VERIFIER.indexOf("__SITE_PASSCODE") === 0) {
    if (window.console) console.warn("[gate] no passcode stamped in — site is open.");
    reveal();
    return;
  }

  /* Without WebCrypto there is nothing to verify against. */
  if (!window.crypto || !crypto.subtle) { reveal(); return; }

  try {
    if (sessionStorage.getItem(KEY) === VERIFIER) { reveal(); return; }
  } catch (e) { /* private mode — just show the prompt */ }

  function hex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, "0"); })
      .join("");
  }

  function unhex(s) {
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  async function derive(passcode) {
    var key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(passcode), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: unhex(SALT), iterations: ITERATIONS, hash: "SHA-256" },
      key, 256);
    return hex(bits);
  }

  function build() {
    var g = document.createElement("div");
    g.id = "gate";
    g.className = "gate";
    g.innerHTML =
      '<form class="gate-card" autocomplete="off">' +
        '<div class="gate-mark" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><path d="M12 2c4.4 0 8 3.6 8 8 0 5.8-8 12-8 12S4 15.8 4 10c0-4.4 3.6-8 8-8z"/>' +
          '<circle cx="12" cy="9.8" r="2.9"/></svg>' +
        "</div>" +
        "<h1>Jay &amp; Raye</h1>" +
        "<p>This one's just for us. Enter the passcode to come in.</p>" +
        '<label class="sr-only" for="gate-input">Passcode</label>' +
        '<input id="gate-input" type="password" inputmode="text" autocomplete="off" ' +
          'autocapitalize="off" spellcheck="false" placeholder="Passcode">' +
        '<button type="submit">Come in</button>' +
        '<div class="gate-err" role="alert" aria-live="polite"></div>' +
      "</form>";
    document.body.appendChild(g);

    var form = g.querySelector("form");
    var card = g.querySelector(".gate-card");
    var input = g.querySelector("input");
    var button = g.querySelector("button");
    var err = g.querySelector(".gate-err");
    input.focus();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val || button.disabled) return;

      // The derivation takes a beat by design; say so rather than looking stuck.
      button.disabled = true;
      var label = button.textContent;
      button.textContent = "Checking…";
      err.textContent = "";

      var got;
      try {
        got = await derive(val);
      } catch (e2) {
        button.disabled = false;
        button.textContent = label;
        err.textContent = "Couldn't check that — try reloading.";
        return;
      }

      button.disabled = false;
      button.textContent = label;

      if (got === VERIFIER) {
        try { sessionStorage.setItem(KEY, VERIFIER); } catch (e3) {}
        g.classList.add("out");
        setTimeout(reveal, 260);
      } else {
        err.textContent = "That's not it. Try again.";
        card.classList.remove("shake");
        void g.offsetWidth;
        card.classList.add("shake");
        input.select();
      }
    });

    input.addEventListener("input", function () { err.textContent = ""; });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", build);
  else build();
})();
