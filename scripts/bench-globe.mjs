/**
 * Micro-benchmark: how expensive is re-projecting the world for an
 * orthographic (rotating globe) view?
 *
 * Run: node scripts/bench-globe.mjs
 *
 * This decides whether the globe can be rendered client-side in SVG.
 */
import { readFileSync } from "node:fs";
import { geoOrthographic, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"));
const collection = feature(topo, topo.objects.countries);
const graticule = geoGraticule10();

const W = 720;
const H = 720;
const projection = geoOrthographic()
  .translate([W / 2, H / 2])
  .scale(W * 0.46)
  .clipAngle(90);
const path = geoPath(projection);

function render(lon, lat) {
  projection.rotate([lon, lat]);
  let total = 0;
  for (const geo of collection.features) {
    const d = path(geo);
    if (d) total += d.length;
  }
  return total;
}

for (let i = 0; i < 5; i += 1) render(i * 3, 0);

const N = 60;
const t0 = performance.now();
for (let i = 0; i < N; i += 1) render(i * 6 - 180, 0);
const t1 = performance.now();

const perFrame = (t1 - t0) / N;
console.log(`features:            ${collection.features.length}`);
console.log(`per frame:           ${perFrame.toFixed(2)} ms  (${(1000 / perFrame).toFixed(0)} fps ceiling)`);
console.log(`graticule path len:  ${(path(graticule) || "").length}`);
console.log(`topojson raw bytes:  ${readFileSync("node_modules/world-atlas/countries-110m.json").length}`);
