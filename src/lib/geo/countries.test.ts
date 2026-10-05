import { describe, expect, it } from "vitest";
import type { Country } from "@/lib/radio-browser/types";
import { buildMapCountries, MAP_HEIGHT, MAP_WIDTH } from "./countries";

function country(name: string, iso: string, stationcount: number): Country {
  return { name, iso_3166_1: iso, stationcount };
}

describe("buildMapCountries", () => {
  it("joins directory counts and Chinese labels onto the outlines", () => {
    const countries = buildMapCountries([country("China", "CN", 794)]);
    const china = countries.find((entry) => entry.iso2 === "CN");

    expect(countries.length).toBeGreaterThan(100);
    expect(china).toBeDefined();
    expect(china?.label).toBe("中国");
    expect(china?.stationCount).toBe(794);
    expect((china?.d ?? "").length).toBeGreaterThan(100);
  });

  it("defaults to zero when the directory has no entry", () => {
    const countries = buildMapCountries([]);
    expect(countries.every((entry) => entry.stationCount === 0)).toBe(true);
  });

  it("matches ISO codes case-insensitively", () => {
    const countries = buildMapCountries([country("China", "cn", 7)]);
    expect(countries.find((entry) => entry.iso2 === "CN")?.stationCount).toBe(7);
  });

  it("gives every outline a usable label and geometry", () => {
    for (const entry of buildMapCountries([])) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.d.length).toBeGreaterThan(0);
      expect(Number.isFinite(entry.cx)).toBe(true);
      expect(Number.isFinite(entry.cy)).toBe(true);
    }
  });

  it("exposes the shared viewBox used to pre-project the outlines", () => {
    expect(MAP_WIDTH).toBe(960);
    expect(MAP_HEIGHT).toBe(440);
  });
});
