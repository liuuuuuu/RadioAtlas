/**
 * Choropleth ramp for the world map: station count -> fill colour.
 * Amber ramp on a near-black base so it reads on the dark theme.
 */

/**
 * Lower bounds for buckets 1..6; bucket 0 means "no stations listed".
 *
 * Calibrated against the real directory distribution (241 countries):
 * p50 = 17 stations, p75 = 5, p90 = 2 — the data is extremely skewed, so a
 * linear ladder makes almost every country land in the top bucket.
 * These thresholds put only the five largest markets (US, DE, FR, RU, MX) in
 * bucket 6 and spread the rest as 90/66/44/22/14/5.
 */
const THRESHOLDS = [1, 10, 50, 200, 800, 2500] as const;

export const DENSITY_FILLS = [
  "#151a23", // 0 — nothing listed
  "#241f16", // 1 — 1-9
  "#3b2f16", // 2 — 10-49
  "#5c4617", // 3 — 50-199
  "#8a6119", // 4 — 200-799
  "#bd801c", // 5 — 800-2499
  "#f0a828", // 6 — 2500+
] as const;

export const DENSITY_LABELS = ["无", "1+", "10+", "50+", "200+", "800+", "2500+"] as const;

/** Maps a station count onto a DENSITY_FILLS index (0..6). */
export function densityBucket(stationCount: number): number {
  if (stationCount <= 0) return 0;

  let bucket = 1;
  for (let index = 0; index < THRESHOLDS.length; index += 1) {
    const threshold = THRESHOLDS[index];
    if (threshold !== undefined && stationCount >= threshold) {
      bucket = index + 1;
    }
  }
  return bucket;
}

export function densityFill(stationCount: number): string {
  return DENSITY_FILLS[densityBucket(stationCount)] ?? DENSITY_FILLS[0];
}
