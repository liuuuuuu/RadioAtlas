import type { Country } from "@/lib/radio-browser/types";
import countryMetaJson from "./country-meta.json";
import type { MapCountry } from "./types";

/**
 * Joins per-country station counts onto the numeric-ISO -> name table.
 *
 * The outlines themselves are no longer precomputed: the globe re-projects on
 * every frame, so the client fetches the raw TopoJSON and joins it against this
 * list by padded numeric id.
 */
const COUNTRY_META = countryMetaJson as Record<string, string[] | undefined>;

export function buildMapCountries(directory: Country[]): MapCountry[] {
  const countByIso2 = new Map<string, number>();
  for (const entry of directory) {
    countByIso2.set(entry.iso_3166_1.toUpperCase(), entry.stationcount);
  }

  return Object.entries(COUNTRY_META).flatMap(([id, meta]) => {
    if (!meta) return [];

    const iso2 = meta[0] ?? "";
    return [
      {
        id,
        iso2,
        label: meta[1] ?? iso2,
        stationCount: iso2 ? (countByIso2.get(iso2) ?? 0) : 0,
      },
    ];
  });
}

/** ISO alpha-2 -> display name, for the province/region views. */
export function countryLabel(iso2: string): string | null {
  const target = iso2.toUpperCase();
  for (const value of Object.values(COUNTRY_META)) {
    if (value && value[0] === target) return value[1] ?? null;
  }
  return null;
}
