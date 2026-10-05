"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CollapsibleStationGrid } from "./StationGrid";
import { WorldGlobe } from "./map/WorldGlobe";
import { useAudioPlayer } from "./player/AudioPlayerProvider";
import { Select } from "./ui/Select";
import { Toggle } from "./ui/Toggle";
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
  countries: MapCountry[];
  /** Rendered between the globe and the global explorer. */
  children?: ReactNode;
}

export function AtlasExplorer({ initialStations, countries, children }: AtlasExplorerProps) {
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

  const countryOptions = useMemo(
    () =>
      countries
        .filter((country) => country.stationCount > 0)
        .sort((a, b) => b.stationCount - a.stationCount),
    [countries],
  );

  const markerScope = selected?.iso2 ?? "global";
  const markersLoading = markerState.scope !== markerScope;

  /**
   * Markers are a decorative layer. The upstream `has_geo_info` query is a full
   * scan (~3s for 120 rows), so we only ever ask for a small slice and never
   * block the station list on it.
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
        // ignore — the globe is still fully usable without markers
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
        favicon: marker.favicon,
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
      <section className="mb-12" aria-label="世界电台地球仪">
        <WorldGlobe
          countries={countries}
          markers={markerState.markers}
          markersLoading={markersLoading}
          selectedIso2={selected?.iso2 ?? null}
          onSelectCountry={setSelected}
          onPlayStation={playMarker}
        />

        <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
          {selected ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{selected.label}</span>
                <span className="ml-2 tabular-nums text-ink-muted">
                  {formatCount(selected.stationCount)} 个电台
                </span>
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted transition hover:border-accent/60 hover:text-ink active:scale-[0.97]"
              >
                清除选择
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              拖拽旋转地球 · 滚轮缩放 · 点击国家查看当地电台，点击光点直接播放
            </p>
          )}
        </div>
      </section>

      {children}

      <section aria-label="全球电台探索">
        <div className="mb-5">
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-accent">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Global Explorer
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">全球电台</h2>
        </div>

        <div className="mb-5 rounded-2xl border border-line bg-surface-1/50 p-3">
          <div className="flex flex-wrap items-stretch gap-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">搜索电台</span>
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索电台名称，如 jazz、BBC、新闻…"
                className="h-11 w-full rounded-xl border border-line bg-surface-1 pl-10 pr-3 text-sm outline-none transition placeholder:text-ink-muted hover:bg-surface-2 focus:border-accent/60"
              />
            </label>

            <div className="w-40">
              <Select
                label="国家/地区"
                value={selected?.iso2 ?? ""}
                onChange={(iso2) =>
                  setSelected(countryOptions.find((country) => country.iso2 === iso2) ?? null)
                }
                options={countryOptions.map((country) => ({
                  value: country.iso2,
                  label: country.label,
                  hint: formatCount(country.stationCount),
                }))}
                placeholder="全部国家"
              />
            </div>

            <div className="w-36">
              <Select
                label="流派"
                value={tag}
                onChange={setTag}
                options={tags.map((item) => ({
                  value: item.name,
                  label: item.name,
                  hint: formatCount(item.stationcount),
                }))}
                placeholder="全部流派"
              />
            </div>

            <div className="w-36">
              <Select
                label="排序"
                value={order}
                onChange={(value) => setOrder(value as StationOrder)}
                options={ORDER_OPTIONS}
                placeholder="排序"
                allowEmpty={false}
              />
            </div>

            <Toggle
              checked={httpsOnly}
              onChange={setHttpsOnly}
              label="仅 HTTPS"
              hint="解锁受限流"
            />

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-11 rounded-xl border border-transparent px-3 text-sm text-ink-muted transition hover:border-line hover:text-ink active:scale-[0.97]"
              >
                重置
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
          <span className="tabular-nums">
            {loading ? "检索中…" : `共 ${stations.length} 个结果`}
          </span>
          {error && (
            <span className="text-red-400" role="alert">
              {error}
            </span>
          )}
        </div>

        {loading && stations.length === 0 ? (
          <SkeletonGrid />
        ) : stations.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface-1 p-8 text-center text-sm text-ink-muted">
            没有匹配的电台，试试放宽筛选条件。
          </p>
        ) : (
          <CollapsibleStationGrid
            key={`${selected?.iso2 ?? "all"}|${tag}|${order}|${query}|${httpsOnly}`}
            stations={stations}
            initial={16}
          />
        )}
      </section>
    </>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
    >
      <path
        d="M10 4a6 6 0 1 0 3.7 10.7l4.3 4.3 1.4-1.4-4.3-4.3A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
        fill="currentColor"
      />
    </svg>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <li
          key={index}
          className="h-[132px] animate-pulse rounded-2xl border border-line bg-surface-1"
        />
      ))}
    </ul>
  );
}
