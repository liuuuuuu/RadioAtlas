import { describe, expect, it } from "vitest";
import {
  clampView,
  fitToBox,
  INITIAL_VIEW,
  MAX_SCALE,
  MIN_SCALE,
  zoomAt,
  type Viewport,
} from "./viewport";

const W = 960;
const H = 440;

/** Where a viewBox point lands on screen. */
function project(view: Viewport, x: number, y: number) {
  return { x: x * view.scale + view.tx, y: y * view.scale + view.ty };
}

describe("clampView", () => {
  it("snaps back to the initial view at or below 1x", () => {
    expect(clampView({ scale: 1, tx: 40, ty: -80 }, W, H)).toEqual(INITIAL_VIEW);
    expect(clampView({ scale: 0.5, tx: 0, ty: 0 }, W, H)).toEqual(INITIAL_VIEW);
  });

  it("stops the map from being dragged off the frame", () => {
    const clamped = clampView({ scale: 2, tx: 500, ty: 500 }, W, H);
    expect(clamped.tx).toBe(0);
    expect(clamped.ty).toBe(0);

    const other = clampView({ scale: 2, tx: -5000, ty: -5000 }, W, H);
    expect(other.tx).toBe(W - W * 2);
    expect(other.ty).toBe(H - H * 2);
  });

  it("always keeps the frame covered", () => {
    for (const tx of [-9999, -500, 0, 500, 9999]) {
      for (const scale of [1.2, 3, 18]) {
        const view = clampView({ scale, tx, ty: tx }, W, H);
        expect(view.tx).toBeLessThanOrEqual(0);
        expect(view.tx + W * view.scale).toBeGreaterThanOrEqual(W);
        expect(view.ty).toBeLessThanOrEqual(0);
        expect(view.ty + H * view.scale).toBeGreaterThanOrEqual(H);
      }
    }
  });
});

describe("fitToBox", () => {
  it("centres the box in the frame", () => {
    const box = { x: 600, y: 100, width: 200, height: 120 };
    const view = fitToBox(box, W, H);

    const centre = project(view, box.x + box.width / 2, box.y + box.height / 2);
    expect(centre.x).toBeCloseTo(W / 2, 6);
    expect(centre.y).toBeCloseTo(H / 2, 6);
  });

  it("zooms in on a small country", () => {
    expect(fitToBox({ x: 700, y: 130, width: 40, height: 30 }, W, H).scale).toBeGreaterThan(3);
  });

  it("falls back to 1x for something larger than the frame", () => {
    expect(fitToBox({ x: 0, y: 0, width: 4000, height: 3000 }, W, H)).toEqual(INITIAL_VIEW);
  });

  it("never exceeds the maximum zoom for a degenerate box", () => {
    const view = fitToBox({ x: 100, y: 100, width: 0, height: 0 }, W, H);
    expect(view.scale).toBe(MAX_SCALE);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the cursor fixed", () => {
    const before = INITIAL_VIEW;
    const point = { x: 300, y: 200 };
    const after = zoomAt(before, point, 2, W, H);

    expect(project(after, point.x, point.y)).toEqual({
      x: expect.closeTo(point.x, 6),
      y: expect.closeTo(point.y, 6),
    });
  });

  it("is a no-op when already at the limit", () => {
    const maxed: Viewport = { scale: MAX_SCALE, tx: 0, ty: 0 };
    expect(zoomAt(maxed, { x: 100, y: 100 }, 2, W, H)).toBe(maxed);

    const minned: Viewport = { scale: MIN_SCALE, tx: 0, ty: 0 };
    expect(zoomAt(minned, { x: 100, y: 100 }, 0.5, W, H)).toBe(minned);
  });

  it("clamps the resulting scale", () => {
    expect(zoomAt(INITIAL_VIEW, { x: 0, y: 0 }, 1000, W, H).scale).toBe(MAX_SCALE);
  });
});
