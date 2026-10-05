import { describe, expect, it } from "vitest";
import { isHlsPlaylist, proxyUrlFor, rewritePlaylist } from "./playlist";

const BASE = "http://stream.example.com/live/index.m3u8";
const OPTIONS = { baseUrl: BASE, stationuuid: "abc-123" };

describe("proxyUrlFor", () => {
  it("routes an absolute URL through the proxy", () => {
    const result = proxyUrlFor("http://cdn.example.com/seg1.ts", OPTIONS);
    expect(result.startsWith("/api/stream?")).toBe(true);

    const params = new URLSearchParams(result.split("?")[1]);
    expect(params.get("uuid")).toBe("abc-123");
    expect(params.get("u")).toBe("http://cdn.example.com/seg1.ts");
  });

  it("resolves relative references against the playlist URL", () => {
    const params = new URLSearchParams(proxyUrlFor("seg2.ts", OPTIONS).split("?")[1]);
    expect(params.get("u")).toBe("http://stream.example.com/live/seg2.ts");

    const rooted = new URLSearchParams(proxyUrlFor("/other/seg3.ts", OPTIONS).split("?")[1]);
    expect(rooted.get("u")).toBe("http://stream.example.com/other/seg3.ts");
  });

  it("leaves unparseable input alone", () => {
    expect(proxyUrlFor("http://[", OPTIONS)).toBe("http://[");
  });
});

describe("rewritePlaylist", () => {
  it("rewrites bare segment URLs in a media playlist", () => {
    const playlist = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXTINF:10.0,",
      "seg1.ts",
      "#EXTINF:10.0,",
      "http://cdn.example.com/seg2.ts",
      "",
    ].join("\n");

    const rewritten = rewritePlaylist(playlist, OPTIONS);
    const lines = rewritten.split("\n");

    expect(lines[0]).toBe("#EXTM3U");
    expect(lines[1]).toBe("#EXT-X-VERSION:3");
    expect(lines[3]).toMatch(/^\/api\/stream\?/);
    expect(lines[5]).toMatch(/^\/api\/stream\?/);

    const first = new URLSearchParams(lines[3]?.split("?")[1]);
    expect(first.get("u")).toBe("http://stream.example.com/live/seg1.ts");
  });

  it("rewrites child playlist URLs in a master playlist", () => {
    const playlist = [
      "#EXTM3U",
      '#EXT-X-STREAM-INF:BANDWIDTH=128000,RESOLUTION=640x360',
      "low/index.m3u8",
      '#EXT-X-STREAM-INF:BANDWIDTH=256000,RESOLUTION=1280x720',
      "high/index.m3u8",
    ].join("\n");

    const rewritten = rewritePlaylist(playlist, OPTIONS);
    const urls = rewritten.split("\n").filter((line) => line.startsWith("/api/stream?"));

    expect(urls).toHaveLength(2);
    const first = new URLSearchParams(urls[0]?.split("?")[1]);
    expect(first.get("u")).toBe("http://stream.example.com/live/low/index.m3u8");
  });

  it("rewrites URI attributes on tags (keys and init segments)", () => {
    const playlist = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="https://keys.example.com/k1"',
      '#EXT-X-MAP:URI="init.mp4"',
      "#EXTINF:6.0,",
      "seg.ts",
    ].join("\n");

    const rewritten = rewritePlaylist(playlist, OPTIONS);
    const lines = rewritten.split("\n");

    expect(lines[1]).toMatch(/^#EXT-X-KEY:METHOD=AES-128,URI="\/api\/stream\?/);
    expect(lines[2]).toMatch(/^#EXT-X-MAP:URI="\/api\/stream\?/);

    const key = new URLSearchParams(lines[1]?.match(/URI="([^"]+)"/)?.[1]?.split("?")[1] ?? "");
    expect(key.get("u")).toBe("https://keys.example.com/k1");

    const map = new URLSearchParams(lines[2]?.match(/URI="([^"]+)"/)?.[1]?.split("?")[1] ?? "");
    expect(map.get("u")).toBe("http://stream.example.com/live/init.mp4");
  });

  it("keeps comment lines and blank lines intact", () => {
    const playlist = "#EXTM3U\n\n#EXT-X-DISCONTINUITY\nseg.ts\n";
    const lines = rewritePlaylist(playlist, OPTIONS).split("\n");

    expect(lines[0]).toBe("#EXTM3U");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("#EXT-X-DISCONTINUITY");
    expect(lines[3]).toMatch(/^\/api\/stream\?/);
  });

  it("never leaves a bare upstream URL behind", () => {
    const playlist = "#EXTM3U\nseg1.ts\nhttp://cdn.example.com/seg2.ts\n";
    const rewritten = rewritePlaylist(playlist, OPTIONS);

    for (const line of rewritten.split("\n")) {
      if (line && !line.startsWith("#")) {
        expect(line.startsWith("/api/stream?")).toBe(true);
      }
    }
  });
});

describe("isHlsPlaylist", () => {
  it("detects by extension, ignoring query strings and case", () => {
    expect(isHlsPlaylist("http://a.example/live.m3u8", "")).toBe(true);
    expect(isHlsPlaylist("http://a.example/live.M3U8?token=1", "")).toBe(true);
  });

  it("detects by content type", () => {
    expect(isHlsPlaylist("http://a.example/live", "application/vnd.apple.mpegurl")).toBe(true);
    expect(isHlsPlaylist("http://a.example/live", "application/x-mpegURL")).toBe(true);
  });

  it("rejects plain audio", () => {
    expect(isHlsPlaylist("http://a.example/stream.mp3", "audio/mpeg")).toBe(false);
    expect(isHlsPlaylist("http://a.example/stream", "audio/aac")).toBe(false);
  });
});
