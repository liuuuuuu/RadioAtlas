import { NextResponse } from "next/server";
import { getTags } from "@/lib/radio-browser/queries";
import { TtlCache } from "@/lib/radio-browser/cache";
import type { Tag } from "@/lib/radio-browser/types";

export const revalidate = 3600;

const cache = new TtlCache<Tag[]>(3_600_000, 4);

export async function GET() {
  const cached = cache.get("tags");
  if (cached) {
    return NextResponse.json({ tags: cached }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  }

  try {
    const tags = await getTags(120);
    cache.set("tags", tags);

    return NextResponse.json({ tags }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not load the genre list.", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
