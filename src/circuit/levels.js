// Data for every age group lives on the level. The prototype only plays Mijlocii.
// Pars are placeholders until a playtest (spec §7.4).

export const AGES = [
  { id: 'small', label: 'Mici', years: '5–7', playable: false },
  { id: 'mid', label: 'Mijlocii', years: '8–10', playable: true },
  { id: 'big', label: 'Mari', years: '11+', playable: false },
];

const board = [0.42, 0.26];

export const LEVELS = [
  {
    id: 'bulb',
    title: 'Aprinde becul',
    hint: 'Unește bateria cu becul, cu ambele fire.',
    goal: 'full',
    bulbs: ['b1'],
    switch: false,
    par: { small: 45, mid: 30, big: 20 },
    limit: { small: 90, mid: 60, big: 40 },
    links: [['bat+', 'b1A'], ['bat-', 'b1B']],
    layout: {
      board,
      battery: { x: -0.07, z: -0.03 },
      bulbs: [{ id: 'b1', x: 0.085, z: 0.01 }],
      switches: [],
      wires: [
        { name: 'red', color: 'red', ax: -0.01, az: 0.08, bx: 0.02, bz: -0.09 },
        { name: 'black', color: 'black', ax: -0.15, az: -0.07, bx: 0.15, bz: 0.07 },
      ],
    },
  },
  {
    id: 'switch',
    title: 'Închide întrerupătorul',
    hint: 'Leagă bateria, întrerupătorul și becul. La urmă, închide întrerupătorul.',
    goal: 'full',
    bulbs: ['b1'],
    switch: true,
    par: { small: 60, mid: 45, big: 30 },
    limit: { small: 110, mid: 80, big: 55 },
    links: [['bat+', 'swL'], ['swR', 'b1A'], ['b1B', 'bat-']],
    layout: {
      board,
      battery: { x: -0.1, z: -0.02 },
      bulbs: [{ id: 'b1', x: 0.11, z: 0.02 }],
      switches: [{ id: 'sw', x: 0.0, z: -0.04 }],
      wires: [
        { name: 'red', color: 'red', ax: -0.02, az: 0.09, bx: 0.04, bz: 0.09 },
        { name: 'blue', color: 'blue', ax: 0.06, az: -0.09, bx: 0.16, bz: -0.06 },
        { name: 'black', color: 'black', ax: -0.16, az: 0.05, bx: -0.05, bz: -0.09 },
      ],
    },
  },
  {
    id: 'series',
    title: 'Două becuri în serie',
    hint: 'Aprinde ambele becuri. În serie luminează mai slab.',
    goal: 'series',
    bulbs: ['b1', 'b2'],
    switch: false,
    par: { small: 80, mid: 60, big: 40 },
    limit: { small: 140, mid: 100, big: 70 },
    links: [['bat+', 'b1A'], ['b1B', 'b2A'], ['b2B', 'bat-']],
    layout: {
      board,
      battery: { x: -0.12, z: -0.015 },
      bulbs: [
        { id: 'b1', x: 0.02, z: 0.04 },
        { id: 'b2', x: 0.115, z: -0.03 },
      ],
      switches: [],
      wires: [
        { name: 'red', color: 'red', ax: -0.02, az: 0.09, bx: 0.05, bz: 0.09 },
        { name: 'blue', color: 'blue', ax: 0.06, az: 0.0, bx: 0.16, bz: 0.05 },
        { name: 'black', color: 'black', ax: -0.16, az: -0.08, bx: 0.0, bz: -0.09 },
      ],
    },
  },
];

export function levelMeta(level) {
  return {
    id: level.id,
    title: level.title,
    hint: level.hint,
    goal: level.goal,
    bulbs: level.bulbs.slice(),
    switch: level.switch,
    par: { ...level.par },
    limit: { ...level.limit },
    links: level.links.map((pair) => pair.slice()),
    need: level.links.length,
  };
}
