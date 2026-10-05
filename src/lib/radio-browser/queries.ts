import { radioFetch, stationQueryParams } from "./client";
import type {
  Country,
  Language,
  RadioStats,
  Station,
  StationSearchParams,
  Tag,
} from "./types";

/**
 * High-level read model over the Radio Browser directory.
 * Every function is safe to call from a server component or route handler.
 */

export const DEFAULT_STATION_LIMIT = 60;

export function searchStations(
  params: StationSearchParams = {},
  options?: { revalidate?: number },
): Promise<Station[]> {
  const merged: StationSearchParams = {
    order: "clickcount",
    reverse: true,
    hideBroken: true,
    limit: DEFAULT_STATION_LIMIT,
    ...params,
  };

  return radioFetch<Station[]>("/json/stations/search", stationQueryParams(merged), {
    revalidate: options?.revalidate ?? 300,
  });
}

export function getTopStations(limit = DEFAULT_STATION_LIMIT): Promise<Station[]> {
  return radioFetch<Station[]>(
    "/json/stations/topclick",
    { limit, hidebroken: true },
    { revalidate: 300 },
  );
}

export function getTrendingStations(limit = DEFAULT_STATION_LIMIT): Promise<Station[]> {
  return radioFetch<Station[]>(
    "/json/stations/search",
    stationQueryParams({ order: "clicktrend", reverse: true, hideBroken: true, limit }),
    { revalidate: 300 },
  );
}

export function getStationsByCountryCode(
  countrycode: string,
  limit = DEFAULT_STATION_LIMIT,
): Promise<Station[]> {
  return searchStations({ countrycode, limit });
}

export function getCountries(): Promise<Country[]> {
  return radioFetch<Country[]>("/json/countries", { hidebroken: true }, { revalidate: 3600 });
}

export function getTags(limit = 200): Promise<Tag[]> {
  return radioFetch<Tag[]>(
    "/json/tags",
    { hidebroken: true, order: "stationcount", reverse: true, limit },
    { revalidate: 3600 },
  );
}

export function getLanguages(limit = 100): Promise<Language[]> {
  return radioFetch<Language[]>(
    "/json/languages",
    { hidebroken: true, order: "stationcount", reverse: true, limit },
    { revalidate: 3600 },
  );
}

export function getStats(): Promise<RadioStats> {
  return radioFetch<RadioStats>("/json/stats", undefined, { revalidate: 60 });
}

/** Fire-and-forget play counter; failures must never affect playback. */
export async function registerClick(stationuuid: string): Promise<void> {
  try {
    await radioFetch<{ ok: boolean }>(`/json/url/${stationuuid}`, undefined, {
      revalidate: 0,
    });
  } catch {
    // Directory click tracking is best-effort only.
  }
}
