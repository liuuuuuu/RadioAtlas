"use client";

import { useState } from "react";
import { CollapsibleStationGrid } from "./StationGrid";
import { useLibrary } from "@/lib/library/client";

type Tab = "favorites" | "recents";

/**
 * Favourites and recently played, read from localStorage.
 *
 * Renders nothing until the client snapshot arrives (the server has no storage,
 * and `useSyncExternalStore` renders the empty library on the server), so a
 * first-time visitor never sees an empty section.
 */
export function LibrarySection() {
  const { favorites, recents, clearRecents } = useLibrary();
  const [tab, setTab] = useState<Tab>("favorites");

  if (favorites.length === 0 && recents.length === 0) return null;

  const activeTab: Tab = tab === "favorites" && favorites.length === 0 ? "recents" : tab;
  const list = activeTab === "favorites" ? favorites : recents;

  return (
    <section aria-label="我的电台" className="mb-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-accent">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Your Library
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">我的电台</h2>
        </div>

        <div className="flex items-center gap-2">
          <TabButton
            active={activeTab === "favorites"}
            onClick={() => setTab("favorites")}
            label="收藏"
            count={favorites.length}
          />
          <TabButton
            active={activeTab === "recents"}
            onClick={() => setTab("recents")}
            label="最近播放"
            count={recents.length}
          />
          {activeTab === "recents" && recents.length > 0 && (
            <button
              type="button"
              onClick={clearRecents}
              className="rounded-full px-3 py-1.5 text-xs text-ink-muted transition hover:text-ink"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface-1 p-6 text-sm text-ink-muted">
          {activeTab === "favorites"
            ? "还没有收藏。点卡片右上角的星标即可保存。"
            : "还没有播放记录。"}
        </p>
      ) : (
        <CollapsibleStationGrid
          key={activeTab}
          stations={list}
          initial={8}
          step={8}
        />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition active:scale-[0.97] ${
        active
          ? "border-accent/60 bg-accent/12 text-ink"
          : "border-line bg-surface-1 text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {label}
      <span className="text-[11px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}
