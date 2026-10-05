import { NextResponse } from "next/server";
import { registerClick } from "@/lib/radio-browser/queries";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reports a play to the directory so station rankings stay meaningful.
 * Best-effort: always answers 204 and never blocks the UI.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const uuid = searchParams.get("uuid") ?? "";

  if (UUID_PATTERN.test(uuid)) {
    await registerClick(uuid);
  }

  return new NextResponse(null, { status: 204 });
}
