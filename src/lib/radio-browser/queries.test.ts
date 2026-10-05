import { afterEach, describe, expect, it, vi } from "vitest";
import { searchStations } from "./queries";

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("searchStations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies ranking defaults and targets the search endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await searchStations({ countrycode: "CN" });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/json/stations/search");
    expect(parsed.searchParams.get("countrycode")).toBe("CN");
    expect(parsed.searchParams.get("order")).toBe("clickcount");
    expect(parsed.searchParams.get("reverse")).toBe("true");
    expect(parsed.searchParams.get("limit")).toBe("60");
    expect(parsed.searchParams.get("hidebroken")).toBe("true");
  });

  it("lets callers override the defaults", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await searchStations({ order: "random", limit: 5, hideBroken: false, tag: "jazz" });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    const parsed = new URL(url);

    expect(parsed.searchParams.get("order")).toBe("random");
    expect(parsed.searchParams.get("limit")).toBe("5");
    expect(parsed.searchParams.get("hidebroken")).toBe("false");
    expect(parsed.searchParams.get("tag")).toBe("jazz");
  });
});
