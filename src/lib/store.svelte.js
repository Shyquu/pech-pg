// Shared reactive state bridging the DOM UI overlay (App) and the 3D world
// (Scene). It is a single $state proxy, so mutating it from either side stays
// reactive everywhere it is read.

export const MAX_DICE = 6;

export const MODES = [
  {
    id: 'throw',
    label: 'Table Roll',
    hint: 'Press Roll — the dice are thrown and tumble across the tray until they settle.'
  },
  {
    id: 'hand',
    label: 'Hand Roll',
    hint: 'Drag across the tray to flick the dice yourself, or press Roll for a random throw.'
  },
  {
    id: 'spin',
    label: 'Spin Show',
    hint: 'The dice float and spin in place. Press Spin to spin them up; they slow onto a face.'
  }
];

export const dice = $state({
  mode: 'throw',
  // how many dice are in play
  count: 2,
  loaded: false,
  // live pip value of each die's up-facing side (updates every frame)
  values: [],
  // sum of `values`
  total: null,
  // true once every die has stopped and `values` is a confirmed result
  settled: true,
  // true while any die is actively moving after a roll
  rolling: false,
  // monotonically increasing counters used as "fire this action" signals
  rollNonce: 0,
  resetNonce: 0
});

export function requestRoll() {
  dice.rollNonce++;
}

export function requestReset() {
  dice.resetNonce++;
}

export function setMode(id) {
  if (dice.mode !== id) dice.mode = id;
}

export function setCount(n) {
  dice.count = Math.max(1, Math.min(MAX_DICE, n));
}
