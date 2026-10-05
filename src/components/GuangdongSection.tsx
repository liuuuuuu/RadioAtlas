"use client";

import { useMemo, useState } from "react";
import { CollapsibleStationGrid } from "./StationGrid";
import { cityLabel } from "@/lib/geo/regions";
import type { GuangdongStation } from "@/lib/geo/guangdong";
export interface GuangdongSectionProps {
  stations: GuangdongStation[];
}

/**
 * A distinct zone for Guangdong, with city chips derived from station names.
 * Uses its own accent hue so it reads as separate from the global explorer.
 */
export function GuangdongSection({ stations }: GuangdongSectionProps) {
  const [cityId, setCityId] = useState<string | null>(null);

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const station of stations) {
      counts.set(station.cityId, (counts.get(station.cityId) ?? 0) + 1);
    }

    // Known cities first (by count), then any bucket the classifier produced.
    const ordered = [...counts.entries()]
      .map(([id, count]) => ({ id, label: cityLabel(id), count }))
      .sort((a, b) => {
        if (a.id === "province") return 1;
        if (b.id === "province") return -1;
        return b.count - a.count;
      });

    return ordered;
  }, [stations]);

  const visible = useMemo(
    () => (cityId ? stations.filter((station) => station.cityId === cityId) : stations),
    [stations, cityId],
  );

  if (stations.length === 0) {
    return (
      <section aria-label="广东专区" className="mb-14">
        <SectionHeading />
        <p className="rounded-2xl border border-line bg-surface-1 p-6 text-sm text-ink-muted">
          暂时无法加载广东电台数据，请稍后刷新重试。
        </p>
      </section>
    );
  }

  return (
    <section aria-label="广东专区" className="mb-14">
      <SectionHeading count={stations.length} />

      <div className="mb-5 flex flex-wrap gap-2">
        <CityChip active={cityId === null} onClick={() => setCityId(null)} label="全部" count={stations.length} />
        {cities.map((city) => (
          <CityChip
            key={city.id}
            active={cityId === city.id}
            onClick={() => setCityId(city.id)}
            label={city.label}
            count={city.count}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface-1 p-6 text-sm text-ink-muted">
          这个城市暂无电台。
        </p>
      ) : (
        <CollapsibleStationGrid
          key={cityId ?? "all"}
          stations={visible}
          initial={12}
          subtitleFor={(station) => {
            const id = (station as GuangdongStation).cityId;
            const city = cityLabel(id);
            return id === "province" ? "广东" : `广东 · ${city}`;
          }}
        />
      )}
    </section>
  );
}

function SectionHeading({ count }: { count?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-teal-300">
          <span className="inline-block size-1.5 rounded-full bg-teal-300" aria-hidden="true" />
          Local Spotlight
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          广东专区
          {count !== undefined && (
            <span className="ml-3 align-middle text-sm font-normal text-ink-muted tabular-nums">
              {count} 个电台
            </span>
          )}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          珠三角与全省地市电台。目录里广东的省份字段混用了威妥玛拼音（Kwangtung）与拼音（Guangdong），
          这里已合并去重，并按城市归类。
        </p>
      </div>
    </div>
  );
}

function CityChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition active:scale-[0.97] ${
        active
          ? "border-teal-300/70 bg-teal-300/15 text-teal-100"
          : "border-line bg-surface-1 text-ink-muted hover:border-teal-300/40 hover:text-ink"
      }`}
    >
      {label}
      <span className="text-[11px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}
