"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StationGrid } from "./StationGrid";
import { useStations } from "@/hooks/useStations";
import { formatCount } from "@/lib/format";
import type { Country, Station, StationOrder, Tag } from "@/lib/radio-browser/types";

const ORDER_OPTIONS: Array<{ value: StationOrder; label: string }> = [
  { value: "clickcount", label: "最热门" },
  { value: "clicktrend", label: "上升最快" },
  { value: "votes", label: "票数最高" },
  { value: "bitrate", label: "音质优先" },
  { value: "name", label: "名称排序" },
];

interface StationExplorerProps {
  initialStations: Station[];
}

export function StationExplorer({ initialStations }: StationExplorerProps) {
  const { stations, loading, error, search } = useStations(initialStations);

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [tag, setTag] = useState("");
  const [order, setOrder] = useState<StationOrder>("clickcount");
  const [httpsOnly, setHttpsOnly] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const hasSearched = useRef(false);

  // Reference data is loaded lazily; the grid is already usable without it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [countryRes, tagRes] = await Promise.allSettled([
        fetch("/api/countries").then((response) => response.json()),
        fetch("/api/tags").then((response) => response.json()),
      ]);

      if (cancelled) return;

      if (countryRes.status === "fulfilled") {
        setCountries((countryRes.value as { countries?: Country[] }).countries ?? []);
      }
      if (tagRes.status === "fulfilled") {
        setTags((tagRes.value as { tags?: Tag[] }).tags ?? []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useMemo(
    () => ({ query, country, tag, order, httpsOnly }),
    [query, country, tag, order, httpsOnly],
  );

  // Re-query whenever any filter changes. The first run is skipped so the
  // server-rendered "top stations" list is not immediately replaced.
  useEffect(() => {
    if (!hasSearched.current) {
      hasSearched.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const params: Record<string, string> = { order: filters.order, limit: "60" };
      if (filters.query.trim()) params.q = filters.query.trim();
      if (filters.country) params.country = filters.country;
      if (filters.tag) params.tag = filters.tag;
      if (filters.httpsOnly) params.https = "1";

      void search(params);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, search]);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-3">
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
          value={country}
          onChange={setCountry}
          options={countries.map((item) => ({
            value: item.iso_3166_1,
            label: `${item.name} (${formatCount(item.stationcount)})`,
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
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
        <span>
          {loading ? "检索中…" : `共 ${stations.length} 个结果`}
        </span>
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

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = true,
}: SelectProps) {
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
