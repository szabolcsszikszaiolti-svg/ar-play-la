// Realtime Database adapter from spec §3. It stays idle until config.js has a project.
// The host still runs the match, but finishAt is Firebase server time and presence
// uses onDisconnect. This path is untested until a Firebase project exists.

const SDK = 'https://www.gstatic.com/firebasejs/10.13.2';

export function firebaseReady(config) {
  return !!(config && config.apiKey && config.databaseURL && config.projectId);
}

async function sdk() {
  const appMod = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const dbMod = await import(`${SDK}/firebase-database.js`);
  return { appMod, authMod, dbMod };
}

export async function createFirebaseTransport(config, { role, code, nick, age }) {
  const { appMod, authMod, dbMod } = await sdk();
  const app = appMod.initializeApp(config, 'science-race');
  const auth = authMod.getAuth(app);
  const cred = await authMod.signInAnonymously(auth);
  const uid = cred.user.uid;
  const db = dbMod.getDatabase(app);
  let offset = 0;
  dbMod.onValue(dbMod.ref(db, '.info/serverTimeOffset'), (snap) => {
    offset = snap.val() || 0;
  });
  const handlers = new Set();
  const emit = (msg) => handlers.forEach((fn) => fn(msg));

  if (role === 'host') {
    const roomRef = dbMod.ref(db, `rooms/${code}`);
    await dbMod.set(roomRef, { hostId: uid, createdAt: dbMod.serverTimestamp() });
    const online = dbMod.ref(db, `rooms/${code}/hostOnline`);
    await dbMod.set(online, true);
    dbMod.onDisconnect(online).set(false);
    const self = dbMod.ref(db, `rooms/${code}/players/${uid}`);
    await dbMod.set(self, { nick, age, made: 0, need: 0, connected: true });
    dbMod.onDisconnect(self).update({ connected: false });
    const seen = new Map();
    dbMod.onValue(dbMod.ref(db, `rooms/${code}/players`), (snap) => {
      const players = snap.val() || {};
      for (const [id, prev] of seen) {
        if (!players[id] || players[id].connected === false) emit({ t: 'leave', id });
      }
      for (const [id, player] of Object.entries(players)) {
        if (!player || id === uid) continue;
        const prev = seen.get(id);
        if (!prev) emit({ t: 'join', id, nick: player.nick, age: player.age || 'mid' });
        if (!prev || prev.made !== player.made || prev.need !== player.need) {
          emit({ t: 'progress', id, made: player.made || 0, need: player.need || 0 });
        }
        if (player.finishAt && !prev?.finishAt) emit({ t: 'finish', id, at: player.finishAt });
        seen.set(id, player);
      }
    });
    return {
      code,
      youId: uid,
      role: 'host',
      trustTimestamps: true,
      serverOffset: () => offset,
      onMessage(fn) { handlers.add(fn); },
      broadcast(state) {
        return dbMod.set(dbMod.ref(db, `rooms/${code}/state`), JSON.parse(JSON.stringify(state)));
      },
      sendTo() {},
      close() { return dbMod.remove(roomRef); },
    };
  }

  const roomRef = dbMod.ref(db, `rooms/${code}`);
  const roomSnap = await dbMod.get(roomRef);
  if (!roomSnap.exists() || !roomSnap.child('hostId').val()) {
    const error = new Error('missing');
    error.reason = 'missing';
    throw error;
  }
  const stateSnap = await dbMod.get(dbMod.ref(db, `rooms/${code}/state`));
  const phase = stateSnap.child('phase').val();
  if (phase && phase !== 'lobby') {
    const error = new Error('started');
    error.reason = 'started';
    throw error;
  }
  if (roomSnap.child('players').numChildren() >= 4) {
    const error = new Error('full');
    error.reason = 'full';
    throw error;
  }
  const self = dbMod.ref(db, `rooms/${code}/players/${uid}`);
  await dbMod.set(self, { nick, age, made: 0, need: 0, connected: true });
  dbMod.onDisconnect(self).update({ connected: false });
  dbMod.onValue(dbMod.ref(db, `rooms/${code}/state`), (snap) => {
    const state = snap.val();
    if (state) emit({ t: 'snapshot', state });
  });
  dbMod.onValue(dbMod.ref(db, `rooms/${code}/hostOnline`), (snap) => {
    if (snap.val() === false) emit({ t: 'host-left' });
  });
  return {
    code,
    youId: uid,
    role: 'guest',
    serverOffset: () => offset,
    onMessage(fn) { handlers.add(fn); },
    send(msg) {
      if (msg.t === 'progress') {
        return dbMod.update(self, { made: msg.made, need: msg.need });
      }
      if (msg.t === 'finish') {
        return dbMod.update(self, {
          finishAt: dbMod.serverTimestamp(),
          made: msg.need,
          need: msg.need,
        });
      }
      if (msg.t === 'leave') return dbMod.update(self, { connected: false });
      return null;
    },
    close() { return dbMod.update(self, { connected: false }); },
  };
}
