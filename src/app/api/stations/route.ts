import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/radio-browser/cache";
import { searchStations } from "@/lib/radio-browser/queries";
import { STATION_ORDERS, type Station, type StationOrder } from "@/lib/radio-browser/types";

export const revalidate = 300;

/** Process-local cache; the directory budget is ~2-3 req/s, so hot queries must not re-hit it. */
const stationCache = new TtlCache<Station[]>(300_000, 200);

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseOrder(raw: string | null): StationOrder {
  return STATION_ORDERS.includes(raw as StationOrder) ? (raw as StationOrder) : "votes";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params = {
    name: searchParams.get("q") ?? undefined,
    countrycode: searchParams.get("country") ?? undefined,
    language: searchParams.get("language") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    codec: searchParams.get("codec") ?? undefined,
    bitrateMin: searchParams.has("bitrateMin")
      ? clampInt(searchParams.get("bitrateMin"), 0, 0, 1000)
      : undefined,
    isHttps: searchParams.get("https") === "1" ? true : undefined,
    order: parseOrder(searchParams.get("order")),
    reverse: searchParams.get("reverse") !== "0",
    limit: clampInt(searchParams.get("limit"), 60, 1, 200),
    offset: clampInt(searchParams.get("offset"), 0, 0, 100_000),
  };

  const cacheKey = JSON.stringify(params);
  const cached = stationCache.get(cacheKey);

  if (cached) {
    return NextResponse.json(
      { stations: cached, total: cached.length, cached: true },
      { headers: CACHE_HEADERS },
    );
  }

  try {
    const stations = await searchStations(params);
    stationCache.set(cacheKey, stations);

    return NextResponse.json(
      { stations, total: stations.length, cached: false },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "The radio directory is unreachable right now.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
