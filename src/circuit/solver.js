// Small resistive solver. Wires and a closed switch are nearly zero ohms.
// Each bulb is 1 ohm. Brightness follows current relative to one bulb on a 1.5 V cell.
// A zero-ohm path from + to − is a short: no win, bulbs stay dark.

const WIRE_G = 500;
const BULB_OHMS = 1;
const I_REF = 1.5 / BULB_OHMS;
const LEAK = 1e-6;

function pairKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

export function progressOf(links, required) {
  const have = new Set();
  for (const link of links) {
    if (!link || !link[0] || !link[1] || link[0] === link[1]) continue;
    have.add(pairKey(link[0], link[1]));
  }
  let made = 0;
  for (const [a, b] of required) {
    if (have.has(pairKey(a, b))) made += 1;
  }
  return { made, need: required.length };
}

function find(parent, x) {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

function unite(parent, a, b) {
  const pa = find(parent, a);
  const pb = find(parent, b);
  if (pa !== pb) parent[pa] = pb;
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) continue;
    const tmp = M[col];
    M[col] = M[pivot];
    M[pivot] = tmp;
    const div = M[col][col];
    for (let k = col; k <= n; k++) M[col][k] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }
  return M.map((row) => row[n]);
}

export function solveCircuit({ bulbs, switches, battery, links }) {
  const plus = battery.plus;
  const minus = battery.minus;
  const volts = battery.volts;
  const brightness = {};
  const current = {};
  for (const bulb of bulbs) {
    brightness[bulb.id] = 0;
    current[bulb.id] = 0;
  }

  const parent = {};
  const ensure = (id) => {
    if (parent[id] == null) parent[id] = id;
  };
  ensure(plus);
  ensure(minus);
  for (const bulb of bulbs) {
    ensure(bulb.a);
    ensure(bulb.b);
  }
  for (const sw of switches) {
    ensure(sw.a);
    ensure(sw.b);
  }
  for (const link of links) {
    if (!link[0] || !link[1]) continue;
    ensure(link[0]);
    ensure(link[1]);
    unite(parent, link[0], link[1]);
  }
  for (const sw of switches) {
    if (sw.on) unite(parent, sw.a, sw.b);
  }
  const short = find(parent, plus) === find(parent, minus);
  if (short || bulbs.length === 0) {
    return { short, brightness, current };
  }

  const fixed = new Map([[plus, volts], [minus, 0]]);
  const unknown = [];
  for (const id of Object.keys(parent)) {
    if (!fixed.has(id)) unknown.push(id);
  }
  const index = new Map(unknown.map((id, i) => [id, i]));
  const n = unknown.length;
  const G = Array.from({ length: n }, () => Array(n).fill(0));
  const I = Array(n).fill(0);
  for (let i = 0; i < n; i++) G[i][i] += LEAK;

  const stamp = (a, b, g) => {
    const va = fixed.has(a) ? fixed.get(a) : null;
    const vb = fixed.has(b) ? fixed.get(b) : null;
    const ia = index.has(a) ? index.get(a) : null;
    const ib = index.has(b) ? index.get(b) : null;
    if (ia != null) G[ia][ia] += g;
    if (ib != null) G[ib][ib] += g;
    if (ia != null && ib != null) {
      G[ia][ib] -= g;
      G[ib][ia] -= g;
    }
    if (ia != null && vb != null) I[ia] += g * vb;
    if (ib != null && va != null) I[ib] += g * va;
  };

  for (const link of links) {
    if (!link[0] || !link[1] || link[0] === link[1]) continue;
    stamp(link[0], link[1], WIRE_G);
  }
  for (const sw of switches) {
    if (sw.on) stamp(sw.a, sw.b, WIRE_G);
  }
  for (const bulb of bulbs) {
    stamp(bulb.a, bulb.b, 1 / (bulb.ohms || BULB_OHMS));
  }

  const voltsAt = new Map(fixed);
  if (n > 0) {
    const solved = solveLinear(G, I);
    unknown.forEach((id, i) => voltsAt.set(id, solved[i]));
  }

  for (const bulb of bulbs) {
    const g = 1 / (bulb.ohms || BULB_OHMS);
    const amps = g * ((voltsAt.get(bulb.a) || 0) - (voltsAt.get(bulb.b) || 0));
    const mag = Math.abs(amps);
    current[bulb.id] = mag;
    const ratio = mag / I_REF;
    brightness[bulb.id] = Math.max(0, Math.min(1, ratio ** 1.1));
  }
  return { short, brightness, current };
}

export function evaluate(level, { links, switchOn }) {
  const bulbs = level.bulbs.map((id) => ({ id, a: id + 'A', b: id + 'B', ohms: 1 }));
  const switches = level.switch ? [{ a: 'swL', b: 'swR', on: !!switchOn }] : [];
  const solved = solveCircuit({
    bulbs,
    switches,
    battery: { plus: 'bat+', minus: 'bat-', volts: 1.5 },
    links,
  });
  const progress = progressOf(links, level.links);
  let won = false;
  if (!solved.short && progress.made === progress.need && (!level.switch || switchOn)) {
    if (level.goal === 'full') {
      won = level.bulbs.every((id) => solved.brightness[id] >= 0.75);
    } else if (level.goal === 'series') {
      won = level.bulbs.length >= 2 && level.bulbs.every((id) => {
        const value = solved.brightness[id];
        return value >= 0.22 && value < 0.75;
      });
    }
  }
  return { ...solved, progress, won };
}
