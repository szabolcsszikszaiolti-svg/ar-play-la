import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HIT_RADIUS, DRAG_SNAP, distanceToRay, pickNearest, nextStep, smoothToward,
} from './circuit-input.js';

test('a ray through a point is a hit at 10 cm and at 1 m', () => {
  const point = [0.02, 0.03, 0.08];
  for (const along of [0.1, 1]) {
    const origin = [point[0], point[1] + along, point[2]];
    const dir = [0, -1, 0];
    assert.ok(distanceToRay(origin, dir, point) < 1e-9);
    const hit = pickNearest(origin, dir, [
      { id: 'end', point, radius: HIT_RADIUS },
    ]);
    assert.equal(hit.target.id, 'end');
  }
});

test('4 cm beside the ray still hits, 6 cm does not', () => {
  const origin = [0, 1, 0];
  const dir = [0, -1, 0];
  const near = { id: 'near', point: [0.04, 0.02, 0], radius: HIT_RADIUS };
  const far = { id: 'far', point: [0.06, 0.02, 0], radius: HIT_RADIUS };
  assert.ok(Math.abs(distanceToRay(origin, dir, near.point) - 0.04) < 1e-9);
  assert.equal(pickNearest(origin, dir, [far, near]).target.id, 'near');
  assert.equal(pickNearest(origin, dir, [far]), null);
});

test('points behind the ray are ignored', () => {
  const d = distanceToRay([0, 0, 0], [0, 0, -1], [0, 0, 0.2]);
  assert.equal(d, Infinity);
  assert.equal(pickNearest([0, 0, 0], [0, 0, -1], [{ id: 'back', point: [0, 0, 0.2] }]), null);
});

test('the nearer target wins when both are inside their radius', () => {
  const origin = [0, 0.5, 0];
  const dir = [0, -1, 0];
  const hit = pickNearest(origin, dir, [
    { id: 'switch', point: [0.03, 0.02, 0], radius: 0.055 },
    { id: 'screw', point: [0.01, 0.02, 0], radius: HIT_RADIUS },
  ]);
  assert.equal(hit.target.id, 'screw');
  assert.ok(hit.distance < DRAG_SNAP);
});

test('assist walks the canonical loop, then the switch', () => {
  const none = { red: [null, null], blue: [null, null], black: [null, null] };
  assert.deepEqual(nextStep(none, false), { wire: 'red', end: 'a', terminal: 'bat+' });
  const redDone = { red: ['bat+', 'swL'], blue: [null, null], black: [null, null] };
  assert.equal(nextStep(redDone, false).wire, 'blue');
  const wired = {
    red: ['bat+', 'swL'],
    blue: ['swR', 'bulbA'],
    black: ['bulbB', 'bat-'],
  };
  assert.deepEqual(nextStep(wired, false), { switch: true });
  assert.equal(nextStep(wired, true), null);
});

test('the drag filter moves part way and does not overshoot', () => {
  const mid = smoothToward([0, 0, 0], [0.1, 0, 0], 0.09, 0.09);
  assert.ok(mid[0] > 0.05 && mid[0] < 0.08);
  assert.equal(mid[1], 0);
  const there = smoothToward([0, 0, 0], [0.1, 0, 0], 2, 0.09);
  assert.ok(there[0] > 0.099 && there[0] <= 0.1);
});
