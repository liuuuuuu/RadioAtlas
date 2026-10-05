import type { Station } from "./radio-browser/types";

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
 * Prefers the redirect-resolved URL and flags streams the browser will refuse
 * to load from an HTTPS page.
 */
export function resolveStreamUrl(station: Station): string {
  return station.url_resolved || station.url;
}

export function isInsecureStream(station: Station): boolean {
  return resolveStreamUrl(station).startsWith("http://");
}
