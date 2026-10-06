"use client";

import { useState } from "react";
import { StationCard } from "./StationCard";
import type { CardStation } from "@/lib/radio-browser/types";

export function StationGrid({
  stations,
  subtitleFor,
}: {
  stations: CardStation[];
  /** Optional per-station subtitle override. */
  subtitleFor?: (station: CardStation) => string;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stations.map((station) => (
        <li key={station.stationuuid}>
          <StationCard station={station} subtitle={subtitleFor?.(station)} />
        </li>
      ))}
    </ul>
  );
}

export interface CollapsibleStationGridProps {
  stations: CardStation[];
  /** How many to show before the expander. */
  initial?: number;
  /** How many more each press reveals. */
  step?: number;
  subtitleFor?: (station: CardStation) => string;
}

/**
 * Grid that reveals results in chunks.
 *
 * Two long sections back to back made the page thousands of pixels tall, so
 * Guangdong was unreachable without a long scroll. Callers should pass a `key`
 * derived from the active filters: remounting resets the count without needing
 * a state-syncing effect.
 */
export function CollapsibleStationGrid({
  stations,
  initial = 12,
  step = 12,
  subtitleFor,
}: CollapsibleStationGridProps) {
  const [count, setCount] = useState(initial);
  const visible = stations.slice(0, count);
  const remaining = stations.length - visible.length;

  return (
    <div>
      <StationGrid stations={visible} subtitleFor={subtitleFor} />

      {remaining > 0 && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((current) => current + step)}
            className="rounded-full border border-line bg-surface-1 px-5 py-2 text-sm text-ink-muted transition hover:border-accent/50 hover:text-ink active:scale-[0.98]"
          >
            显示更多
            <span className="ml-2 text-xs tabular-nums opacity-70">还有 {remaining} 个</span>
          </button>
        </div>
      )}
    </div>
  );
}
