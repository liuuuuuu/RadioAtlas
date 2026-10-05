/**
 * Regenerates the committed geo data used by the world map.
 *
 *   npm run geo:build
 *
 * Outputs (both committed, so the app needs no geo libraries at runtime):
 *   src/lib/geo/country-meta.json    ccn3 -> [iso alpha-2, 中文名]
 *   src/lib/geo/country-shapes.json  pre-projected SVG paths + label anchors
 *
 * Re-run when bumping world-atlas / world-countries, or to switch resolution
 * (110m is coarse and small; 50m is sharper and roughly 4x bigger).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { geoCentroid, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries from "world-countries";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 960;
const HEIGHT = 440;

const topo = JSON.parse(
  readFileSync(join(ROOT, "node_modules/world-atlas/countries-110m.json"), "utf8"),
);

const collection = feature(topo, topo.objects.countries);

/**
 * Natural Earth's full sphere spends roughly a third of the frame on polar
 * ocean and Antarctica. Fitting to the populated latitude band instead makes
 * the continents read much larger at the same aspect ratio.
 */
const POPULATED_BAND = {
  type: "Polygon",
  coordinates: [
    [
      [-180, 84],
      [180, 84],
      [180, -56],
      [-180, -56],
      [-180, 84],
    ],
  ],
};

const projection = geoNaturalEarth1().fitExtent(
  [
    [0, 0],
    [WIDTH, HEIGHT],
  ],
  POPULATED_BAND,
);
const toPath = geoPath(projection);

/** numeric ISO 3166-1 -> [alpha-2, Chinese name] */
const meta = {};
for (const country of countries) {
  if (!country.ccn3) continue; // Kosovo (XK) has no numeric code
  meta[country.ccn3] = [
    country.cca2,
    country.translations?.zho?.common ?? country.name.common,
  ];
}

/**
 * d3-geo emits full float precision; at a 960x500 viewBox one decimal place is
 * 0.1px — invisible, and it cuts the committed payload by roughly 40%.
 */
function roundPath(d) {
  return d.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi, (match) => {
    const value = Number(match);
    if (!Number.isFinite(value)) return match;
    return String(Math.round(value * 10) / 10);
  });
}

const shapes = [];
for (const geo of collection.features) {
  const raw = toPath(geo);
  if (!raw) continue;

  // Topojson ids are numeric ISO codes, sometimes lacking leading zeros.
  const id = String(geo.id).padStart(3, "0");
  const centroid = projection(geoCentroid(geo)) ?? [0, 0];

  shapes.push({
    id,
    name: geo.properties?.name ?? "",
    d: roundPath(raw),
    cx: Math.round(centroid[0] * 10) / 10,
    cy: Math.round(centroid[1] * 10) / 10,
  });
}

writeFileSync(join(ROOT, "src/lib/geo/country-meta.json"), `${JSON.stringify(meta)}\n`);
writeFileSync(
  join(ROOT, "src/lib/geo/country-shapes.json"),
  `${JSON.stringify({
    width: WIDTH,
    height: HEIGHT,
    // Persisted so the server can project station lat/lon into the same space.
    projection: {
      translate: projection.translate().map((n) => Math.round(n * 1000) / 1000),
      scale: Math.round(projection.scale() * 1000) / 1000,
    },
    shapes,
  })}\n`,
);

console.log(`country-meta.json   ${Object.keys(meta).length} countries`);
console.log(`country-shapes.json ${shapes.length} shapes`);
