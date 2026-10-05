import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/radio-browser/cache";
import { searchStations } from "@/lib/radio-browser/queries";
import { projectToViewBox } from "@/lib/geo/projection";
import type { StationMarker } from "@/lib/geo/types";

export const revalidate = 3600;

/**
 * Radio Browser answers `has_geo_info` queries with a full scan, so latency
 * scales with the requested row count: ~3s for 120 rows, ~8s for 150, >60s for
 * 1500. Two tiers keep it usable — a sparse global layer and a denser
 * per-country layer, both cached for an hour.
 */
const GLOBAL_LIMIT = 120;
const COUNTRY_LIMIT = 200;
const UPSTREAM_TIMEOUT_MS = 20_000;

const markerCache = new TtlCache<StationMarker[]>(3_600_000, 64);

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86_400",
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const countryParam = searchParams.get("country");
  const country =
    countryParam && /^[a-z]{2}$/i.test(countryParam) ? countryParam.toUpperCase() : undefined;

  const limit = clampInt(
    searchParams.get("limit"),
    country ? COUNTRY_LIMIT : GLOBAL_LIMIT,
    20,
    300,
  );

  const cacheKey = `${country ?? "GLOBAL"}:${limit}`;

  try {
    let markers = markerCache.get(cacheKey);

    if (!markers) {
      const stations = await searchStations(
        {
          hasGeoInfo: true,
          hideBroken: true,
          countrycode: country,
          order: "votes",
          reverse: true,
          limit,
        },
        { revalidate: 3600, timeoutMs: UPSTREAM_TIMEOUT_MS },
      );

      markers = stations.flatMap((station) => {
        if (typeof station.geo_lat !== "number" || typeof station.geo_long !== "number") {
          return [];
        }

        const [x, y] = projectToViewBox(station.geo_long, station.geo_lat);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];

        return [
          {
            uuid: station.stationuuid,
            name: station.name,
            country: station.country,
            countrycode: station.countrycode,
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            stream: station.url_resolved || station.url,
            hls: station.hls,
            codec: station.codec,
            bitrate: station.bitrate,
            tags: station.tags,
          } satisfies StationMarker,
        ];
      });

      markerCache.set(cacheKey, markers);
    }

    return NextResponse.json(
      { markers, scope: country ?? "global" },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load geolocated stations.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
