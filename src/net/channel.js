// Same-browser transport for tests. BroadcastChannel does not echo to the sender.

export function createChannelHost({ code, youId }) {
  const channel = new BroadcastChannel('science-race-' + code);
  const handlers = new Set();
  channel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || msg.from === youId) return;
    if (msg.to && msg.to !== youId) return;
    handlers.forEach((fn) => fn({ ...msg, id: msg.id || msg.from }));
  };
  return {
    code,
    youId,
    role: 'host',
    trustTimestamps: false,
    onMessage(fn) { handlers.add(fn); },
    broadcast(state) { channel.postMessage({ t: 'snapshot', state, from: youId }); },
    sendTo(id, msg) { channel.postMessage({ ...msg, from: youId, to: id }); },
    close() {
      channel.postMessage({ t: 'host-left', from: youId });
      channel.close();
    },
  };
}

export function createChannelGuest({ code, youId }) {
  const channel = new BroadcastChannel('science-race-' + code);
  const handlers = new Set();
  channel.onmessage = (event) => {
    const msg = event.data;
    if (!msg || msg.from === youId) return;
    if (msg.to && msg.to !== youId) return;
    handlers.forEach((fn) => fn(msg));
  };
  return {
    code,
    youId,
    role: 'guest',
    onMessage(fn) { handlers.add(fn); },
    send(msg) { channel.postMessage({ ...msg, from: youId, id: youId }); },
    close() {
      channel.postMessage({ t: 'leave', id: youId, from: youId });
      channel.close();
    },
  };
}
