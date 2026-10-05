/**
 * Regenerates the geo data the map needs.
 *
 *   npm run geo:build
 *
 * Outputs:
 *   src/lib/geo/country-meta.json      ccn3 -> [iso alpha-2, 中文名]   (committed)
 *   public/geo/countries-110m.json     TopoJSON outlines, served to the client
 *
 * The globe re-projects on every frame (it rotates), so outlines can no longer
 * be pre-projected into static SVG paths. Instead the raw TopoJSON ships to the
 * browser and d3-geo projects it live — measured at ~5 ms/frame for 177
 * features, which is why the render loop bypasses React and writes `d`
 * attributes directly.
 *
 * Re-run when bumping world-atlas / world-countries.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import countries from "world-countries";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOPO_SRC = join(ROOT, "node_modules/world-atlas/countries-110m.json");
const TOPO_DEST = join(ROOT, "public/geo/countries-110m.json");

/** numeric ISO 3166-1 -> [alpha-2, Chinese name] */
const meta = {};
for (const country of countries) {
  if (!country.ccn3) continue; // Kosovo (XK) has no numeric code
  meta[country.ccn3] = [
    country.cca2,
    country.translations?.zho?.common ?? country.name.common,
  ];
}

writeFileSync(join(ROOT, "src/lib/geo/country-meta.json"), `${JSON.stringify(meta)}\n`);

mkdirSync(dirname(TOPO_DEST), { recursive: true });
copyFileSync(TOPO_SRC, TOPO_DEST);

const topo = JSON.parse(readFileSync(TOPO_SRC, "utf8"));
console.log(`country-meta.json        ${Object.keys(meta).length} countries`);
console.log(`public/geo/countries-110m.json  ${topo.objects.countries.geometries.length} outlines`);
