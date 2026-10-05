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

/**
 * Default ranking is `votes`, not `clickcount`.
 *
 * The directory's click counter is trivially inflated — at the time of writing
 * the global click ranking is dominated by a handful of Nigerian stations with
 * 40-470 votes but 4000-6000 clicks. Votes require a deliberate user action on
 * radio-browser.info and track real popularity far more closely.
 */
export const DEFAULT_STATION_ORDER = "votes" as const;

export function searchStations(
  params: StationSearchParams = {},
  options?: { revalidate?: number; timeoutMs?: number },
): Promise<Station[]> {
  const merged: StationSearchParams = {
    order: DEFAULT_STATION_ORDER,
    reverse: true,
    hideBroken: true,
    limit: DEFAULT_STATION_LIMIT,
    ...params,
  };

  return radioFetch<Station[]>("/json/stations/search", stationQueryParams(merged), {
    revalidate: options?.revalidate ?? 300,
    timeoutMs: options?.timeoutMs,
  });
}

/**
 * Highest community-voted stations.
 * Deliberately not `/json/stations/topclick`, whose ranking is click-farmed.
 */
export function getTopStations(limit = DEFAULT_STATION_LIMIT): Promise<Station[]> {
  return searchStations({ order: DEFAULT_STATION_ORDER, limit });
}

/** Recently rising by clicks — noisier than votes, but the only trend signal offered. */
export function getTrendingStations(limit = DEFAULT_STATION_LIMIT): Promise<Station[]> {
  return searchStations({ order: "clicktrend", limit });
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
