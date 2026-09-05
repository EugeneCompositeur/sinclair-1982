// Wires the picture together. The editor here is a stand-in: it types the way
// the machine types, but nothing runs yet. It goes away when the Z80 core and
// the real ROM take over.

import { Display, attr, zxCode } from './screen.js';
import { Keyboard } from './keyboard.js';
import { KEYS } from './rom-data.js';

const byId = Object.fromEntries(KEYS.map(k => [k.id, k]));
const COPYRIGHT = '© 1982 Sinclair Research Ltd';
const EDIT_ROW = 23;

const display = new Display(document.getElementById('screen'));
const state = { line: '', caps: false, ext: false, typed: false };

const cursorLetter = () =>
  state.ext ? 'E' : state.line === '' ? 'K' : state.caps ? 'C' : 'L';

function draw() {
  display.clear(attr(0, 7));
  if (!state.typed) {
    display.printAt(EDIT_ROW, 0, COPYRIGHT);
    return;
  }
  const text = state.line.slice(-31);
  display.printAt(EDIT_ROW, 0, text);
  display.charAt(EDIT_ROW, text.length, zxCode(cursorLetter()), attr(7, 0, 0, 1));
}

const insert = ch => { state.line += ch; };

// A keyword arrives as a whole word and brings its spaces with it.
function insertWord(w) {
  if (!w) return;
  if (w.length === 1) { insert(w); return; }
  if (state.line && !state.line.endsWith(' ')) insert(' ');
  insert(w + ' ');
}

function control(digit) {
  if (digit === '0') state.line = state.line.slice(0, -1);   // DELETE
  else if (digit === '2') state.caps = !state.caps;          // CAPS LOCK
}

function handle(id, mods) {
  const k = byId[id];
  if (!k) return;

  if (mods.CS && mods.SS) { state.ext = !state.ext; state.typed = true; draw(); return; }

  state.typed = true;
  if (id === 'ENTER') { state.line = ''; state.ext = false; }
  else if (id === 'SPACE') { if (!mods.CS) insert(' '); }
  else if (/^[A-Z]$/.test(id)) {
    if (state.ext) { insertWord(mods.SS ? k.below : k.above); state.ext = false; }
    else if (mods.SS) insertWord(k.symbol);
    else if (state.line === '') insertWord(k.keyword);
    else insert(state.caps !== !!mods.CS ? id : id.toLowerCase());
  } else if (/^[0-9]$/.test(id)) {
    if (state.ext) { if (mods.SS) insertWord(k.below); state.ext = false; }
    else if (mods.CS) control(id);
    else if (mods.SS) insert(k.symbol);
    else insert(id);
  }
  draw();
}

new Keyboard(document.getElementById('keyboard'), handle);

draw();
(function loop() {
  display.tick();
  display.render();
  requestAnimationFrame(loop);
})();
