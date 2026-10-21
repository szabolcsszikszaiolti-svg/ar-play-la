// Fixed phrases so a child never types a name, and so the words agree in Romanian.
export const NICKS = [
  'Vulpea Rapidă',
  'Ursul Isteț',
  'Pisica Curioasă',
  'Iepurele Sprinten',
  'Bufnița Înțeleaptă',
  'Delfinul Vesel',
  'Ariciul Curajos',
  'Veverița Iute',
  'Pinguinul Calm',
  'Leuțul Mic',
  'Foca Zâmbitoare',
  'Koala Somnoroasă',
  'Papagalul Vesel',
  'Bursucul Harnic',
  'Căprioara Lină',
  'Broasca Lucie',
  'Elefantul Blând',
  'Girafa Înaltă',
  'Râsul Jucăuș',
  'Ponei Sprinten',
  'Vidra Isteață',
  'Cocoșul Deștept',
  'Albinuța Harnică',
  'Melcul Grăbit',
];

// No O/0 and no I/1. Digits stay, matching codes like K7QZ.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function roomCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .replace(/[01OI]/g, '')
    .slice(0, 4);
}

export function pickNick(rng = Math.random, avoid = []) {
  const pool = NICKS.filter((nick) => !avoid.includes(nick));
  const src = pool.length ? pool : NICKS;
  return src[Math.floor(rng() * src.length)];
}

export function playerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
