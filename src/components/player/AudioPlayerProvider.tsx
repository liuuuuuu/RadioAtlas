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
import { resolveStreamUrl } from "@/lib/format";
import type { Station } from "@/lib/radio-browser/types";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioPlayerValue {
  station: Station | null;
  status: PlaybackStatus;
  error: string | null;
  volume: number;
  muted: boolean;
  play: (station: Station) => void;
  toggle: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

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

  const [station, setStation] = useState<Station | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);

  // A single long-lived <audio> element keeps playback alive across navigation.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = 0.8;
    audioRef.current = audio;

    const handlePlaying = () => {
      setStatus("playing");
      setError(null);
    };
    const handleWaiting = () => setStatus("loading");
    const handlePause = () => setStatus((prev) => (prev === "error" ? prev : "paused"));
    const handleError = () => {
      setStatus("error");
      setError("This stream is offline or blocked by the browser.");
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);

      hlsRef.current?.destroy();
      hlsRef.current = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  const teardownStream = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);

  const stop = useCallback(() => {
    teardownStream();
    setStation(null);
    setStatus("idle");
    setError(null);
  }, [teardownStream]);

  const play = useCallback(
    async (next: Station) => {
      const audio = audioRef.current;
      if (!audio) return;

      setStation(next);
      setStatus("loading");
      setError(null);

      teardownStream();

      const url = resolveStreamUrl(next);

      try {
        if (isHlsUrl(url) && !canPlayHlsNatively(audio)) {
          hlsRef.current = await attachHls(audio, url, (message) => {
            setStatus("error");
            setError(message);
          });
        } else {
          audio.src = url;
        }

        await audio.play();
        reportClick(next.stationuuid);
      } catch (cause) {
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Playback failed.");
      }
    },
    [teardownStream],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !station) return;

    if (audio.paused) {
      setStatus("loading");
      void audio.play().catch(() => {
        setStatus("error");
        setError("Playback failed.");
      });
    } else {
      audio.pause();
    }
  }, [station]);

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
      setVolume,
      toggleMute,
    }),
    [station, status, error, volume, muted, play, toggle, stop, setVolume, toggleMute],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}
