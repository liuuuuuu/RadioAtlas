import { describe, expect, it } from "vitest";
import type { Country } from "@/lib/radio-browser/types";
import { buildMapCountries, countryLabel } from "./countries";

function country(name: string, iso: string, stationcount: number): Country {
  return { name, iso_3166_1: iso, stationcount };
}

describe("buildMapCountries", () => {
  it("joins directory counts and Chinese labels onto every entry", () => {
    const countries = buildMapCountries([country("China", "CN", 794)]);
    const china = countries.find((entry) => entry.iso2 === "CN");

    expect(countries.length).toBeGreaterThan(200);
    expect(china).toBeDefined();
    expect(china?.label).toBe("中国");
    expect(china?.stationCount).toBe(794);
  });

  it("keys every entry by a zero-padded numeric ISO code", () => {
    for (const entry of buildMapCountries([])) {
      expect(entry.id).toMatch(/^\d{3}$/);
    }
    expect(buildMapCountries([]).find((entry) => entry.iso2 === "AQ")?.id).toBe("010");
  });

  it("defaults to zero when the directory has no entry", () => {
    expect(buildMapCountries([]).every((entry) => entry.stationCount === 0)).toBe(true);
  });

  it("matches ISO codes case-insensitively", () => {
    const countries = buildMapCountries([country("China", "cn", 7)]);
    expect(countries.find((entry) => entry.iso2 === "CN")?.stationCount).toBe(7);
  });
});

describe("countryLabel", () => {
  it("resolves localised names", () => {
    expect(countryLabel("CN")).toBe("中国");
    expect(countryLabel("cn")).toBe("中国");
  });

  it("returns null for unknown codes", () => {
    expect(countryLabel("ZZ")).toBeNull();
  });
});
