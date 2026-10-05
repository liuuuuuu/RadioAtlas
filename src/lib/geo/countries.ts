import type { Country } from "@/lib/radio-browser/types";
import countryMetaJson from "./country-meta.json";
import countryShapesJson from "./country-shapes.json";
import type { CountryShape, MapCountry } from "./types";

/**
 * Server-side join of three sources into renderable map countries:
 *   1. pre-projected outlines (country-shapes.json)
 *   2. numeric ISO -> alpha-2 + Chinese name (country-meta.json)
 *   3. per-country station counts (Radio Browser /json/countries)
 *
 * Kept out of client components on purpose: the outlines are ~125 KB.
 */

export const MAP_WIDTH = countryShapesJson.width;
export const MAP_HEIGHT = countryShapesJson.height;

const COUNTRY_META = countryMetaJson as Record<string, string[] | undefined>;
const SHAPES = countryShapesJson.shapes as CountryShape[];

/** Attach localised names and directory counts to every country outline. */
export function buildMapCountries(directory: Country[]): MapCountry[] {
  const countByIso2 = new Map<string, number>();
  for (const entry of directory) {
    countByIso2.set(entry.iso_3166_1.toUpperCase(), entry.stationcount);
  }

  return SHAPES.map((shape) => {
    const meta = COUNTRY_META[shape.id];
    const iso2 = meta?.[0] ?? "";

    return {
      ...shape,
      iso2,
      label: meta?.[1] ?? shape.name,
      stationCount: iso2 ? (countByIso2.get(iso2) ?? 0) : 0,
    };
  });
}
