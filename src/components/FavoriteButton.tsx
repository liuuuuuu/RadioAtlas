"use client";

import { useLibrary } from "@/lib/library/client";
import type { PlayableStation } from "@/lib/radio-browser/types";

export interface FavoriteButtonProps {
  station: PlayableStation;
  className?: string;
  /**
   * `icon` for a card corner (square, star only);
   * `labelled` for the detail page and player bar (pill with text).
   */
  variant?: "icon" | "labelled";
}

/**
 * Toggles a station in the local library.
 *
 * Always rendered as a sibling of (never inside) a station card, because the
 * card itself is a <button> and buttons cannot nest.
 */
export function FavoriteButton({
  station,
  className = "",
  variant = "icon",
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useLibrary();
  const active = isFavorite(station.stationuuid);

  const label = active ? "已收藏" : "收藏";
  const ariaLabel = active ? `取消收藏 ${station.name}` : `收藏 ${station.name}`;

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={() => toggleFavorite(station)}
        aria-pressed={active}
        aria-label={ariaLabel}
        className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition active:scale-[0.97] ${
          active
            ? "border-accent/60 bg-accent/10 text-accent hover:border-accent"
            : "border-line bg-surface-1 text-ink-muted hover:border-line-strong hover:text-ink"
        } ${className}`}
      >
        <StarIcon filled={active} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(station)}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`flex size-7 items-center justify-center rounded-lg transition active:scale-90 ${
        active
          ? "text-accent hover:text-accent/75"
          : "text-ink-muted/45 hover:bg-surface-3 hover:text-ink"
      } ${className}`}
    >
      <StarIcon filled={active} />
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0">
      <path
        d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}
