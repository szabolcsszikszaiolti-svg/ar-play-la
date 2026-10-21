// Ray distance in metres. A 4.5 cm target is the same size up close or at arm's length.

export const HIT_RADIUS = 0.045;
export const SWITCH_RADIUS = 0.055;
export const TAP_PX = 8;
export const TAP_MS = 300;

export function distanceToRay(origin, direction, point) {
  const ox = point[0] - origin[0];
  const oy = point[1] - origin[1];
  const oz = point[2] - origin[2];
  const along = ox * direction[0] + oy * direction[1] + oz * direction[2];
  if (along < 0) return Infinity;
  const dx = point[0] - (origin[0] + direction[0] * along);
  const dy = point[1] - (origin[1] + direction[1] * along);
  const dz = point[2] - (origin[2] + direction[2] * along);
  return Math.hypot(dx, dy, dz);
}

export function pickNearest(origin, direction, targets) {
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    const radius = t.radius ?? HIT_RADIUS;
    const d = distanceToRay(origin, direction, t.point);
    if (d <= radius && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best ? { target: best, distance: bestD } : null;
}

export function isTap(movedPx, elapsedMs) {
  return movedPx < TAP_PX && elapsedMs < TAP_MS;
}
