/**
 * Domain types mirroring the Radio Browser API payloads.
 * Only fields RadioAtlas actually consumes are modelled; the API returns more.
 *
 * Reference: https://api.radio-browser.info/ (free, no API key, CC0-ish community data)
 */

/**
 * The minimum a station must expose to be playable and rendered in the player
 * bar. The map endpoint ships hundreds of markers, so it sends only these
 * fields rather than full `Station` records.
 */
export interface PlayableStation {
  stationuuid: string;
  name: string;
  /** Original stream URL as submitted to the directory. */
  url: string;
  /** Stream URL after following redirects — prefer this for playback. */
  url_resolved: string;
  country: string;
  /** ISO 3166-1 alpha-2, e.g. "CN". */
  countrycode: string;
  /** "MP3" | "AAC" | "OGG" | "UNKNOWN" ... */
  codec: string;
  /** kbps, 0 when unknown. */
  bitrate: number;
  /** 1 when the stream is HLS (m3u8) and needs a JS player. */
  hls: number;
  /** Comma-separated genre tags, e.g. "jazz,public radio". */
  tags: string;
}

export interface Station extends PlayableStation {
  homepage: string;
  favicon: string;
  state: string;
  language: string;
  languagecodes: string;
  votes: number;
  lastcheckok: number;
  lastchecktime: string;
  clickcount: number;
  clicktrend: number;
  /** 1 when the stream certificate is invalid. */
  ssl_error: number;
  geo_lat: number | null;
  geo_long: number | null;
  has_extended_info: boolean;
}

export interface Country {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export interface Tag {
  name: string;
  stationcount: number;
}

export interface Language {
  name: string;
  iso_639: string | null;
  stationcount: number;
}

export interface RadioStats {
  supported_version: number;
  software_version: string;
  status: string;
  stations: number;
  stations_broken: number;
  tags: number;
  clicks_last_hour: number;
  clicks_last_day: number;
  languages: number;
  countries: number;
}

export type StationOrder =
  | "name"
  | "votes"
  | "clickcount"
  | "clicktrend"
  | "bitrate"
  | "random";

export const STATION_ORDERS: readonly StationOrder[] = [
  "name",
  "votes",
  "clickcount",
  "clicktrend",
  "bitrate",
  "random",
];

export interface StationSearchParams {
  /** Fuzzy station name match. */
  name?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  language?: string;
  tag?: string;
  tagList?: string;
  codec?: string;
  bitrateMin?: number;
  bitrateMax?: number;
  /** Only return streams reachable over HTTPS (avoids mixed-content blocking). */
  isHttps?: boolean;
  hasGeoInfo?: boolean;
  hideBroken?: boolean;
  order?: StationOrder;
  reverse?: boolean;
  offset?: number;
  limit?: number;
}
