import { LEVELS, levelMeta } from './circuit/levels.js';
import { createBoard } from './circuit/board.js';
import { createScene } from './scene.js';
import { createPodium } from './podium.js';
import { createSession } from './session.js';
import { createPeerHost, createPeerGuest } from './net/peer.js';
import { createChannelHost, createChannelGuest } from './net/channel.js';
import { createFirebaseTransport, firebaseReady } from './net/firebase.js';
import { firebaseConfig } from '../config.js';
import { pickNick, normalizeCode, playerId, roomCode } from './names.js';
import { MIN_FINISH_MS } from './game/score.js';
import { setupUI, render, setJoinCode, hideLoader, loaderError } from './ui.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const net = params.get('net');
const presetRoom = normalizeCode(params.get('room') || params.get('code') || '');

const canvas = document.getElementById('view');
const meta = LEVELS.map(levelMeta);

let scene;
let board;
let podium;
let session = null;
let menu = shot ? 'home' : (presetRoom ? 'nick' : 'home');
let nick = sessionStorage.getItem('sr-nick') || pickNick();
let intent = presetRoom ? 'join' : null;
let toast = '';
let hint = '';
let shorted = false;
let local = { made: 0, need: 2 };
let pending = false;
let freeze = false;
let built = -1;
let armed = '';
let token = 0;
let ready = false;

const avoided = new Set([nick]);

setupUI({
  menu: (name) => {
    if (name === 'home') return goHome();
    if (name === 'create') intent = 'create';
    if (name === 'join') intent = 'join';
    if (name === 'solo') intent = 'solo';
    menu = 'nick';
    toast = '';
  },
  otherNick() {
    nick = pickNick(Math.random, [...avoided]);
    avoided.add(nick);
    if (avoided.size > 20) avoided.clear();
  },
  age(id) {
    if (id !== 'mid') toast = 'În curând. Acum jucăm la Mijlocii.';
  },
  nickOk() {
    sessionStorage.setItem('sr-nick', nick);
    toast = '';
    if (intent === 'solo') return startPractice();
    if (intent === 'create') return startHost();
    menu = 'join';
    if (presetRoom) setJoinCode(presetRoom);
  },
  join(code) {
    const clean = normalizeCode(code);
    if (clean.length < 4) {
      toast = 'Codul are 4 semne.';
      return;
    }
    startGuest(clean);
  },
  share() { shareRoom(); },
  start() { session?.start(); },
  mode(mode) { session?.setMode(mode); },
  next() { session?.next(); },
  again() {
    pending = false;
    session?.again();
    armed = '';
  },
  leave() { goHome(); },
  home() { goHome(); },
  recenter() { scene.rig.reset(); },
});

function goHome() {
  token += 1;
  const current = session;
  session = null;
  menu = 'home';
  intent = null;
  pending = false;
  toast = '';
  armed = '';
  try { current?.leave(); } catch { /* already closed */ }
  board?.showLevel(LEVELS[0]);
  built = 0;
  board?.setLocked(false);
  podium?.hide();
  if (board) board.root.visible = true;
  scene?.rig.home('play');
}

function dummyHost(code, youId) {
  return {
    code, youId, role: 'host', trustTimestamps: false,
    onMessage() {}, broadcast() {}, sendTo() {}, close() {},
  };
}

function attach(next) {
  session = next;
  menu = null;
  pending = false;
  armed = '';
}

function startPractice() {
  const youId = 'you';
  attach(createSession({
    youId, nick, age: 'mid', levels: meta, practice: true,
    transport: dummyHost('SOLO', youId),
  }));
}

function showBusy(code) {
  session = {
    role: 'guest',
    view: () => ({
      phase: 'connecting', code: code || '····', youId: 'me', hostId: 'me',
      players: [{ id: 'me', nick, connected: true, host: true }], practice: false, mode: 'points',
    }),
    pump() {}, leave() {}, start() {}, setMode() {},
  };
  menu = null;
}

async function startHost() {
  const mine = ++token;
  toast = '';
  showBusy('····');
  try {
    const youId = playerId();
    let transport;
    if (net === 'channel') transport = createChannelHost({ code: presetRoom || 'TEST', youId });
    else if (firebaseReady(firebaseConfig)) {
      transport = await createFirebaseTransport(firebaseConfig, {
        role: 'host', code: presetRoom || roomCode(), nick, age: 'mid',
      });
    } else transport = await createPeerHost();
    if (mine !== token) { transport.close?.(); return; }
    attach(createSession({
      youId: transport.youId || youId, nick, age: 'mid', levels: meta, transport,
    }));
  } catch {
    if (mine !== token) return;
    session = null;
    menu = 'home';
    toast = 'Nu mă pot conecta. Verifică internetul și încearcă din nou.';
  }
}

async function startGuest(code) {
  const mine = ++token;
  toast = '';
  showBusy(code);
  try {
    const youId = playerId();
    const transport = net === 'channel'
      ? createChannelGuest({ code, youId })
      : firebaseReady(firebaseConfig)
        ? await createFirebaseTransport(firebaseConfig, { role: 'guest', code, nick, age: 'mid' })
        : await createPeerGuest(code);
    if (mine !== token) { transport.close?.(); return; }
    attach(createSession({
      youId: transport.youId || youId, nick, age: 'mid', levels: meta, transport,
    }));
  } catch (err) {
    if (mine !== token) return;
    const reason = err?.reason || err?.type;
    if (reason === 'full' || reason === 'started' || reason === 'missing' || reason === 'peer-unavailable') {
      attachClosed(reason === 'peer-unavailable' ? 'missing' : reason);
    } else {
      menu = 'home';
      toast = 'Nu găsesc camera. Verifică codul și internetul.';
    }
  }
}

function attachClosed(reason) {
  session = {
    role: 'guest',
    view: () => ({ phase: 'reject', closedReason: reason, youId: 'x', players: [] }),
    pump() {},
    leave() {},
  };
  menu = null;
}

async function shareRoom() {
  const code = session?.view()?.code;
  if (!code) return;
  const url = new URL(location.href);
  url.search = '?room=' + code;
  const data = { title: 'Science Race', text: 'Intră în camera ' + code, url: url.href };
  try {
    if (navigator.share) await navigator.share(data);
    else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${data.text} ${url.href}`);
      toast = 'Link copiat. Trimite-l prietenului.';
    } else toast = url.href;
  } catch { /* share dismissed */ }
}

function follow(view) {
  if (freeze || !view || !board) return;
  if (view.phase === 'podium') {
    if (armed !== 'podium') {
      board.root.visible = false;
      scene.rig.home('podium');
      armed = 'podium';
    }
    podium.show(view.podium || []);
    return;
  }
  if (armed === 'podium') {
    podium.hide();
    board.root.visible = true;
    scene.rig.home('play');
  }
  const levelIndex = view.phase === 'lobby' || view.levelIndex == null ? 0 : view.levelIndex;
  const entered = view.phase !== armed;
  if (view.phase === 'lobby' && entered) {
    board.showLevel(LEVELS[0]);
    built = 0;
    pending = false;
    board.root.visible = true;
  }
  if (view.phase === 'round' && entered) scene.rig.lift(board.filamentPoints());
  if (view.phase === 'countdown' && (entered || built !== levelIndex)) {
    board.showLevel(LEVELS[levelIndex]);
    built = levelIndex;
    pending = false;
    board.root.visible = true;
    scene.rig.home('play');
    scene.rig.setEnabled(true);
  }
  armed = view.phase || '';
  const me = (view.players || []).find((p) => p.id === view.youId);
  board.setLocked(view.phase !== 'play' || !!me?.out || !!me?.finishAt || pending);
}

function bootShots() {
  if (!shot || shot === 'home') return;
  if (shot === 'series') {
    freeze = true;
    menu = 'series';
    board.showLevel(LEVELS[2]);
    const result = board.connectSolution();
    const pts = board.filamentPoints();
    const mid = new scene.THREE.Vector3();
    for (const p of pts) mid.add(p);
    mid.multiplyScalar(1 / pts.length);
    const dir = new scene.THREE.Vector3(0.15, 0.78, 0.6).normalize();
    scene.camera.position.copy(mid).addScaledVector(dir, 0.27);
    scene.camera.fov = 40;
    scene.camera.near = 0.002;
    scene.camera.updateProjectionMatrix();
    scene.camera.lookAt(mid);
    scene.rig.setEnabled(false);
    window.__sr.series = {
      won: result.won,
      short: result.short,
      brightness: result.brightness,
    };
    return;
  }
  const youId = 'host';
  attach(createSession({
    youId, nick: 'Ursul Isteț', age: 'mid', levels: meta,
    transport: dummyHost('K7QZ', youId),
  }));
  const fox = session.addBot('Vulpea Rapidă');
  const cat = session.addBot('Pisica Curioasă');
  if (shot === 'lobby') return;
  session.setMode('points');
  session.start();
  session.pump(session.state.startAt);
  if (shot === 'play') {
    session.state.startAt = Date.now() - 12000;
    session.progressAs(fox, 2, 2);
    session.progressAs(cat, 1, 2);
    board.connectLinks(1);
    return;
  }
  fastRounds(shot === 'podium' ? 3 : 1, fox, cat);
  if (shot === 'round') board.connectSolution();
}

function fastRounds(count, fox, cat) {
  for (let level = 0; level < count; level++) {
    if (session.state.phase === 'countdown') session.pump(session.state.startAt);
    const start = session.state.phase === 'play' ? session.state.startAt : Date.now();
    if (session.state.phase === 'countdown') session.state.startAt = start;
    const order = [
      [fox, 5000],
      ['host', 8000],
      [cat, 12000],
    ];
    if (level === 1) order.splice(0, 2, ['host', 5000], [fox, 9000]);
    if (level === 2) order.splice(0, 3, [cat, 6000], ['host', 9000], [fox, 13000]);
    for (const [id, at] of order) session.finishAs(id, start + at);
    session.pump(start + 20000);
    const keepGoing = level < count - 1 || shot === 'podium';
    if (keepGoing && session.state.phase === 'round') session.next();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - frame.last) / 1000 || 0.016);
  frame.last = now;
  board.update(dt);
  if (session?.role === 'host') session.pump(Date.now());
  const view = session ? session.view() : null;
  if (pending && view?.phase === 'play' && view.startAt && view.serverNow - view.startAt >= MIN_FINISH_MS) {
    pending = false;
    session.finish({ need: local.need });
  }
  follow(view);
  if (view?.phase === 'podium') {
    podium.update(dt);
    scene.rig.spin(dt);
  }
  let shownHint = hint;
  if (view?.youOut && view.phase === 'play') shownHint = 'Ești spectator. Urmărești cursa.';
  render({ menu, nick, toast, hint: shownHint, short: shorted, local, view, joinCode: presetRoom || null });
  scene.renderer.render(scene.scene, scene.camera);
  requestAnimationFrame(frame);
}
frame.last = performance.now();

async function main() {
  scene = await createScene(canvas);
  podium = createPodium();
  scene.scene.add(podium.root);
  await podium.ready;
  board = await createBoard(scene.THREE, scene.renderer, {
    onProgress(progress) {
      local = progress;
      if (session && session.view().phase === 'play') session.progress(progress.made, progress.need);
    },
    onWin() {
      if (!session || session.view().phase !== 'play') return;
      pending = true;
      board.setLocked(true);
    },
    onHint(text) { hint = text || ''; },
    onShort(value) { shorted = !!value; },
  });
  scene.scene.add(board.root);
  board.showLevel(LEVELS[0]);
  built = 0;
  scene.rig.onTap((ray) => board.tap(ray));
  window.addEventListener('resize', () => scene.resize());
  scene.resize();
  bootShots();
  if (params.get('auto') === 'host') {
    nick = params.get('nick') || nick;
    intent = 'create';
    await startHost();
  } else if (params.get('auto') === 'join' && presetRoom) {
    nick = params.get('nick') || nick;
    await startGuest(presetRoom);
  }
  hideLoader();
  ready = true;
  window.__sr.ready = true;
  requestAnimationFrame(frame);
}

window.__sr = {
  ready: false,
  view: () => (session ? session.view() : null),
  brightness: () => board?.brightness?.() || null,
  menu: () => menu,
};

main().catch((err) => {
  loaderError('Laboratorul nu pornește pe ecranul ăsta.');
  window.__sr.error = String(err && err.message || err);
});
