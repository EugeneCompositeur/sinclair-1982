// The shelf: what tapes are on it, read out of the tapes themselves.
//
// A browser cannot look inside a folder, so the list has to exist as a file.
// This builds it from the .tap files, taking each one's name from its own
// header block — the same ten characters the machine shows while loading.
//
//   node tools/make-shelf.js

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const NOTES = {
  'syshchik.tap': 'Ночная улица, пять дверей и вор за одной из них. По-русски.',
  'gumshoe.tap': 'The same case in English, on a map of the city.',
  'hello.tap': 'Три строки, с которых всё началось.',
};

const dir = new URL('../tapes/', import.meta.url).pathname;
const shelf = [];

for (const file of readdirSync(dir).filter(f => f.endsWith('.tap')).sort()) {
  const bytes = new Uint8Array(readFileSync(join(dir, file)));
  const blocks = [];
  for (let p = 0; p + 1 < bytes.length;) {
    const length = bytes[p] | (bytes[p + 1] << 8);
    p += 2;
    if (!length || p + length > bytes.length) break;
    blocks.push(bytes.subarray(p, p + length));
    p += length;
  }
  const header = blocks.find(b => b[0] === 0x00 && b.length >= 19);
  shelf.push({
    file,
    name: header ? String.fromCharCode(...header.subarray(2, 12)).trim() : file.replace('.tap', ''),
    blocks: blocks.length,
    bytes: bytes.length,
    note: NOTES[file] || '',
  });
}

const out = new URL('../tapes/index.json', import.meta.url).pathname;
writeFileSync(out, JSON.stringify(shelf, null, 2) + '\n');
console.log(`tapes/index.json: ${shelf.length} tapes — ${shelf.map(t => t.name).join(', ')}`);
