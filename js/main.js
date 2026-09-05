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
  state.typed = true;

  switch (id) {
    case 'BACKSPACE': state.line = state.line.slice(0, -1); return finish();
    case 'CAPSLOCK':  state.caps = !state.caps; return finish();
    case 'EXT':       state.ext = !state.ext; return finish();
    case 'ENTER':     state.line = ''; state.ext = false; return finish();
    case 'F1':        state.line = ''; state.caps = state.ext = false;
                      state.typed = false; return finish();
    case 'F2': case 'F3': case 'F4': return;   // waiting on the Z80
  }

  // Both shifts together are how the real machine reaches extended mode.
  if (mods.CS && mods.SS) { state.ext = !state.ext; return finish(); }

  const k = byId[id];
  if (!k) return;

  if (id === 'SPACE') {
    if (!mods.CS) insert(' ');
  } else if (/^[A-Z]$/.test(id)) {
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
  finish();
}

function finish() {
  keyboard.setLatch('CAPSLOCK', state.caps);
  keyboard.setLatch('EXT', state.ext);
  draw();
}

const keyboard = new Keyboard(document.getElementById('keyboard'), handle);

draw();
(function loop() {
  display.tick();
  display.render();
  requestAnimationFrame(loop);
})();
