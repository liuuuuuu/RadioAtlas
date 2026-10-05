import { describe, expect, it } from "vitest";
import {
  clampLat,
  clampZoom,
  decayVelocity,
  INITIAL_VIEW,
  interpolateView,
  isSettled,
  MAX_LAT,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeLon,
  rotateBy,
  shortestDelta,
  viewForPoint,
  zoomTo,
} from "./globe";

describe("normalizeLon", () => {
  it.each([
    [0, 0],
    [180, 180],
    [181, -179],
    [-181, 179],
    [360, 0],
    [540, 180],
    [-540, 180],
    [12.5, 12.5],
  ])("normalises %i to %i", (input, expected) => {
    expect(normalizeLon(input)).toBeCloseTo(expected, 6);
  });

  it("always lands in (-180, 180]", () => {
    for (const value of [-1000, -359, -0.1, 0.1, 359, 1000]) {
      const result = normalizeLon(value);
      expect(result).toBeGreaterThan(-180.000001);
      expect(result).toBeLessThanOrEqual(180);
    }
  });
});

describe("clampLat / clampZoom", () => {
  it("stops the globe tipping past the poles", () => {
    expect(clampLat(89)).toBe(MAX_LAT);
    expect(clampLat(-89)).toBe(-MAX_LAT);
    expect(clampLat(10)).toBe(10);
  });

  it("keeps zoom in range", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(3)).toBe(3);
  });
});

describe("rotateBy", () => {
  it("drags the surface, so the centre moves the opposite way", () => {
    // Drag right -> the view now centres a point further west.
    expect(rotateBy(INITIAL_VIEW, 100, 0).lon).toBeLessThan(INITIAL_VIEW.lon);
    // Drag down -> the centre moves north.
    expect(rotateBy(INITIAL_VIEW, 0, 100).lat).toBeGreaterThan(INITIAL_VIEW.lat);
  });

  it("pans slower when zoomed in", () => {
    const near = rotateBy({ lon: 0, lat: 0, zoom: 1 }, 100, 0);
    const far = rotateBy({ lon: 0, lat: 0, zoom: 4 }, 100, 0);
    expect(Math.abs(far.lon)).toBeLessThan(Math.abs(near.lon));
  });

  it("clamps latitude and wraps longitude", () => {
    const spun = rotateBy({ lon: 0, lat: 0, zoom: 1 }, -100_000, 0);
    expect(spun.lon).toBeGreaterThan(-180.000001);
    expect(spun.lon).toBeLessThanOrEqual(180);
    expect(rotateBy({ lon: 0, lat: 0, zoom: 1 }, 0, 100_000).lat).toBe(MAX_LAT);
  });
});

describe("shortestDelta", () => {
  it("takes the short way round the antimeridian", () => {
    expect(shortestDelta(170, -170)).toBeCloseTo(20, 6);
    expect(shortestDelta(-170, 170)).toBeCloseTo(-20, 6);
    expect(shortestDelta(0, 90)).toBeCloseTo(90, 6);
  });
});

describe("viewForPoint", () => {
  it("centres the requested point", () => {
    const view = viewForPoint({ lon: 0, lat: 0, zoom: 1 }, 116.4, 39.9);
    expect(view.lon).toBeCloseTo(116.4, 6);
    expect(view.lat).toBeCloseTo(39.9, 6);
  });

  it("wraps the short way across the antimeridian", () => {
    const view = viewForPoint({ lon: 170, lat: 0, zoom: 1 }, -170, 0);
    // 170 -> -170 is +20, not -340.
    expect(view.lon).toBeCloseTo(-170, 6);
  });

  it("clamps latitude and accepts a zoom override", () => {
    const view = viewForPoint({ lon: 0, lat: 0, zoom: 1 }, 0, 88, 3);
    expect(view.lat).toBe(MAX_LAT);
    expect(view.zoom).toBe(3);
  });
});

describe("interpolateView", () => {
  it("returns the endpoints at t=0 and t=1", () => {
    const from = { lon: 0, lat: 0, zoom: 1 };
    const to = { lon: 100, lat: 40, zoom: 3 };

    expect(interpolateView(from, to, 0).lon).toBeCloseTo(0, 6);
    const end = interpolateView(from, to, 1);
    expect(end.lon).toBeCloseTo(100, 6);
    expect(end.lat).toBeCloseTo(40, 6);
    expect(end.zoom).toBeCloseTo(3, 6);
  });

  it("travels the short way across the antimeridian", () => {
    const mid = interpolateView({ lon: 170, lat: 0, zoom: 1 }, { lon: -170, lat: 0, zoom: 1 }, 0.5);
    // Halfway between 170 and -170 is ±180, never 0.
    expect(Math.abs(mid.lon)).toBeGreaterThan(175);
  });

  it("clamps t outside [0,1]", () => {
    const from = { lon: 0, lat: 0, zoom: 1 };
    const to = { lon: 90, lat: 0, zoom: 1 };
    expect(interpolateView(from, to, -5).lon).toBeCloseTo(0, 6);
    expect(interpolateView(from, to, 5).lon).toBeCloseTo(90, 6);
  });
});

describe("isSettled", () => {
  it("is true for identical views and false otherwise", () => {
    expect(isSettled(INITIAL_VIEW, { ...INITIAL_VIEW })).toBe(true);
    expect(isSettled(INITIAL_VIEW, { ...INITIAL_VIEW, lon: 20 })).toBe(false);
    expect(isSettled(INITIAL_VIEW, { ...INITIAL_VIEW, zoom: 3 })).toBe(false);
  });
});

describe("zoomTo / decayVelocity", () => {
  it("clamps the zoom", () => {
    expect(zoomTo(INITIAL_VIEW, 99).zoom).toBe(MAX_ZOOM);
  });

  it("decays velocity towards zero without overshooting", () => {
    const first = decayVelocity(100, 0.016);
    expect(first).toBeLessThan(100);
    expect(first).toBeGreaterThan(0);
    expect(decayVelocity(100, 10)).toBeLessThan(0.001);
  });
});
