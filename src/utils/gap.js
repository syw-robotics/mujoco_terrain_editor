import { getWorldBounds } from './grounding.js';

const TOUCH_EPSILON = 1e-4;

function separate(minA, maxA, minB, maxB) {
  if (maxA <= minB) return { gap: minB - maxA, moverSign: 1 };
  if (maxB <= minA) return { gap: minA - maxB, moverSign: -1 };
  const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
  const moverSign = (minB + maxB) >= (minA + maxA) ? 1 : -1;
  return { gap: -overlap, moverSign };
}

export function measureAxis(anchor, mover, axis) {
  const a = getWorldBounds(anchor);
  const b = getWorldBounds(mover);
  const other = axis === 0 ? 1 : 0;
  const separation = separate(a.min[axis], a.max[axis], b.min[axis], b.max[axis]);
  return {
    axis,
    gap: separation.gap,
    moverSign: separation.moverSign,
    anchorEdge: separation.moverSign > 0 ? a.max[axis] : a.min[axis],
    moverEdge: separation.moverSign > 0 ? b.min[axis] : b.max[axis],
    overlapMin: Math.max(a.min[other], b.min[other]),
    overlapMax: Math.min(a.max[other], b.max[other]),
    z: Math.max(a.max[2], b.max[2]),
  };
}

function overlaps(gap) {
  return gap < -TOUCH_EPSILON;
}

function separated(gap) {
  return gap > TOUCH_EPSILON;
}

// A jump gap exists on one horizontal axis when the footprints are apart on
// that axis and still overlap on the other. Diagonal pairs have no single gap.
export function findFacingGap(anchor, mover) {
  if (!anchor || !mover) return null;
  const x = measureAxis(anchor, mover, 0);
  const y = measureAxis(anchor, mover, 1);
  if (separated(x.gap) && overlaps(y.gap)) return x;
  if (separated(y.gap) && overlaps(x.gap)) return y;
  if (Math.abs(x.gap) <= TOUCH_EPSILON && overlaps(y.gap)) return { ...x, gap: 0 };
  if (Math.abs(y.gap) <= TOUCH_EPSILON && overlaps(x.gap)) return { ...y, gap: 0 };
  return null;
}
