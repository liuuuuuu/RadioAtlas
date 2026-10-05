"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { DENSITY_FILLS, DENSITY_LABELS, densityBucket } from "@/lib/geo/density";
import {
  decayVelocity,
  INITIAL_VIEW,
  isSettled,
  normalizeView,
  rotateBy,
  shortestDelta,
  viewForPoint,
  zoomTo,
  type GlobeView,
} from "@/lib/geo/globe";
import type { MapCountry, StationMarker } from "@/lib/geo/types";
import { formatCount } from "@/lib/format";

/** ViewBox the globe is drawn into. Square, so the sphere stays circular. */
const SIZE = 720;
const BASE_SCALE = SIZE * 0.44;

/** Idle time before the globe resumes spinning on its own. */
const IDLE_MS = 4500;
const AUTO_ROTATE_DEG_PER_SEC = 3.4;

type Hover =
  | { kind: "country"; country: MapCountry; x: number; y: number }
  | { kind: "station"; marker: StationMarker; x: number; y: number };

/**
 * What the pointer went down on.
 *
 * We cannot rely on `click` here: `setPointerCapture` retargets the whole
 * press/release sequence to the capturing <svg>, so the browser fires `click`
 * on the SVG root rather than on the country path. Hit-testing at pointerdown
 * and dispatching at pointerup is the only reliable route.
 */
type PendingHit = { kind: "country"; outlineId: string } | { kind: "station"; uuid: string };

interface Outline {
  id: string;
  geometry: Geometry;
  /** Centroid in degrees — used to fly to a country. */
  centroid: [number, number];
  /** Angular radius in radians — lets us skip the far side cheaply. */
  radius: number;
}

interface WorldGeo {
  outlines: Outline[];
  graticule: ReturnType<typeof geoGraticule10>;
}

function walkCoordinates(geometry: Geometry, visit: (point: Position) => void): void {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) for (const point of ring) visit(point);
    return;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates)
      for (const ring of polygon) for (const point of ring) visit(point);
  }
}

/** Largest angular distance from the centroid to any vertex. */
function angularRadius(geometry: Geometry, centroid: [number, number]): number {
  let max = 0;
  walkCoordinates(geometry, (point) => {
    const distance = geoDistance([point[0] ?? 0, point[1] ?? 0], centroid);
    if (distance > max) max = distance;
  });
  return max;
}

let worldGeoPromise: Promise<WorldGeo> | null = null;

/** Fetched once per page load and shared across mounts. */
function loadWorldGeo(): Promise<WorldGeo> {
  worldGeoPromise ??= (async () => {
    const topology = await fetch("/geo/countries-110m.json").then((response) => response.json());
    // `feature()` is typed as returning a union; the countries object is always
    // a GeometryCollection, so narrow through unknown.
    const collection = feature(
      topology,
      topology.objects.countries,
    ) as unknown as FeatureCollection;

    const outlines = (collection.features as Feature<Geometry>[]).flatMap((entry) => {
      if (!entry.geometry) return [];
      const centroid = geoCentroid(entry.geometry) as [number, number];
      return [
        {
          // TopoJSON ids are numeric ISO codes, sometimes missing leading zeros.
          id: String(entry.id ?? "").padStart(3, "0"),
          geometry: entry.geometry,
          centroid,
          radius: angularRadius(entry.geometry, centroid),
        },
      ];
    });

    return { outlines, graticule: geoGraticule10() };
  })();

  return worldGeoPromise;
}

/** Deterministic starfield — identical on server and client, so no hydration drift. */
const STARS = Array.from({ length: 110 }, (_, index) => {
  const a = Math.sin(index * 12.9898) * 43758.5453;
  const b = Math.sin(index * 78.233) * 43758.5453;
  const fa = a - Math.floor(a);
  const fb = b - Math.floor(b);
  return {
    x: Math.round(fa * SIZE * 10) / 10,
    y: Math.round(fb * SIZE * 10) / 10,
    r: Math.round((0.4 + fa * 0.9) * 10) / 10,
    o: Math.round((0.12 + fb * 0.4) * 100) / 100,
  };
});

export interface WorldGlobeProps {
  countries: MapCountry[];
  markers: StationMarker[];
  markersLoading?: boolean;
  selectedIso2: string | null;
  onSelectCountry: (country: MapCountry | null) => void;
  onPlayStation: (marker: StationMarker) => void;
}

export function WorldGlobe({
  countries,
  markers,
  markersLoading = false,
  selectedIso2,
  onSelectCountry,
  onPlayStation,
}: WorldGlobeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const countryEls = useRef<(SVGPathElement | null)[]>([]);
  const markerEls = useRef<(SVGCircleElement | null)[]>([]);
  const graticuleEl = useRef<SVGPathElement | null>(null);

  /**
   * Projection and path generator, created once. They are mutable objects we
   * rotate imperatively every frame — deliberately not React state, and not
   * refs either (reading a ref during render is not allowed).
   */
  const [{ projection, path }] = useState(() => {
    const geoProjection = geoOrthographic()
      .translate([SIZE / 2, SIZE / 2])
      .scale(BASE_SCALE)
      .clipAngle(90);
    return { projection: geoProjection, path: geoPath(geoProjection) };
  });

  const viewRef = useRef<GlobeView>(INITIAL_VIEW);
  const targetRef = useRef<GlobeView | null>(null);
  const velocityRef = useRef({ lon: 0, lat: 0 });
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    lastT: number;
    moved: boolean;
  } | null>(null);
  const interactingRef = useRef(false);
  const lastTouchRef = useRef(0);
  /** Once the user takes control, the globe never spins on its own again. */
  const autoRotateRef = useRef(true);
  const pendingHitRef = useRef<PendingHit | null>(null);
  const geoRef = useRef<WorldGeo | null>(null);
  const markersRef = useRef(markers);

  const [geo, setGeo] = useState<WorldGeo | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);

  const countryById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  );

  const outlineById = useMemo(
    () => new Map((geo?.outlines ?? []).map((outline) => [outline.id, outline])),
    [geo],
  );

  const fillById = useMemo(() => {
    const map = new Map<string, string>();
    for (const country of countries) {
      map.set(country.id, DENSITY_FILLS[densityBucket(country.stationCount)] ?? DENSITY_FILLS[0]);
    }
    return map;
  }, [countries]);

  /**
   * The hot path. React never re-renders during rotation: we rotate the
   * projection and write `d`/`cx`/`cy` straight onto the DOM nodes. Re-projecting
   * 177 outlines costs ~5 ms, which React reconciliation would multiply.
   */
  const draw = useCallback(
    (view: GlobeView, markerList: StationMarker[]) => {
      const centre: [number, number] = [view.lon, view.lat];

      projection.rotate([-view.lon, -view.lat]).scale(BASE_SCALE * view.zoom);

      const graticule = geoRef.current?.graticule;
      if (graticuleEl.current && graticule) {
        graticuleEl.current.setAttribute("d", path(graticule) ?? "");
      }

      const outlines = geoRef.current?.outlines;
      if (outlines) {
        for (let index = 0; index < outlines.length; index += 1) {
          const element = countryEls.current[index];
          const outline = outlines[index];
          if (!element || !outline) continue;

          // Everything further than a quarter turn plus its own size is hidden.
          const hidden = geoDistance(outline.centroid, centre) > Math.PI / 2 + outline.radius;
          const d = hidden ? "" : (path(outline.geometry) ?? "");
          if (element.getAttribute("d") !== d) element.setAttribute("d", d);
        }
      }

      const list = markerList;
      for (let index = 0; index < list.length; index += 1) {
        const element = markerEls.current[index];
        const marker = list[index];
        if (!element || !marker) continue;

        if (geoDistance([marker.lon, marker.lat], centre) >= Math.PI / 2) {
          if (element.getAttribute("opacity") !== "0") element.setAttribute("opacity", "0");
          continue;
        }

        const point = projection([marker.lon, marker.lat]);
        if (!point) {
          element.setAttribute("opacity", "0");
          continue;
        }

        element.setAttribute("cx", String(Math.round(point[0] * 10) / 10));
        element.setAttribute("cy", String(Math.round(point[1] * 10) / 10));
        if (element.getAttribute("opacity") !== "1") element.setAttribute("opacity", "1");
      }
    },
    [projection, path],
  );

  useEffect(() => {
    let alive = true;
    void loadWorldGeo().then((loaded) => {
      if (!alive) return;
      geoRef.current = loaded;
      setGeo(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the latest markers reachable from the animation loop without putting
  // them in its dependency list (which would restart the loop on every change).
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Single rAF loop: fly-to, inertia, idle spin, then one draw per frame.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      let view = viewRef.current;
      const target = targetRef.current;
      const velocity = velocityRef.current;

      if (target) {
        // Frame-rate independent easing towards the target view.
        const k = 1 - Math.exp(-5.5 * dt);
        const next = normalizeView({
          lon: view.lon + shortestDelta(view.lon, target.lon) * k,
          lat: view.lat + (target.lat - view.lat) * k,
          zoom: view.zoom + (target.zoom - view.zoom) * k,
        });

        if (isSettled(next, target, 0.2)) {
          view = target;
          targetRef.current = null;
        } else {
          view = next;
        }
        viewRef.current = view;
        draw(view, markersRef.current);
      } else if (Math.abs(velocity.lon) > 0.8 || Math.abs(velocity.lat) > 0.8) {
        view = normalizeView({
          lon: view.lon + velocity.lon * dt,
          lat: view.lat + velocity.lat * dt,
          zoom: view.zoom,
        });
        velocity.lon = decayVelocity(velocity.lon, dt);
        velocity.lat = decayVelocity(velocity.lat, dt);
        viewRef.current = view;
        draw(view, markersRef.current);
      } else {
        velocity.lon = 0;
        velocity.lat = 0;
        if (autoRotateRef.current && !interactingRef.current && now - lastTouchRef.current > IDLE_MS) {
          view = normalizeView({ ...view, lon: view.lon + AUTO_ROTATE_DEG_PER_SEC * dt });
          viewRef.current = view;
          draw(view, markersRef.current);
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [draw]);

  // Redraw whenever React changes the layers (new markers, new selection, load).
  useEffect(() => {
    if (geo) draw(viewRef.current, markers);
  }, [draw, geo, markers, selectedIso2, countries]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top, rect };
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;

    const target = event.target as Element | null;
    const markerElement = target?.closest?.("[data-marker-uuid]");
    const countryElement = target?.closest?.("[data-outline-id]");

    pendingHitRef.current = markerElement
      ? { kind: "station", uuid: markerElement.getAttribute("data-marker-uuid") ?? "" }
      : countryElement
        ? { kind: "country", outlineId: countryElement.getAttribute("data-outline-id") ?? "" }
        : null;

    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      moved: false,
    };
    velocityRef.current = { lon: 0, lat: 0 };
    targetRef.current = null;
    interactingRef.current = true;
    autoRotateRef.current = false;
    lastTouchRef.current = performance.now();
    svgRef.current?.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    const dt = Math.max((event.timeStamp - drag.lastT) / 1000, 0.008);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;

    if (!drag.moved && Math.hypot(dx, dy) > 3) {
      drag.moved = true;
      setDragging(true);
    }
    if (!drag.moved) return;

    const before = viewRef.current;
    const after = rotateBy(before, dx, dy);
    viewRef.current = after;
    velocityRef.current = {
      lon: shortestDelta(before.lon, after.lon) / dt,
      lat: (after.lat - before.lat) / dt,
    };
    lastTouchRef.current = performance.now();
    draw(after, markersRef.current);
  }, [draw]);

  const selectCountry = useCallback(
    (outline: Outline) => {
      const country = countryById.get(outline.id);
      if (!country || !country.iso2) return;

      onSelectCountry(country);
      targetRef.current = viewForPoint(
        viewRef.current,
        outline.centroid[0],
        outline.centroid[1],
        Math.max(viewRef.current.zoom, 2.4),
      );
      setZoom((previous) => Math.max(previous, 2.4));
    },
    [countryById, onSelectCountry],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const wasMoved = drag.moved;
      const hit = pendingHitRef.current;

      dragRef.current = null;
      pendingHitRef.current = null;
      interactingRef.current = false;
      lastTouchRef.current = performance.now();
      svgRef.current?.releasePointerCapture(event.pointerId);
      setDragging(false);

      if (wasMoved || !hit) return;

      if (hit.kind === "country") {
        const outline = outlineById.get(hit.outlineId);
        if (outline) selectCountry(outline);
        return;
      }

      const marker = markersRef.current.find((entry) => entry.uuid === hit.uuid);
      if (marker) onPlayStation(marker);
    },
    [outlineById, selectCountry, onPlayStation],
  );

  const handleWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();

    targetRef.current = null;
    velocityRef.current = { lon: 0, lat: 0 };
    autoRotateRef.current = false;
    lastTouchRef.current = performance.now();

    const current = viewRef.current;
    const next = zoomTo(current, current.zoom * Math.exp(-event.deltaY * 0.0016));
    viewRef.current = next;
    setZoom((previous) => (Math.abs(previous - next.zoom) > 0.04 ? next.zoom : previous));
    draw(next, markersRef.current);
  }, [draw]);

  const handleReset = useCallback(() => {
    targetRef.current = { ...INITIAL_VIEW };
    velocityRef.current = { lon: 0, lat: 0 };
    setZoom(1);
    onSelectCountry(null);
  }, [onSelectCountry]);

  const outlines = geo?.outlines ?? [];
  const showReset = zoom > 1.05 || selectedIso2 !== null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-[#05070c]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={`block w-full touch-none select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ aspectRatio: "1 / 1", maxHeight: "62vh" } as CSSProperties}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label="世界电台分布地球仪，拖拽旋转"
      >
        <defs>
          <radialGradient id="globe-ocean" cx="36%" cy="28%" r="82%">
            <stop offset="0%" stopColor="#1d2a41" />
            <stop offset="55%" stopColor="#111a29" />
            <stop offset="100%" stopColor="#080c14" />
          </radialGradient>
          <radialGradient id="globe-atmosphere" cx="50%" cy="50%" r="50%">
            <stop offset="74%" stopColor="#f0a828" stopOpacity="0" />
            <stop offset="90%" stopColor="#f0a828" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f0a828" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="globe-shade" cx="34%" cy="28%" r="76%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.09" />
            <stop offset="62%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
          </radialGradient>
          <clipPath id="globe-clip">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={BASE_SCALE} />
          </clipPath>
        </defs>

        <rect width={SIZE} height={SIZE} fill="#05070c" />
        <g>
          {STARS.map((star, index) => (
            <circle
              key={index}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#cbd6e6"
              opacity={star.o}
            />
          ))}
        </g>

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={BASE_SCALE * 1.035}
          fill="url(#globe-atmosphere)"
          pointerEvents="none"
        />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={BASE_SCALE} fill="url(#globe-ocean)" />

        <g clipPath="url(#globe-clip)">
          <path
            ref={graticuleEl}
            fill="none"
            stroke="#243044"
            strokeWidth={0.4}
            pointerEvents="none"
          />

          {outlines.map((outline, index) => {
            const country = countryById.get(outline.id);
            return (
              <path
                key={outline.id}
                ref={(element) => {
                  countryEls.current[index] = element;
                }}
                className="atlas-country"
                style={{ fill: fillById.get(outline.id) ?? DENSITY_FILLS[0] }}
                data-iso2={country?.iso2 || undefined}
                data-selectable={country?.iso2 ? "true" : "false"}
                data-selected={
                  country?.iso2 && country.iso2 === selectedIso2 ? "true" : "false"
                }
                data-hovered={outline.id === hoveredId ? "true" : "false"}
                onMouseEnter={(event) => {
                  setHoveredId(outline.id);
                  const local = toLocal(event.clientX, event.clientY);
                  if (country && local) {
                    setHover({
                      kind: "country",
                      country,
                      x: local.x,
                      y: local.y,
                    });
                  }
                }}
                onMouseMove={(event) => {
                  const local = toLocal(event.clientX, event.clientY);
                  if (country && local) {
                    setHover({ kind: "country", country, x: local.x, y: local.y });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  setHover(null);
                }}
                data-outline-id={outline.id}
              />
            );
          })}

          <g>
            {markers.map((marker, index) => (
              <circle
                key={marker.uuid}
                ref={(element) => {
                  markerEls.current[index] = element;
                }}
                r={3}
                opacity={0}
                className="atlas-marker"
                data-marker-uuid={marker.uuid}
                onMouseEnter={(event) => {
                  const local = toLocal(event.clientX, event.clientY);
                  if (local) setHover({ kind: "station", marker, x: local.x, y: local.y });
                }}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </g>

        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={BASE_SCALE}
          fill="url(#globe-shade)"
          pointerEvents="none"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={BASE_SCALE}
          fill="none"
          stroke="#33405a"
          strokeWidth={0.8}
          pointerEvents="none"
        />
      </svg>

      {hover && <GlobeTooltip hover={hover} />}

      {!geo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="size-6 animate-spin rounded-full border-2 border-line border-t-accent" />
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 hidden rounded-xl border border-line/70 bg-surface-0/80 px-3 py-2 text-[11px] text-ink-muted backdrop-blur sm:block">
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

      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 text-[11px] text-ink-muted">
        {markersLoading ? (
          <>
            <span className="size-3 animate-spin rounded-full border-2 border-ink-muted/30 border-t-ink-muted" />
            加载光点…
          </>
        ) : (
          <>
            <span className="tabular-nums">{markers.length}</span>
            <span>个已知坐标电台</span>
          </>
        )}
      </div>

      {showReset && (
        <button
          type="button"
          onClick={handleReset}
          className="absolute right-4 top-4 rounded-xl border border-line bg-surface-0/80 px-3 py-1.5 text-xs text-ink-muted backdrop-blur transition hover:border-accent/60 hover:text-ink"
        >
          重置 · {zoom.toFixed(1)}×
        </button>
      )}
    </div>
  );
}

function GlobeTooltip({ hover }: { hover: Hover }) {
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface-0/95 px-3 py-2 text-xs shadow-2xl backdrop-blur"
      style={{ left: hover.x, top: hover.y - 14 }}
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
