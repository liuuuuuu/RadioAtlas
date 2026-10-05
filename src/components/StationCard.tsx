"use client";

import { useState } from "react";
import { useAudioPlayer } from "@/components/player/AudioPlayerProvider";
import { formatBitrate, formatCodec, formatCount, isInsecureStream, parseTags } from "@/lib/format";
import type { Station } from "@/lib/radio-browser/types";

/**
 * Whole-card play target.
 *
 * Clicking anywhere toggles playback — the previous version only ever called
 * `play()`, so a second click on a playing station did nothing, and there was
 * no pressed state, focus ring or error feedback.
 */
export function StationCard({
  station,
  subtitle,
}: {
  station: Station;
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
    <button
      type="button"
      onClick={() => (isCurrent ? toggle() : play(station))}
      aria-pressed={isPlaying}
      aria-label={`${isPlaying ? "暂停" : "播放"} ${station.name}`}
      className={`group relative flex h-full w-full flex-col gap-3.5 overflow-hidden rounded-2xl border p-4 text-left transition duration-200 active:scale-[0.985] ${
        isCurrent
          ? "border-accent/60 bg-surface-2 shadow-[0_10px_34px_-16px_rgba(240,168,40,0.55)]"
          : "border-line bg-surface-1 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2 hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.95)]"
      }`}
    >
      {isCurrent && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent"
        />
      )}

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-3">
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
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-snug">{station.name}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {location || "未知地区"}
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition duration-200 ${
            isPlaying
              ? "border-accent bg-accent text-surface-0"
              : isFailed
                ? "border-red-500/50 text-red-400"
                : "border-line text-ink-muted group-hover:border-accent group-hover:bg-accent group-hover:text-surface-0"
          }`}
        >
          {isBusy ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-ink-muted/30 border-t-ink-muted" />
          ) : isPlaying ? (
            <span className="flex h-3 items-end gap-[2px]">
              <span className="eq-bar h-full w-[2.5px] rounded-sm bg-surface-0" />
              <span className="eq-bar h-full w-[2.5px] rounded-sm bg-surface-0" />
              <span className="eq-bar h-full w-[2.5px] rounded-sm bg-surface-0" />
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-3 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span>{formatCodec(station.codec)}</span>
        <span>{formatBitrate(station.bitrate)}</span>
        {station.votes > 0 && <span className="tabular-nums">{formatCount(station.votes)} 票</span>}
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
  );
}
