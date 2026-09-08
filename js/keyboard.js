// The keyboard. A modern staggered layout over the machine's real 8x5 matrix,
// plus the keys 1982 never had: a backspace, a caps lock, a second caps shift,
// a dedicated extended-mode key, and four keys for everything the original
// couldn't do.

import { KEYS } from './rom-data.js';

const spectrum = Object.fromEntries(KEYS.map(k => [k.id, k]));

// Keys of our own. `hint` names the original finger-breaking combination.
const EXTRA = {
  EDIT:      { id: 'EDIT',      main: 'EDIT',      hint: 'CS + 1', kind: 'util' },
  BACKSPACE: { id: 'BACKSPACE', main: 'BACKSPACE', hint: 'CS + 0', kind: 'util' },
  CAPSLOCK:  { id: 'CAPSLOCK',  main: 'CAPS LOCK', hint: 'CS + 2', kind: 'util' },
  EXT:       { id: 'EXT',       main: 'E',         hint: 'MODE',   kind: 'util' },
  CS2:       { id: 'CS2',       main: '\u21e7',    hint: 'CAPS',   kind: 'mod' },
  LEFT:      { id: 'LEFT',      main: '\u2190',    hint: 'CS + 5', kind: 'util' },
  DOWN:      { id: 'DOWN',      main: '\u2193',    hint: 'CS + 6', kind: 'util' },
  UP:        { id: 'UP',        main: '\u2191',    hint: 'CS + 7', kind: 'util' },
  RIGHT:     { id: 'RIGHT',     main: '\u2192',    hint: 'CS + 8', kind: 'util' },
  F2: { id: 'F2', main: 'ЛЕНТЫ',    kind: 'fn' },
  F3: { id: 'F3', main: 'УРОКИ',    kind: 'fn' },
  F4: { id: 'F4', main: 'НАСТРОЙКИ', kind: 'fn' },
};

const key = id => spectrum[id] || EXTRA[id];

// One grid for the whole keyboard, 49 quarter-key columns wide, so the stagger
// lands on exact fractions and ENTER can stand two rows tall.
// The stagger is the real one: each row's first key is a quarter to half a key
// wider than the last, so no letter sits square under the one above it.
// 1 at 1u, Q at 1.5u, A at 1.75u, Z at 2.25u.
const COLUMNS = 51;
const U = 4;
const SPAN = {
  EDIT: 4, BACKSPACE: 7, EXT: 6, ENTER: 8, CAPSLOCK: 7,
  CS: 8, SS: 7, CS2: 4, SPACE: 24,
  F2: 5, F3: 5, F4: 5,
  LEFT: 4, DOWN: 4, UP: 4, RIGHT: 4,
};

// The arrows make an upright T at the bottom right: UP sits directly over
// DOWN, exactly as it does on a real keyboard.
const LAYOUT = [
  ['EDIT', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'BACKSPACE'],
  ['EXT', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['CAPSLOCK', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'ENTER'],
  ['CS', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'SS', 'UP', 'CS2'],
  ['F2', 'SPACE', 'F3', 'F4', 'LEFT', 'DOWN', 'RIGHT'],
];

// Our own keys stand for combinations the original needed two hands for.
const COMBO = {
  EDIT:      ['CS', '1'],
  CAPSLOCK:  ['CS', '2'],
  BACKSPACE: ['CS', '0'],
  EXT:       ['CS', 'SS'],
  LEFT:      ['CS', '5'],
  DOWN:      ['CS', '6'],
  UP:        ['CS', '7'],
  RIGHT:     ['CS', '8'],
};

const PC_KEYS = {
  Enter: 'ENTER', ' ': 'SPACE', Backspace: 'BACKSPACE', Tab: 'EXT',
  CapsLock: 'CAPSLOCK', Escape: 'EDIT',
  F2: 'F2', F3: 'F3', F4: 'F4',
  ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP', ArrowRight: 'RIGHT',
  ShiftLeft: 'CS', ShiftRight: 'CS2',
  ControlLeft: 'SS', ControlRight: 'SS', AltLeft: 'SS', AltRight: 'SS',
};

const SHIFTS = { CS: 'CS', CS2: 'CS', SS: 'SS' };

// The ROM only believes a key it has seen in two scans running, so a tap has
// to last several frames. Counted in the machine's own frames, not in the
// browser's milliseconds: if the browser stops to think — starting the sound
// card, say — the machine stops with it, and a tap measured by the clock would
// pass by unseen.
const MIN_HOLD_FRAMES = 5;

export class Keyboard {
  constructor(el, machine, onAction = () => {}) {
    this.el = el;
    this.machine = machine;
    this.onAction = onAction;
    this.nodes = new Map();
    this.latched = { CS: false, SS: false };
    this.pressedAt = new Map();
    this.pending = [];
    this.render();
    this.listen();
  }

  render() {
    this.el.style.gridTemplateColumns = `repeat(${COLUMNS}, 1fr)`;
    for (let r = 0; r < LAYOUT.length; r++) {
      let col = 1;
      for (const id of LAYOUT[r]) {
        const span = SPAN[id] || U;
        const cap = this.renderKey(key(id));
        cap.style.gridColumn = `${col} / span ${span}`;
        cap.style.gridRow = `${r + 1}`;
        this.el.appendChild(cap);
        col += span;
      }
    }
  }

  renderKey(k) {
    const isLetter = /^[A-Z]$/.test(k.id) && !EXTRA[k.id];
    const kind = k.kind || (k.special ? 'mod' : isLetter ? 'letter' : 'digit');

    const cap = document.createElement('button');
    cap.type = 'button';
    cap.className = 'cap';
    cap.dataset.id = k.id;
    cap.dataset.kind = kind;

    const line = cls => {
      const d = document.createElement('div');
      d.className = 'line ' + cls;
      return d;
    };
    const bit = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      return s;
    };

    const plain = kind === 'mod' || kind === 'util' || kind === 'fn';

    const top = line('top');
    top.appendChild(bit(plain ? 'main main-plain' : 'main', k.main));
    if (k.colour !== undefined) {
      const sw = bit('swatch', '');
      sw.dataset.colour = k.colour;
      top.appendChild(sw);
    }
    if (k.symbol) top.appendChild(bit('ss', k.symbol));
    cap.appendChild(top);

    if (k.hint) {
      const h = line('mid');
      h.appendChild(bit('hint', k.hint));
      cap.appendChild(h);
    }

    // A letter's middle line is its one-key keyword; a digit's is what CAPS SHIFT
    // does with it, which is too long to sit beside anything else.
    const middle = isLetter ? k.keyword : (kind === 'digit' ? k.above : null);
    if (middle) {
      const mid = line('mid');
      mid.appendChild(bit(isLetter ? 'kw' : 'ext white', middle));
      cap.appendChild(mid);
    }

    if (isLetter ? (k.above || k.below) : (kind === 'digit' && k.below)) {
      const bottom = line('bottom');
      if (isLetter) bottom.appendChild(bit('ext green', k.above || ''));
      else bottom.classList.add('one');
      bottom.appendChild(bit('ext red', k.below || ''));
      cap.appendChild(bottom);
    }

    if (k.id === 'ENTER') {
      for (const part of ['iso-lower', 'iso-upper']) {
        const d = document.createElement('span');
        d.className = part;
        cap.appendChild(d);
      }
    }

    if (k.id === 'SPACE') {
      const b = line('mid');
      b.appendChild(bit('hint', 'BREAK'));
      cap.appendChild(b);
    }

    this.nodes.set(k.id, cap);
    return cap;
  }

  listen() {
    this.el.addEventListener('pointerdown', e => {
      const cap = e.target.closest('.cap');
      if (!cap) return;
      e.preventDefault();
      cap.setPointerCapture(e.pointerId);
      this.down(cap.dataset.id, true);
    });
    this.el.addEventListener('pointerup', e => {
      const cap = e.target.closest('.cap');
      if (cap) this.up(cap.dataset.id, true);
    });
    this.el.addEventListener('pointercancel', e => {
      const cap = e.target.closest('.cap');
      if (cap) this.up(cap.dataset.id, true);
    });

    addEventListener('keydown', e => {
      const id = this.translate(e);
      if (!id || e.repeat) return;
      e.preventDefault();
      this.down(id, false);
    });
    addEventListener('keyup', e => {
      const id = this.translate(e);
      if (!id) return;
      e.preventDefault();
      this.up(id, false);
    });
    // A window that loses focus must not leave a key stuck down.
    addEventListener('blur', () => this.releaseAll());
  }

  translate(e) {
    if (PC_KEYS[e.code]) return PC_KEYS[e.code];
    if (PC_KEYS[e.key]) return PC_KEYS[e.key];
    const k = e.key.toUpperCase();
    return spectrum[k] ? k : null;
  }

  // ---- the matrix ------------------------------------------------------

  matrix(id, down) {
    const k = spectrum[id];
    if (!k || !k.matrix) return;
    this.machine.setKey(k.matrix[0], k.matrix[1], down);
  }

  paint(id, on, cls) {
    const n = this.nodes.get(id);
    if (n) n.classList.toggle(cls, on);
  }

  shift(which, on) {
    this.latched[which] = on;
    this.matrix(which, on);
    for (const [id, w] of Object.entries(SHIFTS)) if (w === which) this.paint(id, on, 'held');
  }

  down(id, byPointer) {
    if (id.startsWith('F') && id.length === 2) { this.onAction(id); this.paint(id, true, 'down'); return; }

    // A shift tapped with a finger latches; a shift held on a real keyboard
    // simply stays down.
    if (SHIFTS[id]) {
      const which = SHIFTS[id];
      this.shift(which, byPointer ? !this.latched[which] : true);
      return;
    }

    this.paint(id, true, 'down');
    this.pressedAt.set(id, this.machine.frames);
    const parts = COMBO[id];
    if (parts) {
      for (const part of parts) this.matrix(part, true);
      if (id === 'CAPSLOCK' || id === 'EXT') this.paint(id, true, 'latched');
    } else {
      this.matrix(id, true);
    }
  }

  up(id, byPointer) {
    if (id.startsWith('F') && id.length === 2) { this.paint(id, false, 'down'); return; }
    if (SHIFTS[id]) {
      if (!byPointer) this.shift(SHIFTS[id], false);
      return;
    }

    this.paint(id, false, 'down');

    // The machine only looks at the keyboard fifty times a second, so hold the
    // key down for a few of its frames before letting go.
    const held = this.machine.frames - (this.pressedAt.get(id) ?? 0);
    const release = () => {
      const parts = COMBO[id];
      if (parts) for (const part of parts) { if (!this.latched[SHIFTS[part]]) this.matrix(part, false); }
      else this.matrix(id, false);
      for (const which of ['CS', 'SS']) if (this.latched[which]) this.shift(which, false);
      if (parts) this.paint(id, false, 'latched');
    };
    if (held >= MIN_HOLD_FRAMES) release(); else this.after(MIN_HOLD_FRAMES - held, release);
  }

  // Work to do once the machine has run so many more frames. Driven by tick(),
  // which the main loop calls after every frame.
  after(frames, run) { this.pending.push({ at: this.machine.frames + frames, run }); }
  waitFrames(frames) { return new Promise(done => this.after(frames, done)); }

  tick() {
    if (!this.pending.length) return;
    const now = this.machine.frames;
    const due = this.pending.filter(job => now >= job.at);
    if (!due.length) return;
    this.pending = this.pending.filter(job => now < job.at);
    for (const job of due) job.run();
  }

  // Types a sequence of key presses into the machine, holding each one long
  // enough for the ROM to notice — the way a finger would.
  async type(sequence, hold = MIN_HOLD_FRAMES, gap = 7) {
    for (const combo of sequence) {
      // A key of ours stands for a combination; the matrix only knows the
      // machine's own forty.
      const parts = combo.flatMap(id => COMBO[id] ?? [id]);
      for (const id of combo) this.paint(id, true, 'down');
      for (const id of parts) this.matrix(id, true);
      await this.waitFrames(hold);
      for (const id of parts) this.matrix(id, false);
      for (const id of combo) this.paint(id, false, 'down');
      await this.waitFrames(gap);
    }
  }

  releaseAll() {
    this.machine.releaseAllKeys();
    this.pending.length = 0;
    this.latched.CS = this.latched.SS = false;
    for (const n of this.nodes.values()) n.classList.remove('down', 'held', 'latched');
  }
}
