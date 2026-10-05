import type { PlayableStation } from "./radio-browser/types";

/** Split the directory's comma-separated tag string into a clean list. */
export function parseTags(tags: string, limit = 3): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function formatBitrate(bitrate: number): string {
  return bitrate > 0 ? `${bitrate} kbps` : "—";
}

export function formatCodec(codec: string): string {
  return codec && codec !== "UNKNOWN" ? codec : "—";
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/**
 * Normalise a station into something a plain <audio> element can attempt.
 * Prefers the redirect-resolved URL.
 */
export function resolveStreamUrl(station: PlayableStation): string {
  return station.url_resolved || station.url;
}

/** The relay is on unless explicitly disabled at build time. */
export const STREAM_PROXY_ENABLED = process.env.NEXT_PUBLIC_STREAM_PROXY !== "0";

/**
 * The URL to actually hand to `<audio>` / hls.js.
 *
 * 71% of the directory's most-voted stations only publish `http://` streams,
 * which an HTTPS page refuses to load (mixed content). Those are relayed
 * through /api/stream; HTTPS streams connect directly.
 */
export function playbackUrl(station: PlayableStation): string {
  const direct = resolveStreamUrl(station);
  if (!STREAM_PROXY_ENABLED || !direct.startsWith("http://")) return direct;
  return `/api/stream?uuid=${encodeURIComponent(station.stationuuid)}`;
}

/** True when this stream only works because it is being relayed. */
export function isRelayed(station: PlayableStation): boolean {
  return STREAM_PROXY_ENABLED && resolveStreamUrl(station).startsWith("http://");
}

/** True when the stream is plain HTTP and the relay is off — it will not play. */
export function isInsecureStream(station: PlayableStation): boolean {
  return !STREAM_PROXY_ENABLED && resolveStreamUrl(station).startsWith("http://");
}
