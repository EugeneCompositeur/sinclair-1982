// The graphics as a block of memory, ready to be dropped straight in.
//
// A BASIC loop that POKEs a thousand bytes takes the better part of a minute
// on a real Spectrum. Games never did that: they carried their graphics as a
// second block on the tape and loaded it in one go. So does this one.
//
// The block holds a complete character set — the ROM's own, with Russian
// letters in place of the lowercase Latin — followed by the sprites.
//
//   node tools/make-blob.js tapes/syshchik.bin

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { font } from './make-cyrillic.js';
import { sprites } from './make-sprites.js';

const rom = new Uint8Array(readFileSync(new URL('../roms/48.rom', import.meta.url)));

const characters = new Uint8Array(rom.subarray(0x3d00, 0x3d00 + 768));
characters.set(font(), (96 - 32) * 8);      // Russian goes where lowercase was

const blob = new Uint8Array(characters.length + 160);
blob.set(characters, 0);
blob.set(sprites(), characters.length);

const out = process.argv[2];
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, blob);
  console.log(`${out}: ${characters.length} bytes of character set + ${blob.length - characters.length} of sprites`);
}
export { blob };
