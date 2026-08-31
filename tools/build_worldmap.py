#!/usr/bin/env python3
"""Regenerate assets/data/worldmap.js.

Country outlines come from Natural Earth's 110m dataset, which older geopandas
ships with:  pip install "geopandas<1.0"

Add an ISO-3166 alpha-3 code to VISITED to have that country highlighted.
"""
import json, warnings
import geopandas as gpd
from shapely.geometry import MultiPolygon, Polygon, box

warnings.filterwarnings("ignore")

VISITED = {"MAR", "USA", "ESP"}

# Equirectangular, cropped to the inhabited band so the map isn't mostly ocean.
LON0, LON1, LAT0, LAT1 = -180, 180, -58, 84
W = 2000
H = W * (LAT1 - LAT0) / (LON1 - LON0)
CLIP = box(LON0, LAT0, LON1, LAT1)
SIMPLIFY = 0.22   # degrees; coarse enough to stay small, fine enough to read
MIN_AREA = 0.35   # drop specks that would vanish at this size anyway


def project(x, y):
    return ((x - LON0) / (LON1 - LON0) * W,
            (LAT1 - y) / (LAT1 - LAT0) * H)


def ring_to_path(coords):
    pts = ["{:.1f} {:.1f}".format(*project(x, y)) for x, y in coords]
    return "M" + "L".join(pts) + "Z" if pts else ""


def geom_to_path(geom):
    geom = geom.intersection(CLIP)
    if geom.is_empty:
        return ""
    geom = geom.simplify(SIMPLIFY, preserve_topology=True)
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    return "".join(
        ring_to_path(p.exterior.coords)
        for p in polys
        if isinstance(p, Polygon) and not p.is_empty and p.area >= MIN_AREA
    )


def main():
    g = gpd.read_file(gpd.datasets.get_path("naturalearth_lowres"))
    g = g[g.name != "Antarctica"]

    land, visited = [], {}
    for _, row in g.iterrows():
        d = geom_to_path(row.geometry)
        if not d:
            continue
        if row.iso_a3 in VISITED:
            visited[row.iso_a3] = d
        else:
            land.append(d)

    data = {
        "viewBox": f"0 0 {W:.0f} {H:.0f}",
        "bounds": {"lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1},
        "land": "".join(land),
        "visited": visited,
    }
    out = "assets/data/worldmap.js"
    with open(out, "w") as f:
        f.write("window.WORLDMAP=" + json.dumps(data, separators=(",", ":")) + ";\n")
    print(f"wrote {out} — {len(visited)} highlighted: {sorted(visited)}")


if __name__ == "__main__":
    main()
