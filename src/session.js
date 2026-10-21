import { createMatch, apply, viewOf } from './game/match.js';
import { createClock, notePong, serverTime } from './game/clock.js';

export function createSession({ youId, nick, age, transport, levels, practice = false }) {
  const clock = createClock();
  const listeners = new Set();
  let snap = null;
  let receivedAt = 0;
  let closed = null;
  const emit = () => listeners.forEach((fn) => fn());
  const now = () => Date.now() + (transport.serverOffset?.() || 0);

  if (transport.role === 'host') {
    const state = createMatch({
      code: transport.code,
      hostId: youId,
      levels,
      practice,
    });
    apply(state, { t: 'join', id: youId, nick, age }, now());
    const push = () => {
      snap = viewOf(state, now(), youId);
      transport.broadcast?.(snap);
      emit();
    };
    transport.onMessage((msg) => {
      if (!msg || msg.id === youId) return;
      if (msg.t === 'ping') {
        transport.sendTo?.(msg.id, { t: 'pong', sent: msg.sent, serverNow: now() });
        return;
      }
      if (msg.t === 'join') {
        if (state.phase !== 'lobby') {
          transport.sendTo?.(msg.id, { t: 'reject', reason: 'started' });
          return;
        }
        if (state.players.length >= 4) {
          transport.sendTo?.(msg.id, { t: 'reject', reason: 'full' });
          return;
        }
      }
      if (msg.t === 'finish') {
        const at = transport.trustTimestamps && Number.isFinite(msg.at) ? msg.at : undefined;
        apply(state, { t: 'finish', id: msg.id, at }, now());
      } else if (msg.t !== 'snapshot' && msg.t !== 'pong' && msg.t !== 'host-left') {
        apply(state, msg, now());
      }
      push();
    });
    push();
    return api({
      role: 'host',
      youId,
      state,
      view: () => viewOf(state, now(), youId),
      pump(t) {
        const seq = state.seq;
        apply(state, { t: 'tick' }, t + (transport.serverOffset?.() || 0));
        if (state.seq !== seq) push();
      },
      command(event, clock) {
        const seq = state.seq;
        apply(state, { ...event, id: event.id || youId }, clock ?? now());
        if (state.seq !== seq) push();
      },
      close() { transport.close?.(); },
    });
  }

  let pingTimer = 0;
  transport.onMessage((msg) => {
    if (!msg) return;
    if (msg.t === 'snapshot' && msg.state) {
      snap = msg.state;
      receivedAt = Date.now();
      if (transport.serverOffset) {
        clock.offset = transport.serverOffset();
        clock.samples = [clock.offset];
      }
      emit();
    } else if (msg.t === 'pong') {
      notePong(clock, msg.sent, msg.serverNow, Date.now());
      emit();
    } else if (msg.t === 'host-left') {
      closed = 'host';
      emit();
    } else if (msg.t === 'reject') {
      closed = msg.reason || 'reject';
      emit();
    }
  });
  transport.send?.({ t: 'join', id: youId, nick, age });
  pingTimer = window.setInterval(() => {
    transport.send?.({ t: 'ping', id: youId, sent: Date.now() });
  }, 1000);

  function guestNow() {
    if (clock.samples.length) return serverTime(clock, Date.now());
    if (snap) return snap.serverNow + (Date.now() - receivedAt);
    return Date.now();
  }

  return api({
    role: 'guest',
    youId,
    view() {
      if (closed === 'host') {
        return { phase: 'closed', closedReason: 'host', youId, code: transport.code, players: snap?.players || [], hostId: snap?.hostId };
      }
      if (closed) {
        return { phase: 'reject', closedReason: closed, youId, code: transport.code, players: [] };
      }
      if (!snap) return { phase: 'connecting', youId, code: transport.code, players: [], hostId: null };
      return { ...snap, youId, serverNow: guestNow() };
    },
    pump() {},
    command(event) {
      if (event.t === 'progress') transport.send?.({ t: 'progress', id: youId, made: event.made, need: event.need });
      if (event.t === 'finish') transport.send?.({ t: 'finish', id: youId, need: event.need, made: event.need });
      if (event.t === 'leave') transport.send?.({ t: 'leave', id: youId });
    },
    close() {
      window.clearInterval(pingTimer);
      transport.send?.({ t: 'leave', id: youId });
      transport.close?.();
    },
  });

  function api(base) {
    return {
      ...base,
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      start() { base.command({ t: 'start' }); },
      setMode(mode) { base.command({ t: 'mode', mode }); },
      progress(made, need) { base.command({ t: 'progress', made, need }); },
      finish(arg) {
        const at = typeof arg === 'number' ? arg : undefined;
        const need = arg && typeof arg === 'object' ? arg.need : undefined;
        base.command({ t: 'finish', at, need });
      },
      next() { base.command({ t: 'next' }); },
      again() { base.command({ t: 'again' }); },
      leave() { base.command({ t: 'leave' }); base.close(); },
      addBot(botNick) {
        const id = 'bot-' + (base.state?.players.length || 0);
        base.command({ t: 'join', id, nick: botNick, age: 'mid' });
        return id;
      },
      finishAs(id, at) { base.command({ t: 'finish', id, at }, at); },
      progressAs(id, made, need) { base.command({ t: 'progress', id, made, need }); },
    };
  }
}
