/* ============================================================
   Hub behaviour: theme, derived stats, the world map, and the
   trip list. Everything reads from window.TRIPS — adding a trip
   there is the only edit needed.
   ============================================================ */
(function () {
  "use strict";

  var TRIPS = (window.TRIPS || []).slice();
  var MAP = window.WORLDMAP;

  /* ---------- theme ---------- */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("travels-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) { /* private mode — fall through to the media query */ }

  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark" ||
        (!root.hasAttribute("data-theme") &&
         window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("travels-theme", next); } catch (e) {}
    });
  }

  if (!TRIPS.length) return;

  /* ---------- dates ---------- */
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Parse as local noon so a date never slips a day across time zones.
  function parse(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
  }

  function dateRange(a, b) {
    var s = parse(a), e = parse(b);
    var sm = MONTHS[s.getMonth()], em = MONTHS[e.getMonth()];
    if (s.getFullYear() !== e.getFullYear())
      return sm + " " + s.getDate() + ", " + s.getFullYear() + " – " + em + " " + e.getDate() + ", " + e.getFullYear();
    if (sm === em) return sm + " " + s.getDate() + " – " + e.getDate() + ", " + e.getFullYear();
    return sm + " " + s.getDate() + " – " + em + " " + e.getDate() + ", " + e.getFullYear();
  }

  function status(t) {
    var now = new Date();
    var s = parse(t.start), e = parse(t.end);
    e.setHours(23, 59, 59);
    if (now < s) return "upcoming";
    if (now > e) return "recap";
    return "live";
  }

  TRIPS.forEach(function (t) { t._status = status(t); });
  TRIPS.sort(function (a, b) { return parse(b.start) - parse(a.start); });

  /* ---------- stats ---------- */
  function stats() {
    var countries = {}, places = 0, nights = 0, media = 0;
    TRIPS.forEach(function (t) {
      (t.countries || []).forEach(function (c) { countries[c.iso] = true; });
      places += (t.places || []).length;
      nights += t.nights || 0;
      media += t.media || 0;
    });
    return {
      trips: TRIPS.length,
      countries: Object.keys(countries).length,
      places: places,
      nights: nights,
      media: media
    };
  }

  var S = stats();
  var STAT_ROW = [
    { n: S.trips,     l: "Trips" },
    { n: S.countries, l: S.countries === 1 ? "Country" : "Countries" },
    { n: S.places,    l: "Stops" },
    { n: S.nights,    l: "Nights away" },
    { n: S.media,     l: "Photos & clips" }
  ];

  var statsEl = document.getElementById("stats");
  if (statsEl) {
    statsEl.innerHTML = STAT_ROW.map(function (s) {
      return '<div class="stat"><div class="n" data-to="' + s.n + '">0</div>' +
             '<div class="l">' + s.l + "</div></div>";
    }).join("");
  }

  /* Count up once the row scrolls into view. */
  function countUp(el) {
    var to = +el.dataset.to || 0;
    if (!to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = to; return;
    }
    var t0 = null, dur = 900;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- map ---------- */
  function project(lon, lat) {
    var b = MAP.bounds;
    var vb = MAP.viewBox.split(" ");
    var w = +vb[2], h = +vb[3];
    return [
      (lon - b.lon0) / (b.lon1 - b.lon0) * w,
      (b.lat1 - lat) / (b.lat1 - b.lat0) * h
    ];
  }

  function centroid(places) {
    var x = 0, y = 0;
    places.forEach(function (p) { x += p.lon; y += p.lat; });
    return [x / places.length, y / places.length];
  }

  var mapEl = document.getElementById("map");
  if (mapEl && MAP) {
    var visitedIso = {};
    TRIPS.forEach(function (t) {
      (t.countries || []).forEach(function (c) { visitedIso[c.iso] = true; });
    });

    var parts = ['<svg viewBox="' + MAP.viewBox + '" role="img" aria-label="World map showing where we have travelled">'];
    parts.push('<path class="map-land" d="' + MAP.land + '"/>');
    Object.keys(MAP.visited).forEach(function (iso) {
      if (visitedIso[iso]) parts.push('<path class="map-visited" d="' + MAP.visited[iso] + '"/>');
    });

    TRIPS.forEach(function (t) {
      if (!t.places || !t.places.length) return;
      var c = centroid(t.places);
      var xy = project(c[0], c[1]);
      var anchor = xy[0] > +MAP.viewBox.split(" ")[2] * 0.72 ? "end" : "start";
      var dx = anchor === "end" ? -16 : 16;
      parts.push(
        '<g class="pin" data-slug="' + t.slug + '" tabindex="0" role="link" ' +
        'aria-label="' + t.title + '">' +
          '<circle class="halo" cx="' + xy[0].toFixed(1) + '" cy="' + xy[1].toFixed(1) + '" r="15"/>' +
          '<circle class="dot" cx="' + xy[0].toFixed(1) + '" cy="' + xy[1].toFixed(1) + '" r="6.5"/>' +
          '<text class="label" x="' + (xy[0] + dx).toFixed(1) + '" y="' + (xy[1] + 7).toFixed(1) +
            '" text-anchor="' + anchor + '">' + t.title + "</text>" +
        "</g>"
      );
    });
    parts.push("</svg>");
    mapEl.innerHTML = parts.join("");
  }

  /* ---------- trip cards ---------- */
  var ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var ARCH =
    '<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M60 8c26 0 44 20 44 46v98H16V54C16 28 34 8 60 8z" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3"/>' +
      '<path d="M60 30c16 0 27 13 27 29v93H33V59c0-16 11-29 27-29z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"/>' +
      '<path d="M60 62l5.6 16.8L82 84l-16.4 5.2L60 106l-5.6-16.8L38 84l16.4-5.2z" fill="rgba(255,255,255,.8)"/>' +
    "</svg>";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function badge(t) {
    if (t._status === "live")
      return '<span class="badge live"><span class="dot"></span>Happening now</span>';
    if (t._status === "upcoming") return '<span class="badge">Planning</span>';
    return '<span class="badge">Recap</span>';
  }

  function cover(t) {
    if (t.cover && t.cover.type === "image")
      return '<img src="' + esc(t.cover.src) + '" alt="' + esc(t.cover.alt || "") +
             '" loading="lazy" decoding="async">';
    return '<div class="cover-art" role="img" aria-label="Illustrated cover">' + ARCH + "</div>";
  }

  function card(t) {
    var where = (t.places || []).map(function (p) { return esc(p.name); }).join(" · ");
    var facts = (t.facts || []).slice();
    if (t.media) facts.splice(facts.length - 1, 0, t.media + " photos & clips");
    return '<article class="trip reveal" data-slug="' + esc(t.slug) + '">' +
      '<div class="trip-cover">' + badge(t) + cover(t) + "</div>" +
      '<div class="trip-body">' +
        '<div class="trip-dates">' + dateRange(t.start, t.end) + "</div>" +
        '<h3><a href="' + esc(t.href) + '">' + esc(t.title) + "</a></h3>" +
        '<div class="trip-where">' + where + "</div>" +
        '<p class="blurb">' + esc(t.blurb) + "</p>" +
        '<div class="facts">' + facts.map(function (f) {
          return '<span class="fact">' + esc(f) + "</span>";
        }).join("") + "</div>" +
        '<div class="go">Open the trip' + ARROW + "</div>" +
      "</div>" +
    "</article>";
  }

  var listEl = document.getElementById("trips");
  if (listEl) {
    var years = [];
    var byYear = {};
    TRIPS.forEach(function (t) {
      var y = parse(t.start).getFullYear();
      if (!byYear[y]) { byYear[y] = []; years.push(y); }
      byYear[y].push(t);
    });
    listEl.innerHTML = years.map(function (y) {
      var n = byYear[y].length;
      return '<section class="year-block">' +
          '<div class="year-head">' +
            '<span class="y">' + y + "</span>" +
            '<span class="rule"></span>' +
            '<span class="count">' + n + (n === 1 ? " trip" : " trips") + "</span>" +
          "</div>" +
          '<div class="trips">' + byYear[y].map(card).join("") + "</div>" +
        "</section>";
    }).join("");
  }

  /* ---------- map ⇄ card linking ---------- */
  function findCard(slug) { return document.querySelector('.trip[data-slug="' + slug + '"]'); }

  document.querySelectorAll(".pin").forEach(function (pin) {
    var slug = pin.dataset.slug;
    function on(v) {
      pin.classList.toggle("on", v);
      var c = findCard(slug);
      if (c) c.classList.toggle("on", v);
    }
    pin.addEventListener("mouseenter", function () { on(true); });
    pin.addEventListener("mouseleave", function () { on(false); });
    pin.addEventListener("focus", function () { on(true); });
    pin.addEventListener("blur", function () { on(false); });
    function open() {
      var c = findCard(slug);
      if (c) c.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    pin.addEventListener("click", open);
    pin.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });

  document.querySelectorAll(".trip").forEach(function (c) {
    var slug = c.dataset.slug;
    var pin = document.querySelector('.pin[data-slug="' + slug + '"]');
    if (!pin) return;
    c.addEventListener("mouseenter", function () { pin.classList.add("on"); });
    c.addEventListener("mouseleave", function () { pin.classList.remove("on"); });
  });

  /* ---------- reveal on scroll ---------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function revealAll() {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    if (statsEl) statsEl.querySelectorAll(".n").forEach(countUp);
  }

  if ("IntersectionObserver" in window && !reduce) {
    root.classList.add("js-anim");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        if (en.target.id === "stats")
          en.target.querySelectorAll(".n").forEach(countUp);
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
    // Safety net: nothing stays hidden just because an observer never fired.
    setTimeout(revealAll, 2500);
  } else {
    revealAll();
  }
})();
