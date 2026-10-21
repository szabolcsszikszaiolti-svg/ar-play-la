import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, progressOf } from '../src/circuit/solver.js';
import { LEVELS, levelMeta } from '../src/circuit/levels.js';
import { createMatch, apply, viewOf, elimRule } from '../src/game/match.js';
import { createClock, notePong, serverTime } from '../src/game/clock.js';
import { normalizeCode, roomCode, pickNick, CODE_ALPHABET } from '../src/names.js';
import { pointsForPlace, starsFor } from '../src/game/score.js';
import { isTap as tapGesture } from '../src/circuit/pick.js';

const meta = LEVELS.map(levelMeta);

function hostMatch(practice = false) {
  return createMatch({ code: 'K7QZ', hostId: 'h', levels: meta, practice });
}

function play(state, now) {
  apply(state, { t: 'start', id: 'h' }, now);
  apply(state, { t: 'tick' }, state.startAt);
  assert.equal(state.phase, 'play');
}

test('series bulbs are dimmer than one bulb, and a short does not win', () => {
  const single = evaluate(LEVELS[0], {
    links: [['bat+', 'b1A'], ['bat-', 'b1B']],
    switchOn: false,
  });
  assert.equal(single.short, false);
  assert.equal(single.won, true);
  assert.ok(single.brightness.b1 >= 0.9, 'single bulb should be nearly full, got ' + single.brightness.b1);

  const series = evaluate(LEVELS[2], {
    links: [['bat+', 'b1A'], ['b1B', 'b2A'], ['b2B', 'bat-']],
    switchOn: false,
  });
  assert.equal(series.won, true);
  assert.ok(series.brightness.b1 < 0.7 && series.brightness.b1 > 0.3, series.brightness.b1);
  assert.ok(Math.abs(series.brightness.b1 - series.brightness.b2) < 0.05);
  assert.ok(series.brightness.b1 < single.brightness.b1 * 0.7);

  const parallel = evaluate(LEVELS[2], {
    links: [['bat+', 'b1A'], ['bat+', 'b2A'], ['b1B', 'bat-'], ['b2B', 'bat-']],
    switchOn: false,
  });
  assert.equal(parallel.won, false, 'full parallel is not the series goal');
  assert.ok(parallel.brightness.b1 > 0.9);

  const off = evaluate(LEVELS[1], {
    links: [['bat+', 'swL'], ['swR', 'b1A'], ['b1B', 'bat-']],
    switchOn: false,
  });
  assert.equal(off.won, false);
  assert.equal(off.brightness.b1, 0);

  const on = evaluate(LEVELS[1], {
    links: [['bat+', 'swL'], ['swR', 'b1A'], ['b1B', 'bat-']],
    switchOn: true,
  });
  assert.equal(on.won, true);

  const shorted = evaluate(LEVELS[0], { links: [['bat+', 'bat-']], switchOn: false });
  assert.equal(shorted.short, true);
  assert.equal(shorted.won, false);
  assert.equal(shorted.brightness.b1, 0);

  assert.deepEqual(progressOf([['b1A', 'bat+'], ['bat-', 'b1B']], LEVELS[0].links), { made: 2, need: 2 });
  assert.deepEqual(progressOf([['bat+', 'b1A']], LEVELS[0].links), { made: 1, need: 2 });
});

test('points mode ranks by relative time and pays 10/7/5/3', () => {
  const state = hostMatch();
  apply(state, { t: 'join', id: 'h', nick: 'Ursul Isteț', age: 'mid' }, 0);
  apply(state, { t: 'join', id: 'a', nick: 'Vulpea Rapidă', age: 'small' }, 0);
  apply(state, { t: 'join', id: 'b', nick: 'Pisica Curioasă', age: 'mid' }, 0);
  apply(state, { t: 'mode', id: 'h', mode: 'points' }, 0);
  play(state, 1000);
  const start = state.startAt;
  // small par 45, 40s -> 0.889× ; mid par 30, 30s -> 1× ; mid 50s -> 1.67×
  apply(state, { t: 'finish', id: 'a', at: start + 40000 }, start + 50000);
  apply(state, { t: 'finish', id: 'h', at: start + 30000 }, start + 50000);
  apply(state, { t: 'finish', id: 'b', at: start + 50000 }, start + 50000);
  apply(state, { t: 'tick' }, start + 50000);
  assert.equal(state.phase, 'round');
  const ids = state.round.ranking.map((row) => row.id);
  assert.deepEqual(ids, ['a', 'h', 'b']);
  assert.deepEqual(state.round.ranking.map((row) => row.points), [10, 7, 5]);
  assert.equal(state.round.ranking[0].stars, 3);
  assert.equal(state.round.ranking[2].stars, 1);
  assert.equal(pointsForPlace(4), 3);
  assert.equal(starsFor(30, 30), 3);
  assert.equal(starsFor(40, 30), 2);
  assert.equal(starsFor(50, 30), 1);
});

test('a too-fast finish is ignored', () => {
  const state = hostMatch();
  apply(state, { t: 'join', id: 'h', nick: 'Ursul Isteț', age: 'mid' }, 0);
  apply(state, { t: 'join', id: 'a', nick: 'Vulpea Rapidă', age: 'mid' }, 0);
  play(state, 0);
  apply(state, { t: 'finish', id: 'a', at: state.startAt + 400 }, state.startAt + 400);
  assert.equal(playerFinish(state, 'a'), null);
  apply(state, { t: 'finish', id: 'a', at: state.startAt + 2000 }, state.startAt + 2000);
  assert.equal(playerFinish(state, 'a'), state.startAt + 2000);
});

test('two players in elimination play all three levels', () => {
  assert.equal(elimRule('elim', 2), 'bestof3');
  assert.equal(elimRule('elim', 3), 'knockout');
  const state = hostMatch();
  apply(state, { t: 'join', id: 'h', nick: 'Ursul Isteț', age: 'mid' }, 0);
  apply(state, { t: 'join', id: 'a', nick: 'Vulpea Rapidă', age: 'mid' }, 0);
  apply(state, { t: 'mode', id: 'h', mode: 'elim' }, 0);
  play(state, 0);
  assert.equal(state.rule, 'bestof3');
  finishPair(state, 'a', 'h');
  apply(state, { t: 'next', id: 'h' }, state.startAt + 20000);
  assert.equal(state.phase, 'countdown');
  assert.equal(state.players.every((p) => !p.out), true);
  apply(state, { t: 'tick' }, state.startAt);
  finishPair(state, 'a', 'h');
  apply(state, { t: 'next', id: 'h' }, state.startAt + 20000);
  apply(state, { t: 'tick' }, state.startAt);
  finishPair(state, 'h', 'a');
  apply(state, { t: 'next', id: 'h' }, state.startAt + 20000);
  assert.equal(state.phase, 'podium');
  const view = viewOf(state, 0, 'h');
  assert.equal(view.podium[0].id, 'a');
  assert.ok(view.podium[0].roundWins > view.podium[1].roundWins);
});

test('three players, slowest is out, match ends after two rounds', () => {
  const state = hostMatch();
  for (const [id, nick] of [['h', 'Ursul Isteț'], ['a', 'Vulpea Rapidă'], ['b', 'Pisica Curioasă']]) {
    apply(state, { t: 'join', id, nick, age: 'mid' }, 0);
  }
  apply(state, { t: 'mode', id: 'h', mode: 'elim' }, 0);
  play(state, 0);
  assert.equal(state.rule, 'knockout');
  const start = state.startAt;
  apply(state, { t: 'finish', id: 'a', at: start + 5000 }, start + 20000);
  apply(state, { t: 'finish', id: 'h', at: start + 8000 }, start + 20000);
  apply(state, { t: 'progress', id: 'b', made: 1, need: 2 }, start + 9000);
  apply(state, { t: 'tick' }, start + 60000);
  apply(state, { t: 'next', id: 'h' }, start + 61000);
  assert.equal(state.players.find((p) => p.id === 'b').out, true);
  assert.equal(state.phase, 'countdown');
  apply(state, { t: 'tick' }, state.startAt);
  const start2 = state.startAt;
  apply(state, { t: 'finish', id: 'h', at: start2 + 4000 }, start2 + 10000);
  apply(state, { t: 'finish', id: 'a', at: start2 + 7000 }, start2 + 10000);
  apply(state, { t: 'tick' }, start2 + 10000);
  apply(state, { t: 'next', id: 'h' }, start2 + 11000);
  assert.equal(state.phase, 'podium');
  assert.equal(viewOf(state, 0, 'h').podium[0].id, 'h');
  assert.equal(state.levelIndex, 1);
});

test('a player who leaves mid-race is out, and the host can close the room', () => {
  const state = hostMatch();
  apply(state, { t: 'join', id: 'h', nick: 'Ursul Isteț', age: 'mid' }, 0);
  apply(state, { t: 'join', id: 'a', nick: 'Vulpea Rapidă', age: 'mid' }, 0);
  play(state, 0);
  apply(state, { t: 'leave', id: 'a' }, state.startAt + 2000);
  assert.equal(state.players.find((p) => p.id === 'a').out, true);
  apply(state, { t: 'close', reason: 'host' }, 0);
  assert.equal(state.phase, 'closed');
  assert.equal(viewOf(state, 0, 'a').closedReason, 'host');
});

test('clock offset uses the median ping', () => {
  const clock = createClock();
  notePong(clock, 1000, 5000, 1200);
  notePong(clock, 2000, 6100, 2300);
  notePong(clock, 3000, 9000, 4000);
  assert.equal(clock.offset, 3950);
  assert.equal(serverTime(clock, 10000), 13950);
});

test('codes skip ambiguous letters and nicks come from the list', () => {
  assert.equal(normalizeCode('k7qz'), 'K7QZ');
  assert.equal(normalizeCode('O0I1AB'), 'AB');
  const code = roomCode(() => 0);
  assert.equal(code, 'AAAA');
  assert.ok([...code].every((ch) => CODE_ALPHABET.includes(ch)));
  const nick = pickNick(() => 0, ['Vulpea Rapidă']);
  assert.equal(nick, 'Ursul Isteț');
  assert.equal(tapGesture(7, 299), true);
  assert.equal(tapGesture(8, 100), false);
  assert.equal(tapGesture(3, 300), false);
});

function playerFinish(state, id) {
  return state.players.find((p) => p.id === id).finishAt;
}

function finishPair(state, winner, loser) {
  const start = state.startAt;
  apply(state, { t: 'finish', id: winner, at: start + 4000 }, start + 12000);
  apply(state, { t: 'finish', id: loser, at: start + 8000 }, start + 12000);
  apply(state, { t: 'tick' }, start + 12000);
  assert.equal(state.phase, 'round');
}
