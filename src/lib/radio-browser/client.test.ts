import { describe, expect, it, vi } from "vitest";
import {
  buildUrl,
  DEFAULT_USER_AGENT,
  radioFetch,
  RadioBrowserError,
  stationQueryParams,
} from "./client";

/** Minimal fetch stub — avoids depending on the environment's Response class. */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const asFetch = (mock: unknown) => mock as unknown as typeof fetch;

/** Awaits a promise expected to reject and returns the typed error. */
async function captureError(promise: Promise<unknown>): Promise<RadioBrowserError> {
  try {
    await promise;
  } catch (cause) {
    if (cause instanceof RadioBrowserError) return cause;
    throw cause;
  }
  throw new Error("Expected the request to reject, but it resolved");
}

describe("buildUrl", () => {
  it("joins mirror and path with exactly one slash", () => {
    expect(buildUrl("https://de1.api.radio-browser.info", "/json/stats")).toBe(
      "https://de1.api.radio-browser.info/json/stats",
    );
    expect(buildUrl("https://de1.api.radio-browser.info/", "json/stats")).toBe(
      "https://de1.api.radio-browser.info/json/stats",
    );
  });

  it("drops empty, null and undefined query values but keeps zero", () => {
    const url = buildUrl("https://example.com", "/json/stations/search", {
      name: "jazz",
      tag: "",
      country: undefined,
      language: null,
      limit: 0,
    });

    expect(url).toBe("https://example.com/json/stations/search?name=jazz&limit=0");
  });
});

describe("stationQueryParams", () => {
  it("maps camelCase options onto the API's snake_case names", () => {
    expect(
      stationQueryParams({ isHttps: true, hasGeoInfo: false, hideBroken: false, order: "votes" }),
    ).toMatchObject({
      is_https: true,
      has_geo_info: false,
      hidebroken: false,
      order: "votes",
    });
  });

  it("hides broken stations by default", () => {
    expect(stationQueryParams({}).hidebroken).toBe(true);
  });
});

describe("radioFetch", () => {
  it("returns parsed JSON from the first healthy mirror", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ stations: 60228 }));

    const result = await radioFetch<{ stations: number }>("/json/stats", undefined, {
      fetchImpl: asFetch(fetchImpl),
    });

    expect(result).toEqual({ stations: 60228 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends an identifying User-Agent", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));

    await radioFetch("/json/stats", undefined, { fetchImpl: asFetch(fetchImpl) });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(DEFAULT_USER_AGENT);
  });

  it("falls back to the next mirror on a non-OK response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      radioFetch("/json/stats", undefined, { fetchImpl: asFetch(fetchImpl) }),
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to the next mirror on a network error", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(
      radioFetch("/json/stats", undefined, { fetchImpl: asFetch(fetchImpl) }),
    ).resolves.toEqual({ ok: true });
  });

  it("throws RadioBrowserError naming every attempt when all mirrors fail", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));

    await expect(
      radioFetch("/json/stats", undefined, {
        fetchImpl: asFetch(fetchImpl),
        mirrors: ["https://a.test", "https://b.test"],
      }),
    ).rejects.toBeInstanceOf(RadioBrowserError);

    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const error = await captureError(
      radioFetch("/json/stats", undefined, {
        fetchImpl: asFetch(fetchImpl),
        mirrors: ["https://a.test", "https://b.test"],
      }),
    );

    expect(error.attempts).toHaveLength(2);
    expect(error.message).toContain("https://a.test");
    expect(error.message).toContain("https://b.test");
  });
});
