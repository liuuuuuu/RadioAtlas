import { describe, expect, it } from "vitest";
import {
  formatBitrate,
  formatCodec,
  formatCount,
  formatCountdown,
  isInsecureStream,
  isRelayed,
  parseTags,
  playbackUrl,
  resolveStreamUrl,
  STREAM_PROXY_ENABLED,
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

describe("formatCountdown", () => {
  it("renders mm:ss", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(1000)).toBe("0:01");
    expect(formatCountdown(59_000)).toBe("0:59");
    expect(formatCountdown(60_000)).toBe("1:00");
    expect(formatCountdown(90_000)).toBe("1:30");
    expect(formatCountdown(90 * 60_000)).toBe("90:00");
  });

  it("rounds partial seconds up so the timer never shows 0:00 while running", () => {
    expect(formatCountdown(400)).toBe("0:01");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toBe("0:00");
  });
});

describe("stream resolution", () => {
  it("prefers the redirect-resolved URL", () => {
    expect(resolveStreamUrl(makeStation())).toBe("https://example.com/a.mp3");
  });

  it("falls back to the original URL when unresolved", () => {
    expect(resolveStreamUrl(makeStation({ url_resolved: "" }))).toBe("http://example.com/a.mp3");
  });

  it("sends HTTPS streams straight to the audio element", () => {
    const station = makeStation();
    expect(playbackUrl(station)).toBe("https://example.com/a.mp3");
    expect(isRelayed(station)).toBe(false);
  });

  it("relays plain-HTTP streams through /api/stream", () => {
    const station = makeStation({ url_resolved: "http://x.test/a.mp3" });
    expect(playbackUrl(station)).toBe(
      "/api/stream?uuid=00000000-0000-0000-0000-000000000000",
    );
    expect(isRelayed(station)).toBe(true);
  });

  it("only reports an insecure stream when the relay is disabled", () => {
    // The relay is on by default, so HTTP streams are playable and not flagged.
    expect(STREAM_PROXY_ENABLED).toBe(true);
    expect(isInsecureStream(makeStation({ url_resolved: "http://x.test/a.mp3" }))).toBe(false);
    expect(isInsecureStream(makeStation())).toBe(false);
  });
});
