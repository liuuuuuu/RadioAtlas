/**
 * A country with directory counts, keyed by its numeric ISO code so it can be
 * joined against the TopoJSON outlines on the client.
 */
export interface MapCountry {
  /** Numeric ISO 3166-1, zero-padded to 3 digits (e.g. "156" for China). */
  id: string;
  /** ISO 3166-1 alpha-2, e.g. "CN". Empty when the join failed. */
  iso2: string;
  /** Localised display name. */
  label: string;
  /** Stations the directory lists for this country. */
  stationCount: number;
}

/**
 * Compact station payload for globe markers. Coordinates stay as lon/lat — the
 * globe re-projects every frame, so the client does the projection itself.
 */
export interface StationMarker {
  uuid: string;
  name: string;
  country: string;
  countrycode: string;
  /** Longitude in degrees. */
  lon: number;
  /** Latitude in degrees. */
  lat: number;
  /** Pre-resolved stream URL. */
  stream: string;
  hls: number;
  codec: string;
  bitrate: number;
  tags: string;
  /** Optional artwork for lock-screen controls. */
  favicon?: string;
}
