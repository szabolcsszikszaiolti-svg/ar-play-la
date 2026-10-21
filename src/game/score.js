// Place comes from relative time (actual / par). Points follow the place table in §4.2.
// Stars compare the same finish with the player's own par (§8).

export const PLACE_POINTS = [10, 7, 5, 3, 2, 1];
export const MIN_FINISH_MS = 1500;

export function pointsForPlace(place) {
  if (place < 1) return 0;
  if (place <= PLACE_POINTS.length) return PLACE_POINTS[place - 1];
  return 1;
}

export function starsFor(elapsedSec, par) {
  if (elapsedSec == null || !(par > 0)) return 0;
  if (elapsedSec <= par) return 3;
  if (elapsedSec <= par * 1.5) return 2;
  return 1;
}

export function relativeTime(elapsedSec, par) {
  return elapsedSec / par;
}

export function formatSeconds(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const rounded = Math.round(sec * 10) / 10;
  return rounded.toFixed(1).replace('.', ',') + ' s';
}

export function formatFactor(rel) {
  if (rel == null || !Number.isFinite(rel)) return '—';
  return (Math.round(rel * 100) / 100).toFixed(2).replace('.', ',') + '×';
}

export function starGlyphs(count) {
  const n = Math.max(0, Math.min(3, count | 0));
  return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
}
