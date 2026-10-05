import { geoNaturalEarth1 } from "d3-geo";
import countryShapesJson from "./country-shapes.json";

/**
 * The exact projection used when `npm run geo:build` pre-rendered the country
 * outlines. Station markers must go through the same one or they will not line
 * up with the map.
 */
const CONFIG = countryShapesJson.projection;

const projection = geoNaturalEarth1()
  .translate([CONFIG.translate[0] ?? 0, CONFIG.translate[1] ?? 0])
  .scale(CONFIG.scale);

/** lon/lat -> [x, y] in the shared viewBox. */
export function projectToViewBox(lon: number, lat: number): [number, number] {
  return projection([lon, lat]) ?? [0, 0];
}
