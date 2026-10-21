// offset is added to the phone clock to estimate the host (or Firebase) clock.
// offset = serverNow - localSend - rtt/2, then a median of the last samples.

export function createClock() {
  return { offset: 0, samples: [] };
}

export function notePong(clock, sent, serverNow, now) {
  const rtt = now - sent;
  if (!(rtt >= 0) || rtt > 2500) return clock;
  const offset = serverNow - sent - rtt / 2;
  clock.samples.push(offset);
  if (clock.samples.length > 7) clock.samples.shift();
  const sorted = clock.samples.slice().sort((a, b) => a - b);
  clock.offset = sorted[sorted.length >> 1];
  return clock;
}

export function serverTime(clock, now) {
  return now + (clock.offset || 0);
}
