// Pure math for the share-viewer pan/zoom engine (PublicInvoicePage).
//
// The viewer is an ISOLATED fixed container: the page itself never scrolls or
// pans, so the engine owns every document pixel with one transform —
// translate(x, y) scale(s) — applied to the absolutely-positioned paper inside
// the surface. Everything here is surface-relative and side-effect free so the
// gesture code stays thin and the contract is unit-testable (scripts/panZoom.test.mjs).
//
// Coordinates: x/y are the paper's translate in SURFACE pixels, with the paper
// laid out at its natural (unscaled) size anchored at the surface's top-left.
// fx/fy are finger positions in the same space. Zoom keeps the document point
// under the finger nailed to it — the same contract Chrome's PDF viewer uses.

export const VELOCITY_EPS = 0.02; // px/ms below which a flick is finished

/** Ease-out cubic — the one easing curve for every programmatic zoom. */
export function easeOutCubic(t) {
  const k = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - k, 3);
}

/** Overscroll resistance for ONE axis value: beyond the bound the translate
 * travels asymptotically less the further it goes (rubber band) — used while
 * a gesture is LIVE only; the settle path uses hard clampPan. */
function rubberValue(v, min, max, dim) {
  const reach = Math.max(60, dim * 0.35);
  const soft = (excess) => reach * (1 - 1 / (excess / reach + 1));
  if (v < min) return min - soft(min - v);
  if (v > max) return max + soft(v - max);
  return v;
}

/** Soft-clamp a translate pair while dragging/pinching past the edges. */
export function rubberPan(view, bounds, surfaceW, surfaceH) {
  return {
    x: rubberValue(view.x, bounds.xMin, bounds.xMax, surfaceW),
    y: rubberValue(view.y, bounds.yMin, bounds.yMax, surfaceH),
  };
}

/**
 * Pan range for a given scale. A document that fits stays PINNED (centred
 * horizontally, flush under the top bar vertically — pinned means both range
 * ends are equal, so clamped pan has nothing to slide). A document larger than
 * the surface is FREEHAND: the range spans the entire overflow on that axis,
 * so a drag can park either edge flush with the surface edge.
 */
export function panBounds({ surfaceW, surfaceH, contentW, contentH, scale }) {
  const w = contentW * scale;
  const h = contentH * scale;
  const freeX = w > surfaceW + 1e-6;
  const freeY = h > surfaceH + 1e-6;
  return {
    freeX,
    freeY,
    // Pinned-centred when the axis fits (both ends equal → clamp is a no-op).
    xMin: freeX ? surfaceW - w : (surfaceW - w) / 2,
    xMax: freeX ? 0 : (surfaceW - w) / 2,
    yMin: freeY ? surfaceH - h : 0,
    yMax: freeY ? 0 : 0,
  };
}

/** Clamp a translate pair into its bounds (never flings the sheet off-screen). */
export function clampPan(view, bounds) {
  const x = Math.min(bounds.xMax, Math.max(bounds.xMin, view.x));
  const y = Math.min(bounds.yMax, Math.max(bounds.yMin, view.y));
  return { x, y };
}

/** Zoom band guard. */
export function clampScale(s, min, max) {
  return Math.min(max, Math.max(min, s));
}

/**
 * Zoom to `sNext` about focal point (fx, fy). `docPoint` is the unprojected
 * document point under the finger at the CURRENT view ({nx, ny}); the new
 * translate is laid out so the same document point still sits under the same
 * screen point, then clamped into the new bounds.
 */
export function anchorZoom(view, docPoint, fx, fy, sNext, bounds) {
  const x = fx - docPoint.nx * sNext;
  const y = fy - docPoint.ny * sNext;
  const clamped = clampPan({ x, y }, bounds);
  return { s: sNext, x: clamped.x, y: clamped.y };
}

/** Unproject a screen point on the surface into document coordinates. */
export function toDocPoint(view, fx, fy) {
  return { nx: (fx - view.x) / view.s, ny: (fy - view.y) / view.s };
}

/**
 * Flick-inertia decay, platform-style: keep a fraction of the velocity per
 * 16.7ms frame, scaled by the actual frame's delta time so slow frames (jank)
 * decay harder per call. Returns 0-padded velocity; callers stop when it
 * falls under VELOCITY_EPS or the sheet reaches a bound.
 */
export function decayVelocity(v, dtMs) {
  const dt = Math.max(1, Math.min(64, dtMs));
  const next = v * Math.pow(0.94, dt / 16.7);
  return Math.abs(next) < VELOCITY_EPS ? 0 : next;
}
