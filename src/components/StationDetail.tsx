"use client";

import { useState } from "react";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import { useAudioPlayer } from "./player/AudioPlayerProvider";
import { formatBitrate, formatCodec, formatCount, isRelayed, parseTags } from "@/lib/format";
import type { Station } from "@/lib/radio-browser/types";

export function StationDetail({ station }: { station: Station }) {
  const { play, toggle, station: current, status } = useAudioPlayer();
  const [faviconFailed, setFaviconFailed] = useState(false);

  const isCurrent = current?.stationuuid === station.stationuuid;
  const isPlaying = isCurrent && status === "playing";
  const isBusy = isCurrent && status === "loading";

  const tags = parseTags(station.tags, 12);
  const place = [station.country, station.state].filter(Boolean).join(" · ");
  const relayed = isRelayed(station);

  return (
    <article>
      <header className="flex flex-wrap items-start gap-6">
        <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2 sm:size-28">
          {station.favicon && !faviconFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- favicons come from arbitrary third-party hosts
            <img
              src={station.favicon}
              alt=""
              className="size-full object-contain"
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <span className="text-lg font-semibold tracking-wide text-ink-muted">
              {(station.countrycode || "??").slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-[240px] flex-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {station.name}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {place || "未知地区"}
            {station.language ? ` · ${station.language}` : ""}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (isCurrent ? toggle() : play(station))}
              aria-label={isPlaying ? `暂停 ${station.name}` : `播放 ${station.name}`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-surface-0 transition hover:brightness-110 active:scale-[0.97]"
            >
              {isBusy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-surface-0/30 border-t-surface-0" />
              ) : isPlaying ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
              {isPlaying ? "暂停" : "播放"}
            </button>

            <FavoriteButton station={station} variant="labelled" />
            <ShareButton title={station.name} path={`/station/${station.stationuuid}`} />
          </div>
        </div>
      </header>

      <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="编码" value={formatCodec(station.codec)} />
        <Fact label="码率" value={formatBitrate(station.bitrate)} />
        <Fact label="传输" value={station.hls === 1 ? "HLS" : relayed ? "服务端中转" : "直连"} />
        <Fact
          label="状态"
          value={station.lastcheckok === 1 ? "在线" : "离线"}
          tone={station.lastcheckok === 1 ? "ok" : "bad"}
        />
        <Fact label="票数" value={formatCount(station.votes)} />
        <Fact label="点击" value={formatCount(station.clickcount)} />
      </dl>

      {tags.length > 0 && (
        <div className="mt-7">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            标签
          </h2>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {station.homepage && (
        <a
          href={station.homepage}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-7 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-accent"
        >
          访问官网
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
            <path d="M14 3v2h3.6l-9.3 9.3 1.4 1.4L19 6.4V10h2V3zM5 5h5V3H3v18h18v-7h-2v5H5z" />
          </svg>
        </a>
      )}
    </article>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="bg-surface-1 px-4 py-3.5">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd
        className={`mt-1 text-sm font-medium tabular-nums ${
          tone === "ok" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
