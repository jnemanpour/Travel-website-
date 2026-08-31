/* Every trip on the site. Add an entry here and the hub picks it up —
   card, map marker and stats are all derived from this. */
window.TRIPS = [
  {
    slug: "morocco-2026",
    title: "Morocco Honeymoon",
    href: "trips/morocco-2026/index.html",
    start: "2026-08-23",
    end: "2026-09-04",
    nights: 11,
    countries: [{ iso: "MAR", name: "Morocco" }],
    places: [
      { name: "Casablanca",  lat: 33.5731, lon: -7.5898 },
      { name: "Marrakech",   lat: 31.6295, lon: -7.9811 },
      { name: "Sahara",      lat: 31.0801, lon: -4.0133 },
      { name: "Fes",         lat: 34.0181, lon: -5.0078 },
      { name: "Chefchaouen", lat: 35.1688, lon: -5.2636 }
    ],
    blurb: "A one-way arc across Morocco — red-city souks, a night under the stars in the Sahara, the blue lanes of Chefchaouen, and back to the Atlantic to fly home.",
    facts: ["12 days", "4 cities + the desert", "Itinerary & costs"],
    cover: { type: "art" },
    media: 0
  },
  {
    slug: "texas-2026",
    title: "Texas 4th of July",
    href: "trips/texas-2026/index.html",
    start: "2026-07-02",
    end: "2026-07-05",
    nights: 3,
    countries: [{ iso: "USA", name: "United States" }],
    places: [
      { name: "Fort Worth", lat: 32.7555, lon: -97.3308 },
      { name: "Dallas",     lat: 32.7767, lon: -96.7970 }
    ],
    blurb: "Four days of rodeo, honky-tonks and pool afternoons — the cattle drive down Exchange Avenue, Billy Bob's after dark, and the Fourth itself out in Dallas.",
    facts: ["4 days", "2 cities", "Full gallery"],
    cover: { type: "image", src: "assets/covers/texas-2026.webp", alt: "Under the Fort Worth Stockyards sign" },
    media: 54
  }
];
