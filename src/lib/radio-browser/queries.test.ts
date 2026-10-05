import { afterEach, describe, expect, it, vi } from "vitest";
import { getTopStations, searchStations } from "./queries";

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function firstUrl(fetchMock: unknown): URL {
  const [url] = (fetchMock as { mock: { calls: unknown[][] } }).mock.calls[0] as [string];
  return new URL(url);
}

describe("searchStations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies ranking defaults and targets the search endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await searchStations({ countrycode: "CN" });

    const parsed = firstUrl(fetchMock);
    expect(parsed.pathname).toBe("/json/stations/search");
    expect(parsed.searchParams.get("countrycode")).toBe("CN");
    expect(parsed.searchParams.get("reverse")).toBe("true");
    expect(parsed.searchParams.get("limit")).toBe("60");
    expect(parsed.searchParams.get("hidebroken")).toBe("true");
  });

  it("ranks by votes by default, not the click-farmed click counter", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await searchStations({});

    expect(firstUrl(fetchMock).searchParams.get("order")).toBe("votes");
  });

  it("lets callers override the defaults", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await searchStations({ order: "random", limit: 5, hideBroken: false, tag: "jazz" });

    const parsed = firstUrl(fetchMock);
    expect(parsed.searchParams.get("order")).toBe("random");
    expect(parsed.searchParams.get("limit")).toBe("5");
    expect(parsed.searchParams.get("hidebroken")).toBe("false");
    expect(parsed.searchParams.get("tag")).toBe("jazz");
  });
});

describe("getTopStations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("avoids /stations/topclick, whose ranking is click-farmed", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await getTopStations(10);

    const parsed = firstUrl(fetchMock);
    expect(parsed.pathname).not.toContain("topclick");
    expect(parsed.searchParams.get("order")).toBe("votes");
    expect(parsed.searchParams.get("limit")).toBe("10");
  });
});
