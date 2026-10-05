"use client";

import { useState } from "react";
import { useAudioPlayer } from "@/components/player/AudioPlayerProvider";
import { formatBitrate, formatCodec, parseTags, isInsecureStream } from "@/lib/format";
import type { Station } from "@/lib/radio-browser/types";

export function StationCard({ station }: { station: Station }) {
  const { play, station: current, status } = useAudioPlayer();
  const [faviconFailed, setFaviconFailed] = useState(false);

  const isCurrent = current?.stationuuid === station.stationuuid;
  const isPlaying = isCurrent && status === "playing";
  const isBusy = isCurrent && status === "loading";
  const tags = parseTags(station.tags, 2);
  const insecure = isInsecureStream(station);

  return (
    <button
      type="button"
      onClick={() => play(station)}
      className={`group flex h-full flex-col gap-3 rounded-xl border p-4 text-left transition ${
        isCurrent
          ? "border-accent/60 bg-surface-2"
          : "border-line bg-surface-1 hover:border-accent/40 hover:bg-surface-2"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
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
            <span className="text-xs font-semibold text-ink-muted">
              {(station.countrycode || "??").slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-snug">{station.name}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {[station.country, station.state].filter(Boolean).join(" · ") || "未知地区"}
          </span>
        </span>

        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full transition ${
            isPlaying ? "bg-accent text-surface-0" : "text-ink-muted group-hover:text-accent"
          }`}
          aria-hidden="true"
        >
          {isBusy ? (
            <span className="size-3 animate-spin rounded-full border-2 border-ink-muted/30 border-t-ink-muted" />
          ) : isPlaying ? (
            <svg viewBox="0 0 24 24" className="size-3 fill-current">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
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
        {station.hls === 1 && <span className="text-accent/80">HLS</span>}
        {insecure && <span className="text-amber-500/80">HTTP</span>}
        {station.lastcheckok !== 1 && <span className="text-red-400/80">离线</span>}
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
