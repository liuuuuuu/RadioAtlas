import { geoOrthographic, geoPath } from "d3-geo";

const SIZE = 720;
const BASE_SCALE = SIZE * 0.44;
const projection = geoOrthographic()
  .translate([SIZE / 2, SIZE / 2])
  .scale(BASE_SCALE)
  .clipAngle(90);
const path = geoPath(projection);

/** Sanity-check the rotate() convention used by the globe. */
function check(name, lon, lat, view) {
  projection.rotate([-view.lon, -view.lat]);
  const point = projection([lon, lat]);
  const inside = path({ type: "Point", coordinates: [lon, lat] }) !== null;
  console.log(
    `${name}: centre=(${view.lon}, ${view.lat})  point=(${lon}, ${lat})  ->  x=${point ? point[0].toFixed(1) : "null"} y=${point ? point[1].toFixed(1) : "null"}  visible=${inside}`,
  );
}

console.log(`viewBox centre should be ${SIZE / 2}, ${SIZE / 2}\n`);

// The point we centre must land dead centre.
check("centred", 12, 18, { lon: 12, lat: 18 });
check("centred", 116.4, 39.9, { lon: 116.4, lat: 39.9 });
check("centred", -74, 40.7, { lon: -74, lat: 40.7 });

console.log("");

// Dragging right must reveal land that was to the WEST (smaller longitude).
const before = { lon: 0, lat: 0 };
const after = { lon: -40, lat: 0 };
check("before drag", 0, 0, before);
check("after dragging right", 0, 0, after);

console.log("");
console.log("China from a Europe-centred view (should be off-globe or near the right limb):");
check("europe view", 116.4, 39.9, { lon: 10, lat: 20 });
