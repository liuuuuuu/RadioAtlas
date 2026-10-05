import { describe, expect, it } from "vitest";
import { DENSITY_FILLS, densityBucket, densityFill } from "./density";

describe("densityBucket", () => {
  it("returns bucket 0 for countries with nothing listed", () => {
    expect(densityBucket(0)).toBe(0);
    expect(densityBucket(-5)).toBe(0);
  });

  it.each([
    [1, 1],
    [9, 1],
    [10, 2],
    [49, 2],
    [50, 3],
    [199, 3],
    [200, 4],
    [799, 4],
    [800, 5],
    [2499, 5],
    [2500, 6],
    [7175, 6],
  ])("maps %i stations to bucket %i", (count, expected) => {
    expect(densityBucket(count)).toBe(expected);
  });

  it("keeps the largest markets out of the top bucket's neighbours", () => {
    // Calibrated against the real directory: only US/DE/FR/RU/MX clear 2500.
    expect(densityBucket(2747)).toBe(6);
    expect(densityBucket(2242)).toBe(5);
  });

  it("never returns an index outside the palette", () => {
    for (const count of [0, 1, 25, 80, 200, 500, 2000, 1_000_000]) {
      const bucket = densityBucket(count);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(DENSITY_FILLS.length);
    }
  });
});

describe("densityFill", () => {
  it("resolves the ends of the ramp", () => {
    expect(densityFill(0)).toBe(DENSITY_FILLS[0]);
    expect(densityFill(60_228)).toBe(DENSITY_FILLS[6]);
  });
});
