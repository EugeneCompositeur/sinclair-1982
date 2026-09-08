// Where your own programs live.
//
// SAVE "имя" on the machine produces exactly what a cassette recorder would
// have heard: a header block naming the program, then a block of the program
// itself. We catch both and keep them in the browser's own storage as a .tap —
// the same format as the tapes on the shelf, so a saved program can be loaded
// back, downloaded as a file, or carried to any other Spectrum emulator.

const STORE = 'sinclair-1982.tapes';

const toBase64 = bytes => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

// A .tap is just its blocks, each behind its own two-byte length.
export function wrapBlocks(blocks) {
  const total = blocks.reduce((n, b) => n + b.length + 2, 0);
  const tape = new Uint8Array(total);
  let p = 0;
  for (const block of blocks) {
    tape[p++] = block.length & 255;
    tape[p++] = (block.length >> 8) & 255;
    tape.set(block, p);
    p += block.length;
  }
  return tape;
}

// The name and kind a header block carries.
export function describe(bytes) {
  if (bytes.length < 19 || bytes[0] !== 0x00) return null;
  const kind = ['программа', 'массив чисел', 'массив строк', 'блок кода'][bytes[1]] ?? 'что-то';
  return { kind, name: String.fromCharCode(...bytes.subarray(2, 12)).trim() };
}

function read() {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; }
}

function write(list) {
  try { localStorage.setItem(STORE, JSON.stringify(list)); return true; }
  catch { return false; }        // storage full or forbidden
}

export const saved = () => read().map(item => ({ ...item, bytes: () => fromBase64(item.tape) }));

export function keep(name, bytes, kind = 'программа') {
  const list = read();
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  list.unshift({ id, name: name || 'БЕЗ ИМЕНИ', kind, when: Date.now(), size: bytes.length, tape: toBase64(bytes) });
  return write(list) ? id : null;
}

export function forget(id) {
  write(read().filter(item => item.id !== id));
}

export function rename(id, name) {
  const list = read();
  const item = list.find(i => i.id === id);
  if (item) { item.name = name; write(list); }
}

// Hands the file to the browser to save wherever the user keeps things.
export function download(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(name || 'tape').toLowerCase().replace(/[^a-zа-я0-9._-]+/gi, '-')}.tap`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
