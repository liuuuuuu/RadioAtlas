import type { PlayableStation } from "@/lib/radio-browser/types";

/**
 * Pure state logic for the local station library (favourites + recently played).
 *
 * Kept free of any DOM access so it can be unit-tested directly; the browser
 * plumbing lives in ./client.ts. localStorage is user-writable and survives
 * version changes, so `parseLibrary` treats its input as untrusted.
 */

export interface SavedStation extends PlayableStation {
  /** Epoch ms, used to order both lists. */
  savedAt: number;
}

export interface LibraryState {
  favorites: SavedStation[];
  recents: SavedStation[];
}

export const FAVORITES_LIMIT = 500;
export const RECENTS_LIMIT = 30;

export const EMPTY_LIBRARY: LibraryState = { favorites: [], recents: [] };

/** Trim a full station down to what playback actually needs, to keep storage small. */
export function toSavedStation(station: PlayableStation, now: number): SavedStation {
  return {
    stationuuid: station.stationuuid,
    name: station.name,
    url: station.url,
    url_resolved: station.url_resolved,
    country: station.country,
    countrycode: station.countrycode,
    codec: station.codec,
    bitrate: station.bitrate,
    hls: station.hls,
    tags: station.tags,
    favicon: station.favicon,
    savedAt: now,
  };
}

export function isFavorite(state: LibraryState, stationuuid: string): boolean {
  return state.favorites.some((entry) => entry.stationuuid === stationuuid);
}

/** Adds the station, or removes it if already saved. */
export function toggleFavorite(
  state: LibraryState,
  station: PlayableStation,
  now: number,
): LibraryState {
  const existing = state.favorites.find((entry) => entry.stationuuid === station.stationuuid);

  if (existing) {
    return {
      ...state,
      favorites: state.favorites.filter((entry) => entry.stationuuid !== station.stationuuid),
    };
  }

  // Newest first; keep the original savedAt when a station is re-saved.
  const next = [toSavedStation(station, now), ...state.favorites];
  return { ...state, favorites: next.slice(0, FAVORITES_LIMIT) };
}

export function removeFavorite(state: LibraryState, stationuuid: string): LibraryState {
  return {
    ...state,
    favorites: state.favorites.filter((entry) => entry.stationuuid !== stationuuid),
  };
}

/** Moves the station to the front of the recent list, de-duplicating. */
export function pushRecent(
  state: LibraryState,
  station: PlayableStation,
  now: number,
): LibraryState {
  const without = state.recents.filter((entry) => entry.stationuuid !== station.stationuuid);
  return {
    ...state,
    recents: [toSavedStation(station, now), ...without].slice(0, RECENTS_LIMIT),
  };
}

export function clearRecents(state: LibraryState): LibraryState {
  return { ...state, recents: [] };
}

function isValidEntry(value: unknown): value is SavedStation {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;

  return (
    typeof entry.stationuuid === "string" &&
    entry.stationuuid.length > 0 &&
    typeof entry.name === "string" &&
    typeof entry.url === "string" &&
    typeof entry.savedAt === "number" &&
    Number.isFinite(entry.savedAt)
  );
}

/** Fill in anything a stored entry is missing, so old versions stay readable. */
function normalizeEntry(entry: SavedStation): SavedStation {
  return {
    stationuuid: entry.stationuuid,
    name: entry.name,
    url: entry.url,
    url_resolved: typeof entry.url_resolved === "string" ? entry.url_resolved : "",
    country: typeof entry.country === "string" ? entry.country : "",
    countrycode: typeof entry.countrycode === "string" ? entry.countrycode : "",
    codec: typeof entry.codec === "string" ? entry.codec : "UNKNOWN",
    bitrate: typeof entry.bitrate === "number" ? entry.bitrate : 0,
    hls: entry.hls === 1 ? 1 : 0,
    tags: typeof entry.tags === "string" ? entry.tags : "",
    favicon: typeof entry.favicon === "string" ? entry.favicon : undefined,
    savedAt: entry.savedAt,
  };
}

function parseList(raw: unknown, limit: number): SavedStation[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: SavedStation[] = [];

  for (const value of raw) {
    if (!isValidEntry(value)) continue;
    if (seen.has(value.stationuuid)) continue;

    seen.add(value.stationuuid);
    result.push(normalizeEntry(value));
    if (result.length >= limit) break;
  }

  return result;
}

/**
 * Never throws: a corrupted or hand-edited value yields an empty library rather
 * than breaking the page.
 */
export function parseLibrary(raw: string | null | undefined): LibraryState {
  if (!raw) return EMPTY_LIBRARY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_LIBRARY;
  }

  if (typeof parsed !== "object" || parsed === null) return EMPTY_LIBRARY;
  const source = parsed as Record<string, unknown>;

  return {
    favorites: parseList(source.favorites, FAVORITES_LIMIT),
    recents: parseList(source.recents, RECENTS_LIMIT),
  };
}

export function serializeLibrary(state: LibraryState): string {
  return JSON.stringify({ version: 1, ...state });
}
