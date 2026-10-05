import { describe, expect, it } from "vitest";
import { isHlsUrl } from "./hls-loader";

describe("isHlsUrl", () => {
  it.each([
    "http://playtv-live.ifeng.com/live/06OLEEWQKN4_audio.m3u8",
    "https://piccpndali.v.myalicdn.com/audio/cctv13_2.m3u8",
    "https://example.com/live.m3u8?token=abc",
    "https://example.com/live.M3U8",
  ])("detects %s as HLS", (url) => {
    expect(isHlsUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com/stream.mp3",
    "https://example.com/stream.aac",
    "https://example.com/playlist.m3u",
    "https://example.com/ogg",
  ])("rejects %s", (url) => {
    expect(isHlsUrl(url)).toBe(false);
  });
});
