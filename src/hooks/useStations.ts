"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Station } from "@/lib/radio-browser/types";

interface StationsResponse {
  stations?: Station[];
  error?: string;
}

/**
 * Client-side station search against our own /api/stations route.
 * In-flight requests are aborted so a fast typist never sees stale results.
 */
export function useStations(initialStations: Station[] = []) {
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const search = useCallback(async (query: Record<string, string>) => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stations?${new URLSearchParams(query)}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as StationsResponse;
        throw new Error(payload.error ?? `请求失败（${response.status}）`);
      }

      const payload = (await response.json()) as StationsResponse;
      setStations(payload.stations ?? []);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "搜索失败");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  return { stations, loading, error, search };
}
