"use client";

import { useLibrary } from "@/lib/library/client";
import type { PlayableStation } from "@/lib/radio-browser/types";

export interface FavoriteButtonProps {
  station: PlayableStation;
  className?: string;
}

/**
 * Toggles a station in the local library.
 *
 * Always rendered as a sibling of (never inside) a station card, because the
 * card itself is a <button> and buttons cannot nest.
 */
export function FavoriteButton({ station, className = "" }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useLibrary();
  const active = isFavorite(station.stationuuid);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(station)}
      aria-pressed={active}
      aria-label={active ? `取消收藏 ${station.name}` : `收藏 ${station.name}`}
      title={active ? "取消收藏" : "收藏"}
      className={`flex size-7 items-center justify-center rounded-lg transition active:scale-90 ${
        active
          ? "text-accent hover:text-accent/75"
          : "text-ink-muted/45 hover:bg-surface-3 hover:text-ink"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <path
          d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? 0 : 1.7}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
