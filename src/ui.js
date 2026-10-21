import { CODE_ALPHABET } from './names.js';
import { formatSeconds, formatFactor, starGlyphs } from './game/score.js';

const $ = (id) => document.getElementById(id);

export function setupUI(handlers) {
  $('createBtn').onclick = () => handlers.menu('create');
  $('joinBtn').onclick = () => handlers.menu('join');
  $('soloBtn').onclick = () => handlers.menu('solo');
  $('otherNick').onclick = () => handlers.otherNick();
  $('nickOk').onclick = () => handlers.nickOk();
  document.querySelectorAll('#nick .ages button').forEach((btn) => {
    btn.onclick = () => handlers.age(btn.dataset.age);
  });
  $('joinOk').onclick = () => handlers.join($('codeInput').value);
  $('joinBack').onclick = () => handlers.menu('home');
  $('shareBtn').onclick = () => handlers.share();
  $('startBtn').onclick = () => handlers.start();
  $('lobbyLeave').onclick = () => handlers.leave();
  $('leave').onclick = () => handlers.leave();
  $('recenter').onclick = () => handlers.recenter();
  $('nextBtn').onclick = () => handlers.next();
  $('againBtn').onclick = () => handlers.again();
  $('homeBtn').onclick = () => handlers.home();
  document.querySelectorAll('#modeRow button').forEach((btn) => {
    btn.onclick = () => handlers.mode(btn.dataset.mode);
  });
  const keys = $('keys');
  for (const ch of CODE_ALPHABET) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = ch;
    btn.onclick = () => {
      const input = $('codeInput');
      if (input.value.length < 4) input.value += ch;
    };
    keys.appendChild(btn);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '⌫';
  back.onclick = () => { $('codeInput').value = $('codeInput').value.slice(0, -1); };
  keys.appendChild(back);
  $('codeInput').addEventListener('input', () => {
    $('codeInput').value = $('codeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[01OI]/g, '').slice(0, 4);
  });
}

let painted = '';

export function render(state) {
  const view = state.view;
  const sig = JSON.stringify({
    menu: state.menu,
    nick: state.nick,
    toast: state.toast,
    hint: state.hint,
    short: state.short,
    local: state.local,
    view: view && { ...view, serverNow: 0 },
  });
  if (sig !== painted) {
    painted = sig;
    paint(state);
  }
  paintLive(state);
}

export function forcePaint() { painted = ''; }

function paint(state) {
  const view = state.view;
  const menu = state.menu;
  const phase = view?.phase;
  show('home', menu === 'home');
  show('nick', menu === 'nick');
  show('join', menu === 'join');
  show('lobby', phase === 'lobby' || phase === 'connecting');
  show('hud', phase === 'play');
  show('hint', !!state.hint && (phase === 'play' || phase === 'countdown'));
  show('short', !!state.short && phase === 'play');
  show('recenter', phase === 'play' || phase === 'countdown' || phase === 'podium' || phase === 'round');
  show('leave', phase === 'play' || phase === 'countdown');
  show('round', phase === 'round');
  show('podiumCard', phase === 'podium');
  show('closed', phase === 'closed' || phase === 'reject');
  show('toast', !!state.toast);
  $('nickText').textContent = state.nick || '';
  $('toast').textContent = state.toast || '';
  $('hint').textContent = state.hint || '';
  if (menu === 'join' && state.joinCode != null && document.activeElement !== $('codeInput')) {
    $('codeInput').value = state.joinCode;
  }
  if (phase === 'lobby' || phase === 'connecting') paintLobby(view, state);
  if (phase === 'round') paintRound(view);
  if (phase === 'podium') paintPodium(view);
  if (phase === 'closed' || phase === 'reject') {
    const map = {
      host: 'Gazda a plecat. Cursa s-a oprit.',
      full: 'Camera e plină.',
      started: 'Cursa a început deja.',
      missing: 'Nu găsesc camera. Verifică codul.',
      reject: 'Nu te poți alătura acum.',
    };
    $('closedText').textContent = map[view.closedReason] || map.host;
  }
  if (phase === 'play') paintChips(view, state.local);
}

function paintLive(state) {
  const view = state.view;
  if (!view) {
    show('count', false);
    return;
  }
  if (view.phase === 'countdown' && view.startAt) {
    const remain = view.startAt - view.serverNow;
    const n = Math.ceil(remain / 1000);
    $('count').textContent = n >= 3 ? '3' : n === 2 ? '2' : n === 1 ? '1' : 'Start';
    show('count', true);
  } else show('count', false);
  if (view.phase === 'play' && view.startAt) {
    const sec = Math.max(0, (view.serverNow - view.startAt) / 1000);
    $('clock').textContent = formatSeconds(sec);
  }
}

function paintLobby(view, state) {
  const practice = !!view?.practice;
  $('roomLabel').textContent = practice ? 'Antrenament' : (view?.phase === 'connecting' ? 'Se deschide camera…' : 'Cameră');
  $('roomCode').textContent = practice ? '—' : (view?.code || '----');
  $('roomCode').style.letterSpacing = practice ? '0' : '.18em';
  show('shareBtn', !practice && view?.phase === 'lobby');
  const host = view && view.youId === view.hostId;
  show('modeRow', !practice && host);
  show('startBtn', host && view?.phase === 'lobby');
  const n = (view?.players || []).filter((p) => p.connected).length;
  $('startBtn').disabled = !practice && n < 2;
  $('modeHelp').textContent = practice
    ? 'Exersezi singur, fără rețea. Aceleași 3 niveluri.'
    : (view?.mode === 'elim'
      ? 'Cu 2 jucători: cel mai bun din 3. Cu 3 sau 4: cel mai lent iese după fiecare nivel.'
      : 'Toți joacă 3 niveluri. Locul 1 ia 10 puncte, apoi 7, 5 și 3. Locul se stabilește după timpul raportat la reper.');
  document.querySelectorAll('#modeRow button').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.mode === (view?.mode || 'points'));
    btn.disabled = !host;
  });
  $('lobbyPlayers').innerHTML = (view?.players || []).map((p) => {
    const tags = [p.host ? 'gazda' : '', p.out ? 'ieșit' : '', !p.connected ? 'plecat' : ''].filter(Boolean).join(' · ');
    return `<div class="player"><span>${esc(p.nick)}</span><span class="tag">${esc(tags || 'gata')}</span></div>`;
  }).join('') || '<p class="help">Așteptăm jucători…</p>';
  if (!host && view?.phase === 'lobby') $('modeHelp').textContent += ' Așteptăm gazda.';
}

function paintChips(view, local) {
  const you = view.youId;
  $('chips').innerHTML = (view.players || []).filter((p) => p.connected && !p.out).map((p) => {
    const made = p.id === you && local ? local.made : p.made;
    const need = p.id === you && local ? local.need : (p.need || view.level?.need || 1);
    const pct = Math.round((made / Math.max(1, need)) * 100);
    const label = p.id === you ? 'Tu' : p.nick;
    return `<div class="chip"><b>${esc(label)} ${made}/${need}</b><div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }).join('');
}

function paintRound(view) {
  const host = view.youId === view.hostId;
  $('roundTitle').textContent = view.round?.title || view.level?.title || '';
  $('roundBody').innerHTML = (view.round?.ranking || []).map((row) => {
    const time = row.elapsed == null ? '—' : formatSeconds(row.elapsed);
    return `<tr><td>${row.place}</td><td>${esc(row.nick)}</td><td>${time}</td><td>${formatFactor(row.rel)}</td><td>${row.points}</td><td>${starGlyphs(row.stars)}</td></tr>`;
  }).join('');
  show('nextBtn', host);
  show('roundWait', !host);
  $('nextBtn').textContent = 'Continuă';
}

function paintPodium(view) {
  const host = view.youId === view.hostId;
  $('podiumList').innerHTML = (view.podium || []).map((row) => {
    return `<div class="player"><span>${row.place}. ${esc(row.nick)}</span><span class="tag">${row.points} pct · ${starGlyphs(row.stars)}</span></div>`;
  }).join('');
  show('againBtn', host);
  show('againWait', !host);
}

function show(id, on) {
  $(id).hidden = !on;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

export function setJoinCode(code) {
  $('codeInput').value = code;
}

export function hideLoader() {
  $('loader').hidden = true;
}

export function loaderError(text) {
  $('loader').textContent = text;
}
