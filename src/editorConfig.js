export const TRANSLATION_SNAP = 0.05;
export const ROTATION_SNAP_DEGREES = 1;
export const GIZMO_SIZE = 1.05;

export function snapToStep(value, step) {
  return Math.round(value / step) * step;
}
