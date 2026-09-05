// The keyboard. A modern staggered layout over the machine's real 8x5 matrix,
// plus the keys 1982 never had: a backspace, a caps lock, a second caps shift,
// a dedicated extended-mode key, and four keys for everything the original
// couldn't do.

import { KEYS } from './rom-data.js';

const spectrum = Object.fromEntries(KEYS.map(k => [k.id, k]));

// Keys of our own. `hint` names the original finger-breaking combination.
const EXTRA = {
  BACKSPACE: { id: 'BACKSPACE', main: 'BACKSPACE', hint: 'CS + 0', kind: 'util' },
  CAPSLOCK:  { id: 'CAPSLOCK',  main: 'CAPS LOCK', hint: 'CS + 2', kind: 'util' },
  EXT:       { id: 'EXT',       main: 'E',         hint: 'MODE',   kind: 'util' },
  CS2:       { id: 'CS2',       main: 'CAPS SHIFT',                kind: 'mod' },
  F1: { id: 'F1', main: 'RESET', kind: 'fn' },
  F2: { id: 'F2', main: 'LOAD',  kind: 'fn' },
  F3: { id: 'F3', main: 'STATE', kind: 'fn' },
  F4: { id: 'F4', main: 'SPEED', kind: 'fn' },
};

const key = id => spectrum[id] || EXTRA[id];

// One grid for the whole keyboard, 49 quarter-key columns wide, so the stagger
// lands on exact fractions and ENTER can stand two rows tall.
const COLUMNS = 49;
const U = 4;
const SPAN = {
  BACKSPACE: 9, EXT: 3, ENTER: 6, CAPSLOCK: 7,
  CS: 8, SS: 7, CS2: 6, SPACE: 25, F1: 6, F2: 6, F3: 6, F4: 6,
};

const LAYOUT = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'BACKSPACE'],
  ['EXT', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'ENTER'],
  ['CAPSLOCK', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['CS', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'SS', 'CS2'],
  ['F1', 'F2', 'SPACE', 'F3', 'F4'],
];

const PC_KEYS = {
  Enter: 'ENTER', ' ': 'SPACE', Backspace: 'BACKSPACE', Tab: 'EXT',
  CapsLock: 'CAPSLOCK', Escape: 'F1',
  ShiftLeft: 'CS', ShiftRight: 'CS2',
  ControlLeft: 'SS', ControlRight: 'SS', AltLeft: 'SS', AltRight: 'SS',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4',
};

const SHIFTS = { CS: 'CS', CS2: 'CS', SS: 'SS' };

export class Keyboard {
  constructor(el, onPress) {
    this.el = el;
    this.onPress = onPress;
    this.nodes = new Map();
    this.sticky = { CS: false, SS: false };
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
        // ENTER stands over both letter rows, the way a full-size keyboard's does.
        cap.style.gridRow = id === 'ENTER' ? `${r + 1} / span 2` : `${r + 1}`;
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
      this.press(cap.dataset.id);
    });

    addEventListener('keydown', e => {
      const id = this.translate(e);
      if (!id) return;
      e.preventDefault();
      if (SHIFTS[id]) { this.hold(id, true); return; }
      this.onPress(id, { CS: e.shiftKey, SS: e.ctrlKey || e.altKey });
      this.flash(id);
    });
    addEventListener('keyup', e => {
      const id = this.translate(e);
      if (id && SHIFTS[id]) this.hold(id, false);
    });
  }

  translate(e) {
    if (PC_KEYS[e.code]) return PC_KEYS[e.code];
    if (PC_KEYS[e.key]) return PC_KEYS[e.key];
    const k = e.key.toUpperCase();
    return spectrum[k] ? k : null;
  }

  // Tapping a shift latches it until the next key, so one finger is enough.
  press(id) {
    if (SHIFTS[id]) {
      const which = SHIFTS[id];
      this.sticky[which] = !this.sticky[which];
      this.markShift(which);
      return;
    }
    const mods = { ...this.sticky };
    this.sticky.CS = this.sticky.SS = false;
    this.markShift('CS'); this.markShift('SS');
    this.onPress(id, mods);
    this.flash(id);
  }

  hold(id, down) {
    this.sticky[SHIFTS[id]] = down;
    this.markShift(SHIFTS[id]);
  }

  markShift(which) {
    for (const [id, w] of Object.entries(SHIFTS)) {
      if (w !== which) continue;
      const n = this.nodes.get(id);
      if (n) n.classList.toggle('held', this.sticky[which]);
    }
  }

  setLatch(id, on) {
    const n = this.nodes.get(id);
    if (n) n.classList.toggle('latched', on);
  }

  flash(id) {
    const n = this.nodes.get(id);
    if (!n) return;
    n.classList.add('down');
    setTimeout(() => n.classList.remove('down'), 90);
  }
}
