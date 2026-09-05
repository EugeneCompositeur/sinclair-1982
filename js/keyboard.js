// The keyboard: a modern staggered layout carrying the Spectrum's five meanings
// per key, over the machine's real 8x5 matrix.

import { KEYS } from './rom-data.js';

const byId = Object.fromEntries(KEYS.map(k => [k.id, k]));

// Rows are laid out on a grid of quarter-key columns, 46 wide, so the stagger
// and the wide keys land on exact fractions the way a real keyboard's do.
const U = 4;
const COLUMNS = 46;
const WIDE = { ENTER: 7, CS: 7, SS: 7, SPACE: 22 };

const LAYOUT = [
  { pad: 0, keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] },
  { pad: 2, keys: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'] },
  { pad: 3, keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'ENTER'] },
  { pad: 0, keys: ['CS', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'SS'] },
  { pad: 12, keys: ['SPACE'] },
];

const PC_KEYS = {
  Enter: 'ENTER', ' ': 'SPACE',
  ShiftLeft: 'CS', ShiftRight: 'CS',
  ControlLeft: 'SS', ControlRight: 'SS', AltLeft: 'SS', AltRight: 'SS',
};

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
    const frag = document.createDocumentFragment();
    for (const { pad, keys } of LAYOUT) {
      const row = document.createElement('div');
      row.className = 'kbd-row';
      row.style.gridTemplateColumns = `repeat(${COLUMNS}, 1fr)`;
      let col = 1 + pad;
      for (const id of keys) {
        const span = WIDE[id] || U;
        const cap = this.renderKey(byId[id]);
        cap.style.gridColumn = `${col} / span ${span}`;
        row.appendChild(cap);
        col += span;
      }
      frag.appendChild(row);
    }
    this.el.appendChild(frag);
  }

  renderKey(k) {
    const cap = document.createElement('button');
    cap.type = 'button';
    cap.className = 'cap' + (k.special ? ' cap-special' : '');
    cap.dataset.id = k.id;

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

    const isLetter = /^[A-Z]$/.test(k.id);

    const top = line('top');
    top.appendChild(bit('main' + (k.special ? ' main-special' : ''), k.main));
    if (k.colour !== undefined) {
      const sw = bit('swatch', '');
      sw.dataset.colour = k.colour;
      top.appendChild(sw);
    }
    if (k.symbol) top.appendChild(bit('ss', k.symbol));
    cap.appendChild(top);

    // A letter's middle line is its one-key keyword; a digit's is what CAPS SHIFT
    // does with it, which is too long to sit beside anything else.
    const middle = isLetter ? k.keyword : k.above;
    if (middle) {
      const mid = line('mid');
      mid.appendChild(bit(isLetter ? 'kw' : 'ext white', middle));
      cap.appendChild(mid);
    }

    if (isLetter ? (k.above || k.below) : k.below) {
      const bottom = line('bottom');
      if (isLetter) bottom.appendChild(bit('ext green', k.above || ''));
      bottom.appendChild(bit('ext red', k.below || ''));
      if (!isLetter) bottom.classList.add('one');
      cap.appendChild(bottom);
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
      if (id === 'CS' || id === 'SS') { this.hold(id, true); return; }
      this.fire(id, { CS: e.shiftKey, SS: e.ctrlKey || e.altKey });
      this.flash(id);
    });
    addEventListener('keyup', e => {
      const id = this.translate(e);
      if (id === 'CS' || id === 'SS') this.hold(id, false);
    });
  }

  translate(e) {
    if (PC_KEYS[e.code]) return PC_KEYS[e.code];
    if (PC_KEYS[e.key]) return PC_KEYS[e.key];
    if (e.key === 'Backspace') return 'BACKSPACE';
    const k = e.key.toUpperCase();
    return byId[k] ? k : null;
  }

  // Tapping a shift latches it until the next key, so one finger is enough.
  press(id) {
    if (id === 'CS' || id === 'SS') {
      this.sticky[id] = !this.sticky[id];
      this.nodes.get(id).classList.toggle('held', this.sticky[id]);
      return;
    }
    const mods = { ...this.sticky };
    this.sticky.CS = this.sticky.SS = false;
    for (const s of ['CS', 'SS']) this.nodes.get(s).classList.remove('held');
    this.fire(id, mods);
    this.flash(id);
  }

  hold(id, down) {
    this.sticky[id] = down;
    this.nodes.get(id).classList.toggle('held', down);
  }

  fire(id, mods) {
    if (id === 'BACKSPACE') { this.onPress('0', { CS: true, SS: false }); return; }
    this.onPress(id, mods);
  }

  flash(id) {
    const n = this.nodes.get(id);
    if (!n) return;
    n.classList.add('down');
    setTimeout(() => n.classList.remove('down'), 90);
  }
}
