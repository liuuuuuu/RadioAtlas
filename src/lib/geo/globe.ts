/**
 * Pure math for the rotating globe.
 *
 * `GlobeView` describes where the globe is *centred*, in degrees — the d3
 * convention is to feed `[-lon, -lat]` to `projection.rotate()`. Keeping the
 * centre (rather than the raw rotation) makes "fly to this country" trivial.
 *
 * Extracted from the component so drag direction, clamping and the animation
 * helpers can be unit-tested without a DOM.
 */

export interface GlobeView {
  /** Centre longitude in degrees, normalised to (-180, 180]. */
  lon: number;
  /** Centre latitude in degrees, clamped to ±MAX_LAT. */
  lat: number;
  /** 1 = globe fills the frame; higher zooms in. */
  zoom: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 7;
/** Stops the globe from tipping past the poles into a disorienting view. */
export const MAX_LAT = 72;

export const INITIAL_VIEW: GlobeView = { lon: 12, lat: 18, zoom: 1 };

/** Degrees of rotation per pixel dragged, before the zoom divisor. */
const DEG_PER_PX = 0.34;

/** Normalise a longitude into (-180, 180]. */
export function normalizeLon(lon: number): number {
  const wrapped = (((lon % 360) + 540) % 360) - 180;
  // The modulo lands on -180 for half turns; prefer the positive representation.
  return wrapped === -180 ? 180 : wrapped;
}

export function clampLat(lat: number): number {
  return Math.min(Math.max(lat, -MAX_LAT), MAX_LAT);
}

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

export function normalizeView(view: GlobeView): GlobeView {
  return {
    lon: normalizeLon(view.lon),
    lat: clampLat(view.lat),
    zoom: clampZoom(view.zoom),
  };
}

/**
 * Drag the globe by (dx, dy) screen pixels.
 *
 * Dragging right moves the surface right, so the centre shifts *west*;
 * dragging down shifts the centre *north*. Zoomed-in views pan slower.
 */
export function rotateBy(view: GlobeView, dx: number, dy: number): GlobeView {
  const factor = DEG_PER_PX / view.zoom;
  return {
    lon: normalizeLon(view.lon - dx * factor),
    lat: clampLat(view.lat + dy * factor),
    zoom: view.zoom,
  };
}

/** Shortest signed angular difference from `from` to `to`, in (-180, 180]. */
export function shortestDelta(from: number, to: number): number {
  return normalizeLon(to - from);
}

/** Centre a point, keeping (or overriding) the zoom. */
export function viewForPoint(view: GlobeView, lon: number, lat: number, zoom?: number): GlobeView {
  return normalizeView({
    lon: view.lon + shortestDelta(view.lon, lon),
    lat,
    zoom: zoom ?? view.zoom,
  });
}

/** Zoom about the frame centre. */
export function zoomTo(view: GlobeView, zoom: number): GlobeView {
  return normalizeView({ ...view, zoom });
}

/** True when two views are close enough that an animation can stop. */
export function isSettled(a: GlobeView, b: GlobeView, epsilon = 0.05): boolean {
  return (
    Math.abs(shortestDelta(a.lon, b.lon)) < epsilon &&
    Math.abs(a.lat - b.lat) < epsilon &&
    Math.abs(a.zoom - b.zoom) < epsilon
  );
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Interpolate along the *short* way round, so flying from 170° to -170° moves
 * 20° rather than 340°.
 */
export function interpolateView(from: GlobeView, to: GlobeView, t: number): GlobeView {
  const eased = easeInOutCubic(Math.min(Math.max(t, 0), 1));
  return normalizeView({
    lon: from.lon + shortestDelta(from.lon, to.lon) * eased,
    lat: from.lat + (to.lat - from.lat) * eased,
    zoom: from.zoom + (to.zoom - from.zoom) * eased,
  });
}

/** Apply inertia decay to a drag velocity (degrees/second). */
export function decayVelocity(velocity: number, dt: number, friction = 3.2): number {
  return velocity * Math.exp(-friction * dt);
}
