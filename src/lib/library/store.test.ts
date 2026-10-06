import { describe, expect, it } from "vitest";
import {
  clearRecents,
  EMPTY_LIBRARY,
  FAVORITES_LIMIT,
  isFavorite,
  parseLibrary,
  pushRecent,
  RECENTS_LIMIT,
  removeFavorite,
  serializeLibrary,
  toSavedStation,
  toggleFavorite,
} from "./store";
import type { PlayableStation } from "@/lib/radio-browser/types";

function station(uuid: string, name = uuid): PlayableStation {
  return {
    stationuuid: uuid,
    name,
    url: `http://example.com/${uuid}`,
    url_resolved: `https://example.com/${uuid}`,
    country: "中国",
    countrycode: "CN",
    codec: "MP3",
    bitrate: 128,
    hls: 0,
    tags: "news",
  };
}

describe("toggleFavorite", () => {
  it("adds a station that is not saved yet", () => {
    const next = toggleFavorite(EMPTY_LIBRARY, station("a"), 100);

    expect(next.favorites).toHaveLength(1);
    expect(next.favorites[0]?.stationuuid).toBe("a");
    expect(next.favorites[0]?.savedAt).toBe(100);
  });

  it("removes a station that is already saved", () => {
    const once = toggleFavorite(EMPTY_LIBRARY, station("a"), 100);
    const twice = toggleFavorite(once, station("a"), 200);

    expect(twice.favorites).toHaveLength(0);
  });

  it("puts the newest favourite first", () => {
    let state = toggleFavorite(EMPTY_LIBRARY, station("a"), 100);
    state = toggleFavorite(state, station("b"), 200);

    expect(state.favorites.map((entry) => entry.stationuuid)).toEqual(["b", "a"]);
  });

  it("does not mutate the input state", () => {
    const before = toggleFavorite(EMPTY_LIBRARY, station("a"), 100);
    const copy = structuredClone(before);
    toggleFavorite(before, station("b"), 200);

    expect(before).toEqual(copy);
  });

  it("caps the list at FAVORITES_LIMIT", () => {
    let state = EMPTY_LIBRARY;
    for (let index = 0; index < FAVORITES_LIMIT + 20; index += 1) {
      state = toggleFavorite(state, station(`s${index}`), index);
    }

    expect(state.favorites).toHaveLength(FAVORITES_LIMIT);
    // The newest survive.
    expect(state.favorites[0]?.stationuuid).toBe(`s${FAVORITES_LIMIT + 19}`);
  });

  it("keeps recents untouched", () => {
    const withRecent = pushRecent(EMPTY_LIBRARY, station("r"), 1);
    const next = toggleFavorite(withRecent, station("a"), 2);

    expect(next.recents).toHaveLength(1);
  });
});

describe("isFavorite / removeFavorite", () => {
  it("reports membership", () => {
    const state = toggleFavorite(EMPTY_LIBRARY, station("a"), 1);

    expect(isFavorite(state, "a")).toBe(true);
    expect(isFavorite(state, "b")).toBe(false);
  });

  it("removes by uuid and is a no-op for unknown ids", () => {
    const state = toggleFavorite(EMPTY_LIBRARY, station("a"), 1);

    expect(removeFavorite(state, "a").favorites).toHaveLength(0);
    expect(removeFavorite(state, "zzz").favorites).toHaveLength(1);
  });
});

describe("pushRecent", () => {
  it("prepends and de-duplicates", () => {
    let state = pushRecent(EMPTY_LIBRARY, station("a"), 1);
    state = pushRecent(state, station("b"), 2);
    state = pushRecent(state, station("a"), 3);

    expect(state.recents.map((entry) => entry.stationuuid)).toEqual(["a", "b"]);
    expect(state.recents[0]?.savedAt).toBe(3);
  });

  it("caps the list at RECENTS_LIMIT", () => {
    let state = EMPTY_LIBRARY;
    for (let index = 0; index < RECENTS_LIMIT + 10; index += 1) {
      state = pushRecent(state, station(`r${index}`), index);
    }

    expect(state.recents).toHaveLength(RECENTS_LIMIT);
    expect(state.recents[0]?.stationuuid).toBe(`r${RECENTS_LIMIT + 9}`);
  });

  it("clears", () => {
    const state = pushRecent(EMPTY_LIBRARY, station("a"), 1);
    expect(clearRecents(state).recents).toHaveLength(0);
  });
});

describe("toSavedStation", () => {
  it("keeps only the fields playback needs", () => {
    const result = toSavedStation(station("a", "My Station"), 42);

    expect(result).toEqual({
      stationuuid: "a",
      name: "My Station",
      url: "http://example.com/a",
      url_resolved: "https://example.com/a",
      country: "中国",
      countrycode: "CN",
      codec: "MP3",
      bitrate: 128,
      hls: 0,
      tags: "news",
      favicon: undefined,
      savedAt: 42,
    });
  });
});

describe("parseLibrary", () => {
  it("round-trips a serialized library", () => {
    let state = toggleFavorite(EMPTY_LIBRARY, station("a"), 10);
    state = pushRecent(state, station("b"), 20);

    expect(parseLibrary(serializeLibrary(state))).toEqual(state);
  });

  it.each([null, undefined, "", "not json", "[]", "null", '"a string"', "42"])(
    "falls back to empty for %s",
    (raw) => {
      expect(parseLibrary(raw as string | null)).toEqual(EMPTY_LIBRARY);
    },
  );

  it("drops entries that are missing required fields", () => {
    const raw = JSON.stringify({
      favorites: [
        { stationuuid: "ok", name: "Good", url: "http://x", savedAt: 1 },
        { stationuuid: "no-url", name: "Bad", savedAt: 1 },
        { name: "no uuid", url: "http://x", savedAt: 1 },
        { stationuuid: "nan", name: "Bad", url: "http://x", savedAt: "yesterday" },
        null,
        "string",
      ],
    });

    const parsed = parseLibrary(raw);
    expect(parsed.favorites.map((entry) => entry.stationuuid)).toEqual(["ok"]);
  });

  it("de-duplicates repeated uuids, keeping the first", () => {
    const raw = JSON.stringify({
      favorites: [
        { stationuuid: "a", name: "First", url: "http://x", savedAt: 2 },
        { stationuuid: "a", name: "Second", url: "http://y", savedAt: 1 },
      ],
    });

    expect(parseLibrary(raw).favorites).toHaveLength(1);
    expect(parseLibrary(raw).favorites[0]?.name).toBe("First");
  });

  it("backfills fields a stored entry is missing", () => {
    const raw = JSON.stringify({
      recents: [{ stationuuid: "a", name: "Old", url: "http://x", savedAt: 5 }],
    });

    const entry = parseLibrary(raw).recents[0];
    expect(entry).toBeDefined();
    expect(entry?.url_resolved).toBe("");
    expect(entry?.codec).toBe("UNKNOWN");
    expect(entry?.bitrate).toBe(0);
    expect(entry?.hls).toBe(0);
    expect(entry?.tags).toBe("");
  });

  it("truncates over-long lists", () => {
    const many = Array.from({ length: RECENTS_LIMIT + 25 }, (_, index) => ({
      stationuuid: `r${index}`,
      name: `n${index}`,
      url: "http://x",
      savedAt: index,
    }));

    expect(parseLibrary(JSON.stringify({ recents: many })).recents).toHaveLength(RECENTS_LIMIT);
  });

  it("ignores a non-array list", () => {
    expect(parseLibrary(JSON.stringify({ favorites: "nope", recents: {} }))).toEqual(EMPTY_LIBRARY);
  });
});
