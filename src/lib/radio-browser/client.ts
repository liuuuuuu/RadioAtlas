import type { StationSearchParams } from "./types";

/**
 * Public mirrors of the Radio Browser directory. They are interchangeable;
 * we walk the list until one answers so a single mirror outage is invisible.
 */
export const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
] as const;

/**
 * Radio Browser asks every client to identify itself. Browsers cannot set
 * `User-Agent`, which is the main reason all directory calls go through our
 * own route handlers instead of being issued from the client.
 */
export const DEFAULT_USER_AGENT =
  process.env.RADIO_BROWSER_USER_AGENT ??
  "RadioAtlas/0.1.0 (+https://github.com/liuuuuuu/RadioAtlas)";

export class RadioBrowserError extends Error {
  readonly path: string;
  readonly attempts: string[];

  constructor(path: string, attempts: string[]) {
    super(`Radio Browser request failed for "${path}": ${attempts.join(" | ")}`);
    this.name = "RadioBrowserError";
    this.path = path;
    this.attempts = attempts;
  }
}

export interface RequestOptions {
  /** Seconds Next.js should cache the upstream response for. */
  revalidate?: number;
  timeoutMs?: number;
  mirrors?: readonly string[];
  userAgent?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Join a mirror with a path and drop empty query values so we never send
 * `?tag=&country=` noise upstream.
 */
export function buildUrl(
  base: string,
  path: string,
  params?: Record<string, unknown>,
): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = new URL(path.replace(/^\/+/, ""), normalizedBase);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Fetch JSON from the Radio Browser directory with mirror failover.
 *
 * Every mirror is attempted in order; the first 2xx JSON response wins.
 * A non-OK status or a network/parse failure moves on to the next mirror.
 */
export async function radioFetch<T>(
  path: string,
  params?: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const {
    revalidate = 300,
    timeoutMs = 8000,
    mirrors = MIRRORS,
    userAgent = DEFAULT_USER_AGENT,
    fetchImpl = fetch,
  } = options;

  const attempts: string[] = [];

  for (const mirror of mirrors) {
    const url = buildUrl(mirror, path, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: controller.signal,
        next: { revalidate },
      } as RequestInit);

      if (!response.ok) {
        attempts.push(`${mirror} -> HTTP ${response.status}`);
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      attempts.push(`${mirror} -> ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new RadioBrowserError(path, attempts);
}

/** Convenience wrapper used by the query layer. */
export function stationQueryParams(
  params: StationSearchParams,
): Record<string, unknown> {
  return {
    name: params.name,
    country: params.country,
    countrycode: params.countrycode,
    state: params.state,
    language: params.language,
    tag: params.tag,
    tagList: params.tagList,
    codec: params.codec,
    bitrateMin: params.bitrateMin,
    bitrateMax: params.bitrateMax,
    is_https: params.isHttps,
    has_geo_info: params.hasGeoInfo,
    hidebroken: params.hideBroken ?? true,
    order: params.order,
    reverse: params.reverse,
    offset: params.offset,
    limit: params.limit,
  };
}
