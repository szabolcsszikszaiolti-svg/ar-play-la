import { pointsForPlace, starsFor, MIN_FINISH_MS } from './score.js';

export const COUNTDOWN_MS = 3000;
export const MAX_PLAYERS = 4;

function fresh(event) {
  return {
    id: event.id,
    nick: event.nick,
    age: event.age || 'mid',
    made: 0,
    need: 0,
    finishAt: null,
    lastStepAt: null,
    out: false,
    connected: true,
    points: 0,
    roundWins: 0,
    relSum: 0,
    stars: 0,
    starSum: 0,
    elimAt: null,
  };
}

export function createMatch({ code, hostId, levels, practice = false }) {
  return {
    code,
    hostId,
    practice: !!practice,
    phase: 'lobby',
    mode: 'points',
    rule: null,
    levelIndex: 0,
    levels,
    startAt: null,
    players: [],
    round: null,
    closedReason: null,
    seq: 0,
  };
}

function player(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function active(state) {
  return state.players.filter((p) => p.connected && !p.out);
}

export function elimRule(mode, count) {
  if (mode !== 'elim') return 'points';
  return count <= 2 ? 'bestof3' : 'knockout';
}

function beginCountdown(state, now) {
  state.phase = 'countdown';
  state.startAt = now + COUNTDOWN_MS;
  state.round = null;
  const level = state.levels[state.levelIndex];
  for (const p of state.players) {
    if (p.out || !p.connected) continue;
    p.made = 0;
    p.need = level.need;
    p.finishAt = null;
    p.stars = 0;
    p.lastStepAt = null;
  }
}

function rankLevel(state) {
  const level = state.levels[state.levelIndex];
  const rows = [];
  for (const p of state.players) {
    if (p.out) continue;
    if (!p.connected && p.finishAt == null) continue;
    const par = level.par[p.age] || level.par.mid;
    const elapsedMs = p.finishAt != null ? p.finishAt - state.startAt : null;
    const valid = elapsedMs != null && elapsedMs >= MIN_FINISH_MS;
    const elapsed = valid ? elapsedMs / 1000 : null;
    const rel = elapsed != null ? elapsed / par : null;
    rows.push({
      id: p.id,
      nick: p.nick,
      age: p.age,
      elapsed,
      rel,
      par,
      made: p.made,
      need: p.need,
      lastStepAt: p.lastStepAt,
      stars: elapsed != null ? starsFor(elapsed, par) : 0,
    });
  }
  rows.sort((a, b) => {
    const af = a.elapsed == null ? 1 : 0;
    const bf = b.elapsed == null ? 1 : 0;
    if (af !== bf) return af - bf;
    if (a.elapsed != null && b.elapsed != null && a.rel !== b.rel) return a.rel - b.rel;
    if ((a.made || 0) !== (b.made || 0)) return (b.made || 0) - (a.made || 0);
    return (a.lastStepAt ?? Infinity) - (b.lastStepAt ?? Infinity);
  });
  return rows.map((row, index) => ({
    ...row,
    place: index + 1,
    points: row.elapsed != null ? pointsForPlace(index + 1) : 0,
  }));
}

function applyScores(state, ranking) {
  let winners = 0;
  for (const row of ranking) {
    if (row.place === 1 && row.elapsed != null) winners += 1;
  }
  for (const row of ranking) {
    const p = player(state, row.id);
    if (!p) continue;
    p.points += row.points;
    p.stars = row.stars;
    p.starSum += row.stars;
    if (row.elapsed != null) p.relSum += row.rel;
    else p.relSum += 5;
    if (row.place === 1 && row.elapsed != null) p.roundWins += 1 / winners;
  }
}

function endPlay(state) {
  if (state.phase !== 'play') return;
  const ranking = rankLevel(state);
  state.round = {
    levelIndex: state.levelIndex,
    levelId: state.levels[state.levelIndex].id,
    title: state.levels[state.levelIndex].title,
    ranking,
  };
  applyScores(state, ranking);
  state.phase = 'round';
}

function podiumOf(state) {
  const list = state.players.filter((p) => p.connected || p.points || p.roundWins || p.finishAt != null || p.out);
  const ranked = list.slice().sort((a, b) => {
    if (state.rule === 'knockout') {
      if (a.out !== b.out) return a.out ? 1 : -1;
      return (b.elimAt ?? -1) - (a.elimAt ?? -1);
    }
    if (state.rule === 'bestof3') {
      if (a.roundWins !== b.roundWins) return b.roundWins - a.roundWins;
    } else if (a.points !== b.points) return b.points - a.points;
    if (a.relSum !== b.relSum) return a.relSum - b.relSum;
    return a.nick.localeCompare(b.nick, 'ro');
  });
  return ranked.map((p, i) => ({
    place: i + 1,
    id: p.id,
    nick: p.nick,
    points: Math.round(p.points * 10) / 10,
    roundWins: p.roundWins,
    stars: p.starSum,
  }));
}

function advance(state, now) {
  if (state.rule === 'knockout') {
    const ranking = (state.round && state.round.ranking) || [];
    const worst = ranking[ranking.length - 1];
    if (worst) {
      const p = player(state, worst.id);
      if (p && !p.out) {
        p.out = true;
        p.elimAt = state.levelIndex;
      }
    }
    if (active(state).length <= 1) {
      state.phase = 'podium';
      return;
    }
  }
  if (state.levelIndex + 1 >= state.levels.length) {
    state.phase = 'podium';
    return;
  }
  state.levelIndex += 1;
  beginCountdown(state, now);
}

export function apply(state, event, now) {
  if (state.closedReason) return state;
  const before = state.phase + ':' + state.levelIndex + ':' + state.players.length;
  let changed = false;
  const touch = () => { changed = true; };

  switch (event.t) {
    case 'join': {
      if (state.phase !== 'lobby') break;
      if (player(state, event.id)) break;
      if (state.players.length >= MAX_PLAYERS) break;
      state.players.push(fresh(event));
      touch();
      break;
    }
    case 'leave': {
      const p = player(state, event.id);
      if (!p) break;
      if (state.phase === 'lobby') {
        state.players = state.players.filter((item) => item.id !== event.id);
      } else {
        p.connected = false;
        if (p.finishAt == null) p.out = true;
      }
      touch();
      break;
    }
    case 'mode': {
      if (event.id !== state.hostId || state.phase !== 'lobby') break;
      if (event.mode !== 'points' && event.mode !== 'elim') break;
      if (state.mode !== event.mode) {
        state.mode = event.mode;
        touch();
      }
      break;
    }
    case 'start': {
      if (event.id !== state.hostId) break;
      if (state.phase !== 'lobby') break;
      const n = active(state).length;
      if (!state.practice && (n < 2 || n > MAX_PLAYERS)) break;
      if (state.practice && n < 1) break;
      state.rule = state.practice ? 'points' : elimRule(state.mode, n);
      state.levelIndex = 0;
      for (const p of state.players) {
        p.out = false;
        p.points = 0;
        p.roundWins = 0;
        p.relSum = 0;
        p.starSum = 0;
        p.stars = 0;
        p.elimAt = null;
        p.finishAt = null;
      }
      beginCountdown(state, now);
      touch();
      break;
    }
    case 'progress': {
      if (state.phase !== 'play') break;
      const p = player(state, event.id);
      if (!p || p.out || !p.connected || p.finishAt != null) break;
      const need = event.need ?? p.need;
      const made = Math.max(0, Math.min(need, event.made | 0));
      if (p.made !== made || p.need !== need) {
        p.made = made;
        p.need = need;
        p.lastStepAt = now;
        touch();
      }
      break;
    }
    case 'finish': {
      if (state.phase !== 'play') break;
      const p = player(state, event.id);
      if (!p || p.out || !p.connected || p.finishAt != null) break;
      const at = Number.isFinite(event.at) ? event.at : now;
      if (at - state.startAt < MIN_FINISH_MS) break;
      if (at > now + 2000) break;
      p.finishAt = at;
      p.made = p.need;
      touch();
      break;
    }
    case 'tick': {
      if (state.phase === 'countdown' && now >= state.startAt) {
        state.phase = 'play';
        touch();
      }
      if (state.phase === 'play') {
        const level = state.levels[state.levelIndex];
        const limitMs = (level.limit.mid || 60) * 1000;
        const racers = active(state);
        const allDone = racers.length > 0 && racers.every((p) => p.finishAt != null);
        const expired = now >= state.startAt + limitMs;
        if (allDone || expired) {
          endPlay(state);
          touch();
        }
      }
      break;
    }
    case 'next': {
      if (event.id !== state.hostId || state.phase !== 'round') break;
      advance(state, now);
      touch();
      break;
    }
    case 'again': {
      if (event.id !== state.hostId) break;
      if (state.phase !== 'podium' && state.phase !== 'round') break;
      state.phase = 'lobby';
      state.levelIndex = 0;
      state.startAt = null;
      state.round = null;
      state.rule = null;
      state.players = state.players.filter((p) => p.connected);
      for (const p of state.players) {
        p.out = false;
        p.made = 0;
        p.need = 0;
        p.finishAt = null;
        p.points = 0;
        p.roundWins = 0;
        p.relSum = 0;
        p.stars = 0;
        p.starSum = 0;
        p.elimAt = null;
      }
      touch();
      break;
    }
    case 'close': {
      state.phase = 'closed';
      state.closedReason = event.reason || 'host';
      touch();
      break;
    }
    default:
      break;
  }

  if (changed) state.seq += 1;
  else state._same = before;
  return state;
}

export function viewOf(state, now, youId) {
  const level = state.levels[state.levelIndex] || null;
  const you = player(state, youId);
  return {
    seq: state.seq,
    code: state.code,
    hostId: state.hostId,
    youId,
    practice: state.practice,
    phase: state.phase,
    mode: state.mode,
    rule: state.rule,
    levelIndex: state.levelIndex,
    levelCount: state.levels.length,
    level: level && {
      id: level.id,
      title: level.title,
      hint: level.hint,
      par: level.par,
      limit: level.limit,
      need: level.need,
    },
    startAt: state.startAt,
    serverNow: now,
    youOut: !!(you && you.out),
    players: state.players.map((p) => ({
      id: p.id,
      nick: p.nick,
      age: p.age,
      made: p.made,
      need: p.need,
      finishAt: p.finishAt,
      out: p.out,
      connected: p.connected,
      points: p.points,
      roundWins: p.roundWins,
      relSum: p.relSum,
      stars: p.stars,
      starSum: p.starSum,
      host: p.id === state.hostId,
    })),
    round: state.round,
    podium: state.phase === 'podium' ? podiumOf(state) : null,
    closedReason: state.closedReason,
  };
}
