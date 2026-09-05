// The 40-key rubber keyboard: its picture, and the 8x5 matrix behind it.

import { KEYS } from './rom-data.js';

const ROW_LENGTH = 10;
const byId = Object.fromEntries(KEYS.map(k => [k.id, k]));

// Which physical PC key stands in for which Spectrum key.
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
    this.sticky = { CS: false, SS: false };   // click a shift, then click a key
    this.render();
    this.listen();
  }

  render() {
    const frag = document.createDocumentFragment();
    for (let r = 0; r < KEYS.length; r += ROW_LENGTH) {
      const row = document.createElement('div');
      row.className = 'kbd-row';
      for (const k of KEYS.slice(r, r + ROW_LENGTH)) {
        row.appendChild(this.renderKey(k));
      }
      frag.appendChild(row);
    }
    this.el.appendChild(frag);
  }

  renderKey(k) {
    const cell = document.createElement('div');
    cell.className = 'key-cell';
    cell.dataset.id = k.id;

    const above = document.createElement('div');
    above.className = 'legend above ' + (k.special || /^[0-9]$/.test(k.id) ? 'white' : 'green');
    above.textContent = k.above || '';

    const cap = document.createElement('button');
    cap.className = 'cap' + (k.special ? ' cap-special' : '');
    cap.type = 'button';

    if (k.symbol) {
      const s = document.createElement('span');
      s.className = 'ss';
      s.textContent = k.symbol;
      cap.appendChild(s);
    }
    if (k.colour !== undefined) {
      const c = document.createElement('span');
      c.className = 'swatch';
      c.dataset.colour = k.colour;
      cap.appendChild(c);
    }
    const main = document.createElement('span');
    main.className = 'main' + (k.special ? ' main-special' : '');
    main.textContent = k.main;
    cap.appendChild(main);

    if (k.keyword) {
      const kw = document.createElement('span');
      kw.className = 'kw';
      kw.textContent = k.keyword;
      cap.appendChild(kw);
    }

    const below = document.createElement('div');
    below.className = 'legend below red';
    below.textContent = k.below || '';

    cell.append(above, cap, below);
    this.nodes.set(k.id, cell);
    return cell;
  }

  listen() {
    this.el.addEventListener('pointerdown', e => {
      const cell = e.target.closest('.key-cell');
      if (!cell) return;
      e.preventDefault();
      this.press(cell.dataset.id);
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

  // Clicking CAPS SHIFT or SYMBOL SHIFT latches it until the next key.
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
