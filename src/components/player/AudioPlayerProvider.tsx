"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  attachHls,
  canPlayHlsNatively,
  isHlsUrl,
  type HlsHandle,
} from "@/lib/audio/hls-loader";
import { playbackUrl } from "@/lib/format";
import type { PlayableStation } from "@/lib/radio-browser/types";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioPlayerValue {
  station: PlayableStation | null;
  status: PlaybackStatus;
  error: string | null;
  volume: number;
  muted: boolean;
  play: (station: PlayableStation) => void;
  toggle: () => void;
  stop: () => void;
  retry: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

/** Live streams drop out; two quick reconnects fix most of it. */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 450;

const AudioPlayerContext = createContext<AudioPlayerValue | null>(null);

export function useAudioPlayer(): AudioPlayerValue {
  const value = useContext(AudioPlayerContext);
  if (!value) {
    throw new Error("useAudioPlayer must be used within <AudioPlayerProvider>");
  }
  return value;
}

/** Reports the play to the directory without blocking playback. */
function reportClick(stationuuid: string): void {
  void fetch(`/api/click?uuid=${encodeURIComponent(stationuuid)}`, { method: "POST" }).catch(
    () => undefined,
  );
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<HlsHandle | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<{ uuid: string; count: number }>({ uuid: "", count: 0 });

  const [station, setStation] = useState<PlayableStation | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);

  /** Breaks the startPlayback <-> handleFailure cycle without writing refs in render. */
  const failureRef = useRef<(cause?: unknown) => void>(() => undefined);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const teardownStream = useCallback(() => {
    clearRetry();
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, [clearRetry]);

  const startPlayback = useCallback(
    async (next: PlayableStation) => {
      const audio = audioRef.current;
      if (!audio) return;

      setStatus("loading");
      clearRetry();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      const url = playbackUrl(next);

      try {
        if (isHlsUrl(url) && !canPlayHlsNatively(audio)) {
          hlsRef.current = await attachHls(audio, url, (message) => failureRef.current(message));
        } else {
          audio.src = url;
        }

        await audio.play();
        setError(null);
        reportClick(next.stationuuid);
      } catch (cause) {
        failureRef.current(cause);
      }
    },
    [clearRetry],
  );

  const handleFailure = useCallback(
    (cause?: unknown) => {
      const current = station;
      const state = retryRef.current;

      if (current && state.uuid === current.stationuuid && state.count < MAX_RETRIES) {
        state.count += 1;
        const delay = RETRY_BASE_DELAY_MS * 2 ** (state.count - 1);

        setStatus("loading");
        setError(`连接失败，正在重试（${state.count}/${MAX_RETRIES}）…`);

        clearRetry();
        retryTimerRef.current = setTimeout(() => {
          void startPlayback(current);
        }, delay);
        return;
      }

      setStatus("error");
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "这个电台暂时无法播放，换一个试试。",
      );
    },
    [station, startPlayback, clearRetry],
  );

  useEffect(() => {
    failureRef.current = handleFailure;
  }, [handleFailure]);

  // A single long-lived <audio> element keeps playback alive across navigation.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = 0.8;
    audioRef.current = audio;

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  // Declared after the element-creation effect so audioRef is populated on the
  // first pass, and re-registered whenever the handlers change identity.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlaying = () => {
      setStatus("playing");
      setError(null);
    };
    const handleWaiting = () => setStatus("loading");
    const handlePause = () => setStatus((prev) => (prev === "error" ? prev : "paused"));
    const handleError = () => handleFailure();

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [handleFailure]);

  const play = useCallback(
    (next: PlayableStation) => {
      retryRef.current = { uuid: next.stationuuid, count: 0 };
      setStation(next);
      setError(null);
      void startPlayback(next);
    },
    [startPlayback],
  );

  const retry = useCallback(() => {
    if (!station) return;
    retryRef.current = { uuid: station.stationuuid, count: 0 };
    void startPlayback(station);
  }, [station, startPlayback]);

  const stop = useCallback(() => {
    retryRef.current = { uuid: "", count: 0 };
    teardownStream();
    setStation(null);
    setStatus("idle");
    setError(null);
  }, [teardownStream]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !station) return;

    if (audio.paused) {
      retryRef.current = { uuid: station.stationuuid, count: 0 };
      setStatus("loading");
      void audio.play().catch(() => handleFailure());
    } else {
      audio.pause();
    }
  }, [station, handleFailure]);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolumeState(clamped);

    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = clamped;
    if (clamped > 0 && audio.muted) {
      audio.muted = false;
      setMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      const audio = audioRef.current;
      if (audio) audio.muted = next;
      return next;
    });
  }, []);

  // Lock-screen / headphone controls.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    if (!station) {
      session.metadata = null;
      session.playbackState = "none";
      return;
    }

    session.metadata = new MediaMetadata({
      title: station.name,
      artist: station.country || "RadioAtlas",
      album: "RadioAtlas",
      artwork: station.favicon ? [{ src: station.favicon }] : undefined,
    });
    session.playbackState = status === "paused" ? "paused" : "playing";
  }, [station, status]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    const bindings: Array<[MediaSessionAction, () => void]> = [
      ["play", toggle],
      ["pause", toggle],
      ["stop", stop],
    ];

    for (const [action, handler] of bindings) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }

    return () => {
      for (const [action] of bindings) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [toggle, stop]);

  const value = useMemo<AudioPlayerValue>(
    () => ({
      station,
      status,
      error,
      volume,
      muted,
      play,
      toggle,
      stop,
      retry,
      setVolume,
      toggleMute,
    }),
    [station, status, error, volume, muted, play, toggle, stop, retry, setVolume, toggleMute],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}
