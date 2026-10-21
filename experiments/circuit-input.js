// Pure picking math for the circuit. Distances are metres in world space, so a
// 4–5 cm target stays the same hit from 10 cm or from 1 m.

export const HIT_RADIUS = 0.045;
export const SWITCH_RADIUS = 0.055;
export const DRAG_SNAP = 0.06;
export const DRAG_ARM = 0.04;
export const ASSIST_AFTER = 20;

export const STEPS = [
  { wire: 'red', end: 'a', terminal: 'bat+' },
  { wire: 'red', end: 'b', terminal: 'swL' },
  { wire: 'blue', end: 'a', terminal: 'swR' },
  { wire: 'blue', end: 'b', terminal: 'bulbA' },
  { wire: 'black', end: 'a', terminal: 'bulbB' },
  { wire: 'black', end: 'b', terminal: 'bat-' },
];

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

export function nextStep(snaps, switchOn) {
  for (const step of STEPS) {
    const pair = snaps[step.wire] || [null, null];
    const current = step.end === 'a' ? pair[0] : pair[1];
    if (current !== step.terminal) return step;
  }
  if (!switchOn) return { switch: true };
  return null;
}

export function smoothToward(prev, next, dt, tau = 0.09) {
  const a = 1 - Math.exp(-Math.max(0, dt) / tau);
  return [
    prev[0] + (next[0] - prev[0]) * a,
    prev[1] + (next[1] - prev[1]) * a,
    prev[2] + (next[2] - prev[2]) * a,
  ];
}
