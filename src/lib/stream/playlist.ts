/**
 * HLS playlist rewriting for the stream proxy.
 *
 * An m3u8 is not audio — it is a manifest pointing at more URLs (child
 * playlists, segments, encryption keys, init segments). Proxying only the
 * manifest would leave those child requests pointing at plain HTTP, which the
 * browser blocks anyway. So every URL inside the playlist is rewritten to route
 * back through /api/stream.
 */

/** Tag attributes that carry a URI, e.g. EXT-X-KEY and EXT-X-MAP. */
const URI_ATTRIBUTE = /URI="([^"]+)"/g;

export interface PlaylistRewriteOptions {
  /** Absolute URL the playlist was fetched from, used to resolve relative refs. */
  baseUrl: string;
  stationuuid: string;
  /** Path the proxy is mounted at. */
  proxyPath?: string;
}

/** Build the proxied form of a resource URL. */
export function proxyUrlFor(
  resource: string,
  { baseUrl, stationuuid, proxyPath = "/api/stream" }: PlaylistRewriteOptions,
): string {
  let absolute: string;
  try {
    absolute = new URL(resource, baseUrl).toString();
  } catch {
    return resource;
  }

  const params = new URLSearchParams({ uuid: stationuuid, u: absolute });
  return `${proxyPath}?${params.toString()}`;
}

/**
 * Rewrite every URL in an m3u8 so it flows through the proxy.
 *
 * Handles both media playlists (bare URL lines) and master playlists
 * (#EXT-X-STREAM-INF followed by a bare URL line), plus URI="..." attributes on
 * tags such as #EXT-X-KEY, #EXT-X-MAP and #EXT-X-MEDIA.
 */
export function rewritePlaylist(playlist: string, options: PlaylistRewriteOptions): string {
  return playlist
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return trimmed.replace(
          URI_ATTRIBUTE,
          (_match, uri: string) => `URI="${proxyUrlFor(uri, options)}"`,
        );
      }

      return proxyUrlFor(trimmed, options);
    })
    .join("\n");
}

/** True when the response looks like an HLS manifest rather than audio. */
export function isHlsPlaylist(url: string, contentType: string): boolean {
  if (/\.m3u8(\?|#|$)/i.test(url)) return true;

  const type = contentType.toLowerCase();
  return (
    type.includes("mpegurl") ||
    type.includes("x-mpegurl") ||
    type.includes("vnd.apple.mpegurl")
  );
}
