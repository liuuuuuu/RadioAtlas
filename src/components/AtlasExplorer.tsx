"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StationGrid } from "./StationGrid";
import { WorldMap } from "./map/WorldMap";
import { useAudioPlayer } from "./player/AudioPlayerProvider";
import { useStations } from "@/hooks/useStations";
import { formatCount } from "@/lib/format";
import type { Station, StationOrder, Tag } from "@/lib/radio-browser/types";
import type { MapCountry, StationMarker } from "@/lib/geo/types";

const ORDER_OPTIONS: Array<{ value: StationOrder; label: string }> = [
  { value: "votes", label: "票数最高" },
  { value: "clickcount", label: "点击最多" },
  { value: "clicktrend", label: "上升最快" },
  { value: "bitrate", label: "音质优先" },
  { value: "name", label: "名称排序" },
];

const RESULT_LIMIT = 60;

export interface AtlasExplorerProps {
  initialStations: Station[];
  /** Country outlines + directory counts, precomputed on the server. */
  countries: MapCountry[];
  mapWidth: number;
  mapHeight: number;
}

export function AtlasExplorer({
  initialStations,
  countries,
  mapWidth,
  mapHeight,
}: AtlasExplorerProps) {
  const { play } = useAudioPlayer();
  const { stations, loading, error, search } = useStations(initialStations);

  const [selected, setSelected] = useState<MapCountry | null>(null);
  const [markerState, setMarkerState] = useState<{ scope: string; markers: StationMarker[] }>({
    scope: "",
    markers: [],
  });
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [order, setOrder] = useState<StationOrder>("votes");
  const [httpsOnly, setHttpsOnly] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  const hasSearched = useRef(false);

  // Countries with at least one station, most-populated first.
  const countryOptions = useMemo(
    () =>
      countries
        .filter((country) => country.stationCount > 0)
        .sort((a, b) => b.stationCount - a.stationCount),
    [countries],
  );

  const markerScope = selected?.iso2 ?? "global";
  // Derived, not stored: no setState in the effect body, and the previous
  // markers stay on screen until the new scope arrives (no flicker).
  const markersLoading = markerState.scope !== markerScope;

  /**
   * Markers are a decorative layer over the choropleth. The upstream
   * `has_geo_info` query is a full scan, so we only ever ask for a small slice —
   * sparse worldwide, denser once a country is selected — and never block the
   * station list on it.
   */
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const scope = selected?.iso2 ?? "global";

    void (async () => {
      try {
        const url =
          scope === "global"
            ? "/api/map?limit=120"
            : `/api/map?country=${encodeURIComponent(scope)}&limit=200`;

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;

        const payload = (await response.json()) as { markers?: StationMarker[] };
        if (!cancelled) setMarkerState({ scope, markers: payload.markers ?? [] });
      } catch {
        // ignore — the map is still fully usable without markers
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selected?.iso2]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) return;
        const payload = (await response.json()) as { tags?: Tag[] };
        if (!cancelled) setTags(payload.tags ?? []);
      } catch {
        // genre filter is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-query on any filter change. The first run is skipped so the
  // server-rendered "top stations" list is not replaced on mount.
  useEffect(() => {
    if (!hasSearched.current) {
      hasSearched.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const params: Record<string, string> = { order, limit: String(RESULT_LIMIT) };
      if (query.trim()) params.q = query.trim();
      if (selected?.iso2) params.country = selected.iso2;
      if (tag) params.tag = tag;
      if (httpsOnly) params.https = "1";

      void search(params);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selected, tag, order, httpsOnly, search]);

  const playMarker = useCallback(
    (marker: StationMarker) => {
      play({
        stationuuid: marker.uuid,
        name: marker.name,
        url: marker.stream,
        url_resolved: marker.stream,
        country: marker.country,
        countrycode: marker.countrycode,
        codec: marker.codec,
        bitrate: marker.bitrate,
        hls: marker.hls,
        tags: marker.tags,
      });
    },
    [play],
  );

  const hasFilters = Boolean(query || selected || tag || httpsOnly);

  const resetFilters = useCallback(() => {
    setQuery("");
    setSelected(null);
    setTag("");
    setHttpsOnly(false);
    setOrder("votes");
  }, []);

  return (
    <>
      <section className="mb-8" aria-label="世界电台地图">
        <WorldMap
          countries={countries}
          markers={markerState.markers}
          markersLoading={markersLoading}
          width={mapWidth}
          height={mapHeight}
          selectedIso2={selected?.iso2 ?? null}
          onSelectCountry={setSelected}
          onPlayStation={playMarker}
        />

        <div className="mt-3 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
          {selected ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{selected.label}</span>
                <span className="ml-2 text-ink-muted">
                  {formatCount(selected.stationCount)} 个电台
                </span>
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted transition hover:border-accent/60 hover:text-ink"
              >
                清除选择
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              点击地图上的国家查看当地电台，或点击光点直接播放。
            </p>
          )}
        </div>
      </section>

      <section aria-label="电台列表">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索电台名称，如 jazz、BBC、新闻…"
            aria-label="搜索电台"
            className="h-10 min-w-[220px] flex-1 rounded-lg border border-line bg-surface-1 px-3 text-sm outline-none transition placeholder:text-ink-muted focus:border-accent/60"
          />

          <Select
            label="国家/地区"
            value={selected?.iso2 ?? ""}
            onChange={(iso2) =>
              setSelected(countryOptions.find((country) => country.iso2 === iso2) ?? null)
            }
            options={countryOptions.map((country) => ({
              value: country.iso2,
              label: `${country.label} (${formatCount(country.stationCount)})`,
            }))}
            placeholder="全部国家"
          />

          <Select
            label="流派"
            value={tag}
            onChange={setTag}
            options={tags.map((item) => ({
              value: item.name,
              label: `${item.name} (${formatCount(item.stationcount)})`,
            }))}
            placeholder="全部流派"
          />

          <Select
            label="排序"
            value={order}
            onChange={(value) => setOrder(value as StationOrder)}
            options={ORDER_OPTIONS}
            placeholder="排序"
            allowEmpty={false}
          />

          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-1 px-3 text-sm">
            <input
              type="checkbox"
              checked={httpsOnly}
              onChange={(event) => setHttpsOnly(event.target.checked)}
              className="accent-accent"
            />
            仅 HTTPS
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 rounded-lg px-3 text-sm text-ink-muted transition hover:text-ink"
            >
              重置
            </button>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
          <span>{loading ? "检索中…" : `共 ${stations.length} 个结果`}</span>
          {error && (
            <span className="text-red-400" role="alert">
              {error}
            </span>
          )}
        </div>

        {stations.length === 0 && !loading ? (
          <p className="rounded-lg border border-line bg-surface-1 p-6 text-sm text-ink-muted">
            没有匹配的电台，试试放宽筛选条件。
          </p>
        ) : (
          <StationGrid stations={stations} />
        )}
      </section>
    </>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  allowEmpty?: boolean;
}

function Select({ label, value, onChange, options, placeholder, allowEmpty = true }: SelectProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 max-w-[220px] rounded-lg border border-line bg-surface-1 px-3 text-sm outline-none transition focus:border-accent/60"
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
