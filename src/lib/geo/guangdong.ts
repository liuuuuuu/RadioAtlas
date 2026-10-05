import { searchStations } from "@/lib/radio-browser/queries";
import type { Station } from "@/lib/radio-browser/types";
import { classifyGuangdongCity, GUANGDONG_STATE_ALIASES, PROVINCE_WIDE_ID } from "./regions";

export interface GuangdongStation extends Station {
  /** City bucket derived from the station name; "province" for province-wide. */
  cityId: string;
}

export interface GuangdongCityGroup {
  id: string;
  label: string;
  count: number;
}

/**
 * Guangdong stations, merged across both romanisations of the province name and
 * de-duplicated by uuid.
 *
 * Mainland Chinese provinces have no usable index in the directory
 * (`/json/states/China` only lists Macao and Hong Kong), so `state=` search is
 * the only route. Stations whose state is blank — 435 of China's 2052 — cannot
 * be recovered without downloading the whole country, which takes ~54s.
 */
export async function getGuangdongStations(limit = 200): Promise<GuangdongStation[]> {
  const batches = await Promise.all(
    GUANGDONG_STATE_ALIASES.map((state) =>
      searchStations({ state, countrycode: "CN", limit }, { revalidate: 1800 }).catch(
        (): Station[] => [],
      ),
    ),
  );

  const seen = new Set<string>();
  const merged: Station[] = [];

  for (const station of batches.flat()) {
    if (seen.has(station.stationuuid)) continue;
    seen.add(station.stationuuid);
    merged.push(station);
  }

  return merged
    .sort((a, b) => b.votes - a.votes)
    .map((station) => ({
      ...station,
      cityId: classifyGuangdongCity(station.name) ?? PROVINCE_WIDE_ID,
    }));
}
