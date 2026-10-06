"use client";

import { useState } from "react";
import { FavoriteButton } from "./FavoriteButton";
import { useAudioPlayer } from "@/components/player/AudioPlayerProvider";
import { formatBitrate, formatCodec, formatCount, isInsecureStream, parseTags } from "@/lib/format";
import type { CardStation } from "@/lib/radio-browser/types";

/**
 * Whole-card play target.
 *
 * The card is a <button>, so the favourite toggle is a *sibling* inside a
 * relative wrapper — nesting one button inside another is invalid and breaks
 * keyboard activation.
 *
 * The play / playing indicator lives on the artwork rather than the corner, so
 * the star has somewhere to sit: it fades in over the logo on hover, and turns
 * into equaliser bars while playing.
 */
export function StationCard({
  station,
  subtitle,
}: {
  station: CardStation;
  /** Overrides the country · state line, e.g. "广东 · 广州". */
  subtitle?: string;
}) {
  const { play, toggle, station: current, status } = useAudioPlayer();
  const [faviconFailed, setFaviconFailed] = useState(false);

  const isCurrent = current?.stationuuid === station.stationuuid;
  const isPlaying = isCurrent && status === "playing";
  const isBusy = isCurrent && status === "loading";
  const isFailed = isCurrent && status === "error";

  const tags = parseTags(station.tags, 2);
  const insecure = isInsecureStream(station);
  const location = subtitle ?? [station.country, station.state].filter(Boolean).join(" · ");

  return (
    <div className="group relative h-full transition duration-200 hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : play(station))}
        aria-pressed={isPlaying}
        aria-label={`${isPlaying ? "暂停" : "播放"} ${station.name}`}
        className={`flex h-full w-full flex-col gap-3.5 overflow-hidden rounded-2xl border p-4 text-left transition duration-200 active:scale-[0.985] ${
          isCurrent
            ? "border-accent/60 bg-surface-2 shadow-[0_10px_34px_-16px_rgba(240,168,40,0.55)]"
            : "border-line bg-surface-1 group-hover:border-line-strong group-hover:bg-surface-2 group-hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.95)]"
        }`}
      >
        {isCurrent && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent"
          />
        )}

        <div className="flex items-start gap-3">
          <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-3">
            {station.favicon && !faviconFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- favicons come from arbitrary third-party hosts
              <img
                src={station.favicon}
                alt=""
                loading="lazy"
                className="size-full object-contain"
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              <span className="text-xs font-semibold tracking-wide text-ink-muted">
                {(station.countrycode || "??").slice(0, 2).toUpperCase()}
              </span>
            )}

            <span
              aria-hidden="true"
              className={`absolute inset-0 flex items-center justify-center transition duration-200 ${
                isPlaying
                  ? "bg-accent/90 text-surface-0"
                  : isFailed
                    ? "bg-red-500/85 text-white"
                    : "bg-surface-0/80 text-ink opacity-0 group-hover:opacity-100"
              }`}
            >
              {isBusy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-ink-muted/30 border-t-ink-muted" />
              ) : isPlaying ? (
                <span className="flex h-3.5 items-end gap-[2.5px]">
                  <span className="eq-bar h-full w-[2.5px] rounded-sm bg-surface-0" />
                  <span className="eq-bar h-full w-[2.5px] rounded-sm bg-surface-0" />
                  <span className="eq-bar h-full w-[2.5px] rounded-sm bg-surface-0" />
                </span>
              ) : isFailed ? (
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M12 2 1 21h22zM13 18h-2v-2h2zm0-4h-2V9h2z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </span>
          </span>

          <span className="min-w-0 flex-1 pr-7">
            <span className="block truncate text-sm font-medium leading-snug">{station.name}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-muted">
              {location || "未知地区"}
            </span>
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span>{formatCodec(station.codec)}</span>
          <span>{formatBitrate(station.bitrate)}</span>
          {(station.votes ?? 0) > 0 && (
            <span className="tabular-nums">{formatCount(station.votes ?? 0)} 票</span>
          )}
          {station.hls === 1 && <span className="text-accent/80">HLS</span>}
          {insecure && <span className="text-amber-500/80">HTTP</span>}
          {isFailed && <span className="text-red-400">播放失败</span>}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>

      <FavoriteButton station={station} className="absolute right-2.5 top-2.5 z-10" />
    </div>
  );
}
