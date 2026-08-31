/* ============================================================
   Passcode gate.

   WHAT THIS DOES: keeps the site from being readable by someone who
   stumbles onto the URL. The passcode is never stored in the page — only
   its SHA-256 hash — so it can't be read out of the source.

   WHAT THIS DOES NOT DO: protect the photos and clips. GitHub Pages serves
   every file to anyone who asks for it by name, and this check runs in the
   browser, after the files are already reachable. Anyone who knows a path
   like assets/gallery/full/x.jpg can fetch it without ever seeing this
   prompt. Treat it as a doormat, not a lock.

   To change the passcode:  python3 tools/set_passcode.py "new passcode"
   ============================================================ */
(function () {
  "use strict";

  // SHA-256 of the passcode. Set by tools/set_passcode.py.
  var HASH = "9203f538f9141274edd5f6908cfe1e6c8454d9b7d54eb4cb967eb760262465cd";
  var KEY = "travels-unlocked";
  var ROOT = document.documentElement;

  function unlocked() {
    try { return sessionStorage.getItem(KEY) === HASH; } catch (e) { return false; }
  }

  function remember() {
    try { sessionStorage.setItem(KEY, HASH); } catch (e) { /* private mode */ }
  }

  function reveal() {
    ROOT.classList.remove("gated");
    var g = document.getElementById("gate");
    if (g) g.remove();
  }

  async function sha256(text) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, "0"); })
      .join("");
  }

  // Without WebCrypto (an http:// origin, say) there is nothing to check
  // against, so let the page through rather than locking everyone out.
  if (!window.crypto || !crypto.subtle) { reveal(); return; }
  if (unlocked()) { reveal(); return; }

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
    var input = g.querySelector("input");
    var err = g.querySelector(".gate-err");
    input.focus();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val) return;
      var got = await sha256(val);
      if (got === HASH) {
        remember();
        g.classList.add("out");
        setTimeout(reveal, 260);
      } else {
        err.textContent = "That's not it. Try again.";
        g.querySelector(".gate-card").classList.remove("shake");
        void g.offsetWidth;
        g.querySelector(".gate-card").classList.add("shake");
        input.select();
      }
    });

    input.addEventListener("input", function () { err.textContent = ""; });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", build);
  else build();
})();
