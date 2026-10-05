"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { DENSITY_FILLS, DENSITY_LABELS, densityBucket } from "@/lib/geo/density";
import type { MapCountry, StationMarker } from "@/lib/geo/types";
import { clampView, fitToBox, INITIAL_VIEW, zoomAt, type Viewport } from "@/lib/geo/viewport";
import { formatCount } from "@/lib/format";

/** Pointer travel (viewBox units) beyond which a press counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;

type Hover =
  | { kind: "country"; country: MapCountry; x: number; y: number }
  | { kind: "station"; marker: StationMarker; x: number; y: number };

export interface WorldMapProps {
  countries: MapCountry[];
  markers: StationMarker[];
  /** True while the (slow) upstream marker query is in flight. */
  markersLoading?: boolean;
  width: number;
  height: number;
  selectedIso2: string | null;
  onSelectCountry: (country: MapCountry | null) => void;
  onPlayStation: (marker: StationMarker) => void;
}

export function WorldMap({
  countries,
  markers,
  markersLoading = false,
  width,
  height,
  selectedIso2,
  onSelectCountry,
  onPlayStation,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originTx: number;
    originTy: number;
    moved: boolean;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<Viewport | null>(null);

  const [view, setView] = useState<Viewport>(INITIAL_VIEW);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Coalesce view updates to one per animation frame during drag/zoom. */
  const scheduleView = useCallback((next: Viewport) => {
    pendingViewRef.current = next;
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingViewRef.current) setView(pendingViewRef.current);
    });
  }, []);

  const toViewBox = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * width,
        y: ((clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  const trackHover = useCallback((event: { clientX: number; clientY: number }, value: Hover) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ ...value, x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const point = toViewBox(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0015);

      setView((previous) => zoomAt(previous, point, factor, width, height));
    },
    [toViewBox, width, height],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;

      const point = toViewBox(event.clientX, event.clientY);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        originTx: view.tx,
        originTy: view.ty,
        moved: false,
      };

      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [toViewBox, view.tx, view.ty],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const point = toViewBox(event.clientX, event.clientY);
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;

      if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        drag.moved = true;
        setDragging(true);
      }
      if (!drag.moved) return;

      scheduleView(
        clampView(
          { scale: view.scale, tx: drag.originTx + dx, ty: drag.originTy + dy },
          width,
          height,
        ),
      );
    },
    [toViewBox, scheduleView, view.scale, width, height],
  );

  const endDrag = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    svgRef.current?.releasePointerCapture(event.pointerId);
    setDragging(false);
  }, []);

  const handleCountryClick = useCallback(
    (country: MapCountry, event: ReactMouseEvent<SVGPathElement>) => {
      if (dragRef.current?.moved) return;
      if (!country.iso2) return;

      onSelectCountry(country);
      setView(fitToBox(event.currentTarget.getBBox(), width, height));
    },
    [onSelectCountry, width, height],
  );

  // Deliberately independent of `view.scale`: border thickness is driven by a
  // CSS variable on the parent <g>, so zooming never rebuilds 177 path nodes.
  const countryPaths = useMemo(
    () =>
      countries.map((country) => (
        <path
          key={country.id}
          d={country.d}
          className="atlas-country"
          style={{ fill: DENSITY_FILLS[densityBucket(country.stationCount)] }}
          data-iso2={country.iso2 || undefined}
          data-selectable={country.iso2 ? "true" : "false"}
          data-selected={country.iso2 && country.iso2 === selectedIso2 ? "true" : "false"}
          data-hovered={country.id === hoveredId ? "true" : "false"}
          onMouseEnter={(event) => {
            setHoveredId(country.id);
            trackHover(event, { kind: "country", country, x: 0, y: 0 });
          }}
          onMouseMove={(event) => trackHover(event, { kind: "country", country, x: 0, y: 0 })}
          onMouseLeave={() => {
            setHoveredId(null);
            setHover(null);
          }}
          onClick={(event) => handleCountryClick(country, event)}
        />
      )),
    [countries, selectedIso2, hoveredId, handleCountryClick, trackHover],
  );

  const markerRadius = 3.2 / view.scale;
  const strokeScale = 1 / view.scale;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#0a0e15]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`block w-full touch-none select-none ${
          dragging ? "cursor-grabbing" : view.scale > 1 ? "cursor-grab" : "cursor-default"
        }`}
        style={
          {
            aspectRatio: `${width} / ${height}`,
            "--atlas-stroke": String(strokeScale),
          } as CSSProperties
        }
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label="世界电台分布地图"
      >
        <defs>
          <radialGradient id="atlas-glow" cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#f0a828" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#f0a828" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={width} height={height} fill="#0a0e15" />
        <rect width={width} height={height} fill="url(#atlas-glow)" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          <g>{countryPaths}</g>

          {markers.length > 0 && (
            <g>
              {markers.map((marker) => (
                <circle
                  key={marker.uuid}
                  cx={marker.x}
                  cy={marker.y}
                  r={markerRadius}
                  className="atlas-marker"
                  stroke="#0a0e15"
                  strokeWidth={markerRadius * 0.45}
                  onMouseEnter={(event) =>
                    trackHover(event, { kind: "station", marker, x: 0, y: 0 })
                  }
                  onMouseLeave={() => setHover(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (dragRef.current?.moved) return;
                    onPlayStation(marker);
                  }}
                />
              ))}
            </g>
          )}
        </g>
      </svg>

      {hover && <MapTooltip hover={hover} />}

      <div className="pointer-events-none absolute left-3 top-3 hidden rounded-lg border border-line/70 bg-surface-0/85 px-3 py-2 text-[11px] text-ink-muted backdrop-blur sm:block">
        <p className="mb-1.5 font-medium text-ink">电台密度</p>
        <div className="flex items-center gap-1.5">
          {DENSITY_FILLS.map((fill, index) => (
            <span key={fill} className="flex items-center gap-1">
              <span className="size-3 rounded-sm border border-line" style={{ background: fill }} />
              <span className="tabular-nums">{DENSITY_LABELS[index]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 text-[11px] text-ink-muted">
        {markersLoading ? (
          <>
            <span className="size-3 animate-spin rounded-full border-2 border-ink-muted/30 border-t-ink-muted" />
            加载光点…
          </>
        ) : (
          <>
            <span className="tabular-nums">{markers.length}</span>
            <span>个已知坐标电台 · 滚轮缩放 / 拖拽平移</span>
          </>
        )}
      </div>

      {view.scale > 1 && (
        <button
          type="button"
          onClick={() => setView(INITIAL_VIEW)}
          className="absolute right-3 top-3 rounded-lg border border-line bg-surface-0/85 px-3 py-1.5 text-xs text-ink-muted backdrop-blur transition hover:border-accent/60 hover:text-ink"
        >
          重置 · {view.scale.toFixed(1)}×
        </button>
      )}
    </div>
  );
}

function MapTooltip({ hover }: { hover: Hover }) {
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface-0/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
      style={{ left: hover.x, top: hover.y - 12 }}
    >
      {hover.kind === "country" ? (
        <>
          <p className="font-medium text-ink">{hover.country.label}</p>
          <p className="mt-0.5 text-ink-muted">
            {hover.country.stationCount > 0
              ? `${formatCount(hover.country.stationCount)} 个电台 · 点击查看`
              : "目录中暂无电台"}
          </p>
        </>
      ) : (
        <>
          <p className="max-w-[200px] truncate font-medium text-ink">{hover.marker.name}</p>
          <p className="mt-0.5 text-ink-muted">
            {[
              hover.marker.country,
              hover.marker.codec !== "UNKNOWN" ? hover.marker.codec : null,
              hover.marker.bitrate > 0 ? `${hover.marker.bitrate} kbps` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-0.5 text-accent">点击播放</p>
        </>
      )}
    </div>
  );
}
