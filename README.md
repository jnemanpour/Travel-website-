# Travels

A single home for our trips. Each trip keeps its own page and its own look;
the hub at `index.html` is the list that ties them together.

```
index.html              the hub — hero, stats, world map, trip list
assets/
  data/trips.js         every trip: dates, places, coordinates, blurb
  data/worldmap.js      country outlines, generated (see below)
  css/site.css          hub styling, light + dark
  css/gallery.css       shared grid + media-viewer styles
  js/site.js            renders stats, map and cards from trips.js
  js/gallery.js         shared media viewer (photos and video, one deck)
  covers/               cover images for the hub cards
trips/
  morocco-2026/         planning site — itinerary, stays, costs, city guides
  texas-2026/           recap — day-by-day writeup + photo/video gallery
```

The hub is driven entirely by `assets/data/trips.js`. Stats, map pins, year
grouping and the cards are all derived from it — nothing on the hub is
hand-maintained HTML.

## Adding a trip

1. Create `trips/<place>-<year>/` and put the trip's `index.html` there.
2. Add a cover to `assets/covers/` (3:2, ~1200px wide, WebP).
3. Add an entry to `assets/data/trips.js`. That is the only hub edit — the card,
   the map pin, the year heading and every stat follow from it.
4. Link back to the hub with the `tg-home` snippet used by the existing trips.

A trip's badge is computed from its dates on each page load: **Planning** before
the start date, **Happening now** during, **Recap** after. Nothing to flip by hand.

If the trip visits a country not yet on the map, add its ISO-3166 alpha-3 code to
`VISITED` in the map generator and re-run it so the country gets highlighted:

```bash
pip install "geopandas<1.0"
python3 tools/build_worldmap.py
```

## Using the shared gallery

Link the two shared files, then follow the markup contract:

```html
<link rel="stylesheet" href="../../assets/css/gallery.css">
<script src="../../assets/js/gallery.js" defer></script>

<div data-gallery>
  <div class="tg-grid">
    <figure class="tg-item">
      <a href="assets/gallery/full/photo.jpg" data-w="1200" data-h="1600" data-caption="Where it was taken">
        <img src="assets/gallery/thumbs/photo.webp" alt="…" loading="lazy" decoding="async">
      </a>
      <figcaption class="tg-cap">Where it was taken</figcaption>
    </figure>

    <figure class="tg-item tg-video">
      <a href="assets/gallery/clip.mp4" data-type="video" data-w="720" data-h="1280" data-caption="…">
        <img src="assets/gallery/thumbs/clip-poster.webp" alt="…" loading="lazy" decoding="async">
        <span class="tg-dur">0:17</span>
      </a>
      <figcaption class="tg-cap">…</figcaption>
    </figure>
  </div>
</div>
```

`data-gallery` wraps everything that should form one continuous deck — put it on the
outer container so a swipe carries from one day's photos into the next. `data-w` /
`data-h` are the real pixel dimensions; the grid uses them to reserve space, so tiles
don't jump around while thumbnails load.

The viewer supports arrow keys, swipe, pinch and double-tap zoom, swipe-down to
dismiss, Esc to close, and space to play/pause a clip.

## Preparing media

Photos — a 600px WebP thumbnail for the grid, a 1600px JPEG for the viewer:

```bash
python3 -c "
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open('IN.jpg')).convert('RGB')
f = im.copy(); f.thumbnail((1600,1600), Image.LANCZOS)
f.save('full/OUT.jpg','JPEG',quality=82,optimize=True,progressive=True)
t = im.copy(); t.thumbnail((600,600), Image.LANCZOS)
t.save('thumbs/OUT.webp','WEBP',quality=80,method=6)"
```

Video — phone clips come off the camera at 3–5 Mbps, which is far more than the web
needs. Downscaling to 720px on the short edge is what actually shrinks them; the light
denoise strips sensor noise that h264 would otherwise spend bitrate preserving:

```bash
ffmpeg -i IN.mp4 \
  -vf "hqdn3d=1.5:1:3:3,scale=720:-2:flags=lanczos" \
  -c:v libx264 -profile:v high -preset slow -crf 30 \
  -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 96k -ac 2 OUT.mp4
```

`+faststart` matters — it moves the index to the front of the file so playback can
begin before the whole clip has downloaded.

## Hosting

Served by GitHub Pages from the default branch. `.nojekyll` keeps Pages from running
the files through Jekyll.
