import { describe, expect, it } from "vitest";
import {
  formatBitrate,
  formatCodec,
  formatCount,
  isInsecureStream,
  parseTags,
  resolveStreamUrl,
} from "./format";
import type { Station } from "./radio-browser/types";

function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    stationuuid: "00000000-0000-0000-0000-000000000000",
    name: "Test FM",
    url: "http://example.com/a.mp3",
    url_resolved: "https://example.com/a.mp3",
    homepage: "",
    favicon: "",
    tags: "",
    country: "",
    countrycode: "",
    state: "",
    language: "",
    languagecodes: "",
    votes: 0,
    codec: "",
    bitrate: 0,
    hls: 0,
    lastcheckok: 1,
    lastchecktime: "",
    clickcount: 0,
    clicktrend: 0,
    ssl_error: 0,
    geo_lat: null,
    geo_long: null,
    has_extended_info: false,
    ...overrides,
  };
}

describe("parseTags", () => {
  it("splits, trims and limits the tag string", () => {
    expect(parseTags("jazz, public radio , ,news", 2)).toEqual(["jazz", "public radio"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseTags("")).toEqual([]);
  });
});

describe("formatters", () => {
  it("renders unknown bitrate and codec as a dash", () => {
    expect(formatBitrate(0)).toBe("—");
    expect(formatCodec("UNKNOWN")).toBe("—");
    expect(formatCodec("")).toBe("—");
  });

  it("renders real values", () => {
    expect(formatBitrate(128)).toBe("128 kbps");
    expect(formatCodec("MP3")).toBe("MP3");
  });

  it("abbreviates large counts", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(60_228)).toBe("60.2K");
    expect(formatCount(1_500_000)).toBe("1.5M");
  });
});

describe("stream resolution", () => {
  it("prefers the redirect-resolved URL", () => {
    expect(resolveStreamUrl(makeStation())).toBe("https://example.com/a.mp3");
  });

  it("falls back to the original URL when unresolved", () => {
    expect(resolveStreamUrl(makeStation({ url_resolved: "" }))).toBe("http://example.com/a.mp3");
  });

  it("flags plain-HTTP streams that HTTPS pages cannot load", () => {
    expect(isInsecureStream(makeStation({ url_resolved: "http://x.test/a.mp3" }))).toBe(true);
    expect(isInsecureStream(makeStation())).toBe(false);
  });
});
