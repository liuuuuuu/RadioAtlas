import { NextResponse } from "next/server";
import { getCountries } from "@/lib/radio-browser/queries";
import { TtlCache } from "@/lib/radio-browser/cache";
import type { Country } from "@/lib/radio-browser/types";

export const revalidate = 3600;

const cache = new TtlCache<Country[]>(3_600_000, 4);

export async function GET() {
  const cached = cache.get("countries");
  if (cached) {
    return NextResponse.json({ countries: cached }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  }

  try {
    const countries = (await getCountries())
      .filter((country) => country.stationcount > 0)
      .sort((a, b) => b.stationcount - a.stationcount);

    cache.set("countries", countries);

    return NextResponse.json({ countries }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not load the country list.", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
