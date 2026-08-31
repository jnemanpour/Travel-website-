/* ============================================================
   Shared trip gallery viewer.
   Handles photos and video in one deck: keyboard, swipe,
   pinch-zoom, captions, counter, neighbour preloading.

   Markup contract — see assets/css/gallery.css for the classes:
     <div class="tg-grid" data-gallery>
       <figure class="tg-item">
         <a href="full/x.jpg" data-w="1200" data-h="1600" data-caption="…">
           <img src="thumbs/x.webp" width="600" height="800" loading="lazy" alt="…">
         </a>
       </figure>
       <figure class="tg-item tg-video">
         <a href="clip-01.mp4" data-type="video" data-w="1080" data-h="1920" data-caption="…"> … </a>
       </figure>
     </div>
   ============================================================ */
(function () {
  "use strict";

  var links = [].slice.call(document.querySelectorAll("[data-gallery] a"));
  if (!links.length) return;

  var items = links.map(function (a) {
    return {
      src: a.getAttribute("href"),
      type: a.dataset.type === "video" ? "video" : "image",
      w: parseInt(a.dataset.w, 10) || 0,
      h: parseInt(a.dataset.h, 10) || 0,
      poster: (a.querySelector("img") || {}).src || "",
      caption: a.dataset.caption || "",
      thumb: a.querySelector("img")
    };
  });

  /* ---------- masonry row spans ----------
     Each tile keeps its real aspect ratio (no square cropping) while the grid
     still flows left-to-right, so a day's photos stay in the order they happened. */
  var ITEM_GAP = 12;

  function setRatios() {
    links.forEach(function (a) {
      var w = parseInt(a.dataset.w, 10), h = parseInt(a.dataset.h, 10);
      if (w > 0 && h > 0) a.style.aspectRatio = w + " / " + h;
    });
  }

  function masonry() {
    document.querySelectorAll(".tg-grid").forEach(function (grid) {
      grid.classList.add("tg-masonry");
      var row = parseFloat(getComputedStyle(grid).gridAutoRows) || 4;
      var gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      [].forEach.call(grid.children, function (fig) {
        fig.style.gridRowEnd = "auto";
        var h = fig.getBoundingClientRect().height + ITEM_GAP;
        fig.style.gridRowEnd = "span " + Math.max(1, Math.ceil((h + gap) / (row + gap)));
      });
    });
  }

  setRatios();
  masonry();
  window.addEventListener("load", masonry);
  var mzTimer;
  window.addEventListener("resize", function () {
    clearTimeout(mzTimer);
    mzTimer = setTimeout(masonry, 120);
  });
  // Captions can reflow once webfonts land.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(masonry);

  /* ---------- build viewer chrome once ---------- */
  var v = document.createElement("div");
  v.className = "tg-viewer";
  v.setAttribute("role", "dialog");
  v.setAttribute("aria-modal", "true");
  v.setAttribute("aria-label", "Media viewer");
  v.innerHTML =
    '<div class="tg-stage"></div>' +
    '<div class="tg-bar tg-bar-top">' +
      '<span class="tg-count"></span>' +
      '<span class="tg-spacer"></span>' +
      '<button class="tg-btn tg-full" type="button" aria-label="Toggle fullscreen">' +
        '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/></svg>' +
      '</button>' +
      '<button class="tg-btn tg-close" type="button" aria-label="Close (Esc)">' +
        '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>' +
    '<button class="tg-btn tg-nav tg-prev" type="button" aria-label="Previous">' +
      '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>' +
    '<button class="tg-btn tg-nav tg-next" type="button" aria-label="Next">' +
      '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>' +
    '<div class="tg-caption"><span></span></div>';
  document.body.appendChild(v);

  var stage = v.querySelector(".tg-stage"),
      elCount = v.querySelector(".tg-count"),
      elCap = v.querySelector(".tg-caption span"),
      btnPrev = v.querySelector(".tg-prev"),
      btnNext = v.querySelector(".tg-next"),
      btnFull = v.querySelector(".tg-full"),
      btnClose = v.querySelector(".tg-close");

  var index = -1, slides = {}, lastFocus = null, idleTimer = null;

  /* ---------- slide construction ---------- */
  function build(i) {
    if (slides[i]) return slides[i];
    var it = items[i];
    var s = document.createElement("div");
    s.className = "tg-slide tg-loading";
    s.innerHTML = '<div class="tg-spin"></div>';

    var media;
    if (it.type === "video") {
      media = document.createElement("video");
      media.setAttribute("controls", "");
      media.setAttribute("playsinline", "");
      media.setAttribute("preload", "metadata");
      if (it.poster) media.poster = it.poster;
      media.src = it.src;
      media.addEventListener("loadeddata", function () { s.classList.remove("tg-loading"); });
    } else {
      media = document.createElement("img");
      media.alt = it.caption || "";
      media.decoding = "async";
      media.addEventListener("load", function () { s.classList.remove("tg-loading"); });
      media.src = it.src;
    }
    media.addEventListener("error", function () { s.classList.remove("tg-loading"); });
    s.appendChild(media);
    s._media = media;
    s._item = it;
    stage.appendChild(s);
    slides[i] = s;
    return s;
  }

  /* ---------- zoom / pan state (images only) ---------- */
  var z = { scale: 1, x: 0, y: 0 };

  function applyTransform(s) {
    if (!s || s._item.type !== "image") return;
    s._media.style.transform =
      "translate3d(" + z.x + "px," + z.y + "px,0) scale(" + z.scale + ")";
    s.classList.toggle("tg-zoomed", z.scale > 1.01);
  }

  function resetZoom(s) {
    z.scale = 1; z.x = 0; z.y = 0;
    if (s && s._item.type === "image") {
      s._media.style.transition = "";
      s._media.style.transformOrigin = "0 0";
      applyTransform(s);
    }
  }

  /* Clamp pan so the image can't be dragged entirely off-screen. */
  function clampPan(s) {
    if (!s || s._item.type !== "image" || z.scale <= 1) { z.x = 0; z.y = 0; return; }
    var r = s._media.getBoundingClientRect();
    var natW = r.width / z.scale, natH = r.height / z.scale;
    var maxX = Math.max(0, (natW * z.scale - window.innerWidth) / 2 + 20);
    var maxY = Math.max(0, (natH * z.scale - window.innerHeight) / 2 + 20);
    z.x = Math.max(-maxX, Math.min(maxX, z.x));
    z.y = Math.max(-maxY, Math.min(maxY, z.y));
  }

  function zoomTo(s, scale, cx, cy) {
    var m = s._media, r = m.getBoundingClientRect();
    // Keep the point under the cursor/fingers anchored while scaling.
    var ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
    var k = scale / z.scale;
    z.x = z.x * k - ox * (k - 1);
    z.y = z.y * k - oy * (k - 1);
    z.scale = scale;
    clampPan(s);
    m.style.transformOrigin = "center center";
    m.style.transition = "transform 0.28s cubic-bezier(.2,.7,.2,1)";
    applyTransform(s);
    setTimeout(function () { if (m) m.style.transition = ""; }, 300);
  }

  /* ---------- navigation ---------- */
  function layout() {
    Object.keys(slides).forEach(function (k) {
      var i = +k;
      slides[i].style.transform = "translate3d(" + ((i - index) * 100) + "%,0,0)";
      slides[i].style.visibility = Math.abs(i - index) <= 1 ? "visible" : "hidden";
    });
  }

  function show(i, instant) {
    if (i < 0 || i >= items.length) return;
    var prev = slides[index];
    if (prev) {
      resetZoom(prev);
      if (prev._item.type === "video") prev._media.pause();
    }
    index = i;
    build(i);
    if (i > 0) build(i - 1);              // preload neighbours, nothing further
    if (i < items.length - 1) build(i + 1);

    Object.keys(slides).forEach(function (k) {
      slides[+k].style.transition = instant ? "none" : "transform 0.3s cubic-bezier(.2,.7,.2,1)";
    });
    layout();
    if (instant) {
      // force reflow so the next move animates
      void stage.offsetWidth;
      Object.keys(slides).forEach(function (k) {
        slides[+k].style.transition = "transform 0.3s cubic-bezier(.2,.7,.2,1)";
      });
    }

    elCount.textContent = (i + 1) + " / " + items.length;
    elCap.textContent = items[i].caption;
    btnPrev.hidden = i === 0;
    btnNext.hidden = i === items.length - 1;
    wake();
  }

  function next() { if (index < items.length - 1) show(index + 1); }
  function prev() { if (index > 0) show(index - 1); }

  /* ---------- open / close ---------- */
  function open(i) {
    lastFocus = document.activeElement;
    v.classList.add("tg-open");
    document.documentElement.style.overflow = "hidden";
    show(i, true);
    requestAnimationFrame(function () { v.classList.add("tg-shown"); });
    btnClose.focus({ preventScroll: true });
  }

  function close() {
    var s = slides[index];
    if (s && s._item.type === "video") s._media.pause();
    v.classList.remove("tg-shown");
    setTimeout(function () {
      v.classList.remove("tg-open");
      document.documentElement.style.overflow = "";
      // drop slides so video buffers are released
      stage.innerHTML = "";
      slides = {};
      index = -1;
    }, 220);
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- idle chrome ---------- */
  function wake() {
    v.classList.remove("tg-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (v.classList.contains("tg-open")) v.classList.add("tg-idle");
    }, 3200);
  }

  /* ---------- wiring ---------- */
  links.forEach(function (a, i) {
    a.addEventListener("click", function (e) { e.preventDefault(); open(i); });
  });

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", function (e) { e.stopPropagation(); prev(); });
  btnNext.addEventListener("click", function (e) { e.stopPropagation(); next(); });
  btnFull.addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (v.requestFullscreen) v.requestFullscreen();
  });

  document.addEventListener("keydown", function (e) {
    if (!v.classList.contains("tg-open")) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === " ") {
      var s = slides[index];
      if (s && s._item.type === "video") {
        e.preventDefault();
        s._media.paused ? s._media.play() : s._media.pause();
      }
    }
    wake();
  });

  v.addEventListener("mousemove", wake);

  /* Wheel / trackpad pinch zoom on photos. */
  stage.addEventListener("wheel", function (e) {
    var s = slides[index];
    if (!s || s._item.type !== "image" || !e.ctrlKey) return;
    e.preventDefault();
    var target = Math.max(1, Math.min(5, z.scale * (1 - e.deltaY / 220)));
    zoomTo(s, target, e.clientX, e.clientY);
  }, { passive: false });

  /* ---------- pointer: swipe, drag-to-pan, pinch ---------- */
  var pts = new Map(), start = null, mode = null, pinchStart = 0, startZ = null, lastTap = 0;

  function centroid() {
    var xs = 0, ys = 0, n = 0;
    pts.forEach(function (p) { xs += p.x; ys += p.y; n++; });
    return { x: xs / n, y: ys / n, n: n };
  }
  function spread() {
    var a = [].concat.apply([], [Array.from(pts.values())]);
    if (a.length < 2) return 0;
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  }

  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".tg-btn")) return;
    var s = slides[index];
    // Let the native video controls handle their own pointer events.
    if (s && s._item.type === "video" && e.target.tagName === "VIDEO") return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.setPointerCapture(e.pointerId);
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY, t: Date.now(), zx: z.x, zy: z.y, target: e.target };
      mode = z.scale > 1.01 ? "pan" : "swipe";
    } else if (pts.size === 2) {
      mode = "pinch";
      pinchStart = spread();
      startZ = { scale: z.scale, x: z.x, y: z.y };
    }
    wake();
  });

  stage.addEventListener("pointermove", function (e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    var s = slides[index];
    if (!s) return;

    if (mode === "pinch" && pts.size >= 2 && s._item.type === "image") {
      var d = spread();
      if (!pinchStart) return;
      z.scale = Math.max(1, Math.min(5, startZ.scale * (d / pinchStart)));
      clampPan(s);
      applyTransform(s);
      return;
    }

    var dx = e.clientX - start.x, dy = e.clientY - start.y;

    if (mode === "pan" && s._item.type === "image") {
      s.classList.add("tg-panning");
      z.x = start.zx + dx; z.y = start.zy + dy;
      clampPan(s);
      applyTransform(s);
      return;
    }

    if (mode === "swipe") {
      // Horizontal drags move the deck; a decisive vertical drag dismisses.
      if (Math.abs(dx) > Math.abs(dy)) {
        Object.keys(slides).forEach(function (k) {
          var i = +k;
          slides[i].style.transition = "none";
          slides[i].style.transform =
            "translate3d(calc(" + ((i - index) * 100) + "% + " + dx + "px),0,0)";
        });
      } else {
        s.style.transition = "none";
        s.style.transform = "translate3d(0," + dy + "px,0)";
        v.style.opacity = Math.max(0.3, 1 - Math.abs(dy) / 500);
      }
    }
  });

  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    var s = slides[index];
    if (!s) return;

    if (mode === "pinch") {
      if (pts.size < 2) {
        if (z.scale <= 1.02) resetZoom(s);
        mode = pts.size === 1 ? "pan" : null;
        if (mode === "pan") {
          var only = Array.from(pts.values())[0];
          start = { x: only.x, y: only.y, t: Date.now(), zx: z.x, zy: z.y };
        }
      }
      return;
    }

    if (pts.size > 0) return;
    s.classList.remove("tg-panning");
    if (mode === "pan") { mode = null; return; }

    if (mode === "swipe" && start) {
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      var dt = Date.now() - start.t;
      var fast = dt < 300;
      v.style.opacity = "";
      Object.keys(slides).forEach(function (k) {
        slides[+k].style.transition = "transform 0.3s cubic-bezier(.2,.7,.2,1)";
      });
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 110) { close(); return; }
      if (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30)) {
        dx < 0 ? next() : prev();
        layout();
        s.style.transform = "translate3d(0,0,0)";
        mode = null;
        return;
      }

      layout();
      s.style.transform = "translate3d(0,0,0)";
      layout();

      // A tap that never moved: on the backdrop it dismisses, on a photo it
      // toggles zoom when it is the second tap of a pair.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        var onMedia = start.target === s._media;
        if (!onMedia) { close(); mode = null; return; }
        if (s._item.type === "image") {
          var now = Date.now();
          if (now - lastTap < 320) {
            zoomTo(s, z.scale > 1.01 ? 1 : 2.5, e.clientX, e.clientY);
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }
      }
    }
    mode = null;
  }

  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  window.addEventListener("resize", function () {
    var s = slides[index];
    if (s) { resetZoom(s); layout(); }
  });
})();
