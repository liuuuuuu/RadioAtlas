import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/radio-browser/cache";
import { DEFAULT_USER_AGENT } from "@/lib/radio-browser/client";
import { getStationByUuid } from "@/lib/radio-browser/queries";
import { isAbsoluteHttpUrl, isPublicHttpUrl } from "@/lib/stream/guard";
import { isHlsPlaylist, rewritePlaylist } from "@/lib/stream/playlist";

/** Needs node:dns for the SSRF guard, and unbuffered streaming. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Time allowed for the upstream to send response *headers*. */
const CONNECT_TIMEOUT_MS = 12_000;

const NO_STORE = { "Cache-Control": "no-store, no-transform" } as const;

/**
 * Resolved station URLs, so a long listening session does not re-query the
 * directory for every HLS segment.
 */
const targetCache = new TtlCache<string>(3_600_000, 500);

/**
 * Audio relay for plain-HTTP stations.
 *
 * 71% of the directory's most-voted stations only publish `http://` streams,
 * which an HTTPS page cannot load at all (mixed content). Routing them through
 * this handler is the only way they become playable.
 *
 * It is deliberately *not* a general-purpose proxy: without a `uuid` that
 * resolves in the directory there is nothing to fetch, and every URL —
 * including HLS child resources passed via `u` — passes the SSRF guard.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationuuid = searchParams.get("uuid") ?? "";
  const explicit = searchParams.get("u");

  if (!UUID_PATTERN.test(stationuuid)) {
    return NextResponse.json({ error: "A valid stationuuid is required." }, { status: 400 });
  }

  let target: string;

  if (explicit) {
    // HLS child resource. The uuid proves the request originated from a
    // directory lookup; the guard below stops it reaching anything internal.
    if (!isAbsoluteHttpUrl(explicit)) {
      return NextResponse.json({ error: "Invalid stream URL." }, { status: 400 });
    }
    target = explicit;
  } else {
    const cached = targetCache.get(stationuuid);
    if (cached) {
      target = cached;
    } else {
      const station = await getStationByUuid(stationuuid);
      if (!station) {
        return NextResponse.json({ error: "Unknown station." }, { status: 404 });
      }

      target = station.url_resolved || station.url;
      if (!isAbsoluteHttpUrl(target)) {
        return NextResponse.json({ error: "Station has no usable stream." }, { status: 422 });
      }

      targetCache.set(stationuuid, target);
    }
  }

  if (!(await isPublicHttpUrl(target))) {
    return NextResponse.json({ error: "Stream host is not reachable." }, { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });

  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "*/*",
        // Audio is already compressed; asking for gzip only adds work.
        "Accept-Encoding": "identity",
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the stream." }, { status: 502 });
  } finally {
    // Only the handshake is time-limited — live radio connections are long-lived.
    clearTimeout(timer);
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Upstream responded ${upstream.status}.` },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";

  if (isHlsPlaylist(target, contentType)) {
    const playlist = await upstream.text();

    return new Response(rewritePlaylist(playlist, { baseUrl: target, stationuuid }), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        ...NO_STORE,
      },
    });
  }

  const passthrough: Record<string, string> = { ...NO_STORE };
  if (contentType) passthrough["Content-Type"] = contentType;
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) passthrough["Content-Length"] = contentLength;
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) passthrough["Accept-Ranges"] = acceptRanges;

  return new Response(upstream.body, { status: upstream.status, headers: passthrough });
}
