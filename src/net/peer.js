import { roomCode } from '../names.js';

function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../../vendor/peerjs/peerjs.min.js', import.meta.url).href;
    script.onload = () => (window.Peer ? resolve(window.Peer) : reject(new Error('peer')));
    script.onerror = () => reject(new Error('peer'));
    document.head.appendChild(script);
  });
}

function waitOpen(peer) {
  return new Promise((resolve, reject) => {
    const ok = (id) => { cleanup(); resolve(id); };
    const bad = (err) => { cleanup(); reject(err); };
    const cleanup = () => {
      peer.off('open', ok);
      peer.off('error', bad);
    };
    peer.on('open', ok);
    peer.on('error', bad);
  });
}

export async function createPeerHost() {
  const Peer = await loadPeer();
  let last = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = roomCode();
    const peer = new Peer('sr-' + code, { debug: 0 });
    try {
      await waitOpen(peer);
      return bindHost(peer, code);
    } catch (err) {
      last = err;
      peer.destroy();
      if (err?.type !== 'unavailable-id') break;
    }
  }
  throw last || new Error('peer');
}

function bindHost(peer, code) {
  const conns = new Map();
  const handlers = new Set();
  peer.on('connection', (conn) => {
    conns.set(conn.peer, conn);
    conn.on('data', (msg) => {
      handlers.forEach((fn) => fn({ ...msg, id: (msg && msg.id) || conn.peer }));
    });
    const gone = () => {
      if (!conns.has(conn.peer)) return;
      conns.delete(conn.peer);
      handlers.forEach((fn) => fn({ t: 'leave', id: conn.peer }));
    };
    conn.on('close', gone);
    conn.on('error', gone);
  });
  return {
    code,
    youId: peer.id,
    role: 'host',
    trustTimestamps: false,
    onMessage(fn) { handlers.add(fn); },
    broadcast(state) {
      const packet = { t: 'snapshot', state };
      for (const conn of conns.values()) if (conn.open) conn.send(packet);
    },
    sendTo(id, msg) {
      const conn = conns.get(id);
      if (conn?.open) conn.send(msg);
    },
    close() {
      const packet = { t: 'host-left' };
      for (const conn of conns.values()) {
        try { if (conn.open) conn.send(packet); } catch { /* already gone */ }
      }
      peer.destroy();
    },
  };
}

export async function createPeerGuest(code) {
  const Peer = await loadPeer();
  const peer = new Peer({ debug: 0 });
  await waitOpen(peer);
  const conn = peer.connect('sr-' + code, { reliable: true });
  const handlers = new Set();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 12000);
    conn.on('open', () => { clearTimeout(timer); resolve(); });
    const fail = (err) => { clearTimeout(timer); reject(err); };
    conn.on('error', fail);
    peer.on('error', fail);
  });
  conn.on('data', (msg) => handlers.forEach((fn) => fn(msg)));
  conn.on('close', () => handlers.forEach((fn) => fn({ t: 'host-left' })));
  return {
    code,
    youId: peer.id,
    role: 'guest',
    onMessage(fn) { handlers.add(fn); },
    send(msg) { if (conn.open) conn.send({ ...msg, id: peer.id }); },
    close() {
      try { conn.close(); } catch { /* already closed */ }
      peer.destroy();
    },
  };
}
