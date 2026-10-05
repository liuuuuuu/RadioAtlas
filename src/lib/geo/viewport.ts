/**
 * Pure viewport math for the world map.
 *
 * A viewport maps viewBox coordinates `p` to screen coordinates via
 * `p * scale + translate`. Extracted from the component so the fiddly parts
 * (zoom clamping, keeping the map covering the frame, framing a country) can be
 * unit-tested without a DOM.
 */

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 18;

export const INITIAL_VIEW: Viewport = { scale: 1, tx: 0, ty: 0 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Keep the projected world covering the frame: content spans
 * [tx, tx + width * scale], so we need tx <= 0 and tx >= width - width * scale.
 */
export function clampView(view: Viewport, width: number, height: number): Viewport {
  if (view.scale <= MIN_SCALE) return INITIAL_VIEW;

  return {
    scale: view.scale,
    tx: clamp(view.tx, width - width * view.scale, 0),
    ty: clamp(view.ty, height - height * view.scale, 0),
  };
}

/** Frame a country's bounding box with a little breathing room. */
export function fitToBox(box: Box, width: number, height: number): Viewport {
  const padding = 1.8;
  const scale = clamp(
    Math.min(
      width / (Math.max(box.width, 1) * padding),
      height / (Math.max(box.height, 1) * padding),
    ),
    MIN_SCALE,
    MAX_SCALE,
  );

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  return clampView({ scale, tx: width / 2 - cx * scale, ty: height / 2 - cy * scale }, width, height);
}

/** Zoom about a fixed point, keeping whatever is under the cursor in place. */
export function zoomAt(
  view: Viewport,
  point: { x: number; y: number },
  factor: number,
  width: number,
  height: number,
): Viewport {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  if (scale === view.scale) return view;

  const ratio = scale / view.scale;

  return clampView(
    {
      scale,
      tx: point.x - ratio * (point.x - view.tx),
      ty: point.y - ratio * (point.y - view.ty),
    },
    width,
    height,
  );
}
