"use client";

import { useEffect, useRef, useState } from "react";
import { FavoriteButton } from "../FavoriteButton";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { formatBitrate, formatCodec, formatCountdown, isRelayed, parseTags } from "@/lib/format";

const SLEEP_OPTIONS = [15, 30, 60, 90] as const;

export function PlayerBar() {
  const { station, status, error, volume, muted, toggle, stop, retry, setVolume, toggleMute } =
    useAudioPlayer();

  if (!station) return null;

  const isPlaying = status === "playing";
  const isFailed = status === "error";
  const tags = parseTags(station.tags, 2);
  const relayed = isRelayed(station);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface-1/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? "暂停" : "播放"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-surface-0 transition hover:brightness-110 active:scale-95"
        >
          {status === "loading" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-surface-0/30 border-t-surface-0" />
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{station.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {[station.country, formatCodec(station.codec), formatBitrate(station.bitrate)]
              .filter((part) => part && part !== "—")
              .join(" · ")}
            {tags.length > 0 ? ` · ${tags.join(", ")}` : ""}
          </p>
        </div>

        {error && (
          <p
            className={`hidden max-w-xs truncate text-xs sm:block ${
              isFailed ? "text-red-400" : "text-ink-muted"
            }`}
            role="alert"
          >
            {error}
          </p>
        )}

        {isFailed && (
          <button
            type="button"
            onClick={retry}
            className="shrink-0 rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 active:scale-[0.97]"
          >
            重试
          </button>
        )}

        {relayed && !isFailed && (
          <span
            className="hidden shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-muted sm:inline"
            title="该电台只有 HTTP 流，已通过服务端中转播放"
          >
            中转
          </span>
        )}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <FavoriteButton station={station} />

          <SleepTimer />

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "取消静音" : "静音"}
            className="text-ink-muted transition hover:text-ink"
          >
            {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="音量"
            className="hidden h-1 w-24 cursor-pointer appearance-none rounded-full bg-line accent-accent sm:block"
          />

          <button
            type="button"
            onClick={stop}
            aria-label="停止播放"
            className="text-ink-muted transition hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Countdown that pauses playback when it reaches zero. */
function SleepTimer() {
  const { sleepRemainingMs, setSleepTimer } = useAudioPlayer();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const active = sleepRemainingMs !== null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={active ? `睡眠定时，剩余 ${formatCountdown(sleepRemainingMs)}` : "睡眠定时"}
        title="睡眠定时"
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs transition ${
          active ? "text-accent" : "text-ink-muted hover:text-ink"
        }`}
      >
        <MoonIcon />
        {active && <span className="tabular-nums">{formatCountdown(sleepRemainingMs)}</span>}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="睡眠定时"
          className="absolute bottom-full right-0 z-50 mb-2 w-44 rounded-xl border border-line bg-surface-1 p-1 shadow-2xl"
        >
          <p className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
            到点自动停止
          </p>
          {SLEEP_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="menuitem"
              onClick={() => {
                setSleepTimer(minutes);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-2.5 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            >
              {minutes} 分钟后
            </button>
          ))}
          {active && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setSleepTimer(null);
                setOpen(false);
              }}
              className="mt-0.5 block w-full rounded-lg border-t border-line px-2.5 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            >
              取消定时
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a3.5 3.5 0 0 0-2-3.16v6.32A3.5 3.5 0 0 0 16.5 12z" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm14.7-1.3-1.4 1.4 1.8 1.9-1.8 1.9 1.4 1.4 1.8-1.9 1.8 1.9 1.4-1.4-1.8-1.9 1.8-1.9-1.4-1.4-1.8 1.9z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M12.3 2a9 9 0 1 0 9.4 11.6A7.5 7.5 0 0 1 12.3 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" />
    </svg>
  );
}
