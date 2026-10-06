import { useMemo, useSyncExternalStore } from "react";
import type { PlayableStation } from "@/lib/radio-browser/types";
import {
  clearRecents as clearRecentsState,
  EMPTY_LIBRARY,
  isFavorite as isFavoriteState,
  parseLibrary,
  pushRecent as pushRecentState,
  removeFavorite as removeFavoriteState,
  serializeLibrary,
  toggleFavorite as toggleFavoriteState,
  type LibraryState,
} from "./store";

/**
 * localStorage-backed store for favourites and recently played stations.
 *
 * Exposed through `useSyncExternalStore` rather than "read in an effect and
 * setState", which avoids a hydration mismatch (the server renders the empty
 * library, then React swaps in the real snapshot) and gets cross-tab sync for
 * free via the `storage` event.
 */

const STORAGE_KEY = "radioatlas.library.v1";

let snapshot: LibraryState = EMPTY_LIBRARY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  try {
    snapshot = parseLibrary(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    snapshot = EMPTY_LIBRARY;
  }
}

function persist(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, serializeLibrary(snapshot));
  } catch {
    // Quota exceeded or storage blocked — the in-memory copy still works.
  }
}

function setState(next: LibraryState): void {
  snapshot = next;
  persist();
  emit();
}

let storageBound = false;

function ensureStorageListener(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = parseLibrary(event.newValue);
    hydrated = true;
    emit();
  });
}

function subscribe(listener: () => void): () => void {
  hydrate();
  ensureStorageListener();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LibraryState {
  hydrate();
  return snapshot;
}

/** The server has no storage, so the first client render must match this. */
function getServerSnapshot(): LibraryState {
  return EMPTY_LIBRARY;
}

/** Called by the player when a station starts; safe outside React. */
export function recordRecent(station: PlayableStation): void {
  hydrate();
  setState(pushRecentState(snapshot, station, Date.now()));
}

export interface LibraryApi {
  favorites: LibraryState["favorites"];
  recents: LibraryState["recents"];
  isFavorite: (stationuuid: string) => boolean;
  toggleFavorite: (station: PlayableStation) => void;
  removeFavorite: (stationuuid: string) => void;
  clearRecents: () => void;
}

export function useLibrary(): LibraryApi {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      favorites: state.favorites,
      recents: state.recents,
      isFavorite: (stationuuid: string) => isFavoriteState(state, stationuuid),
      // Mutations read the module snapshot so they are never stale, even when a
      // handler was created several renders ago.
      toggleFavorite: (station) => setState(toggleFavoriteState(snapshot, station, Date.now())),
      removeFavorite: (stationuuid) => setState(removeFavoriteState(snapshot, stationuuid)),
      clearRecents: () => setState(clearRecentsState(snapshot)),
    }),
    [state],
  );
}
