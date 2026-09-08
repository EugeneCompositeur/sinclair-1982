// Turns a BASIC listing into a .tap file the machine can LOAD.
//
// The language itself lives in js/basic.js — the same code the page in the
// browser uses, so a listing behaves identically whether it is built here or
// typed into a lesson.
//
//   node tools/make-tape.js games/syshchik.bas tapes/syshchik.tap SYSHCHIK 3 tapes/syshchik.bin 59392

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { basic } from '../js/basic.js';

const rom = new Uint8Array(readFileSync(new URL('../roms/48.rom', import.meta.url)));
const { assemble, makeTape, makeCode } = basic(rom);

// #include pulls in another listing — a character set or a set of sprites
// living in its own file.
function expand(source, base) {
  const lines = [];
  for (const raw of source.split('\n')) {
    const included = /^\s*#include\s+(\S+)\s*$/.exec(raw);
    if (included) {
      const path = resolve(base, included[1]);
      lines.push(...expand(readFileSync(path, 'utf8'), dirname(path)));
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

const [, , input, output, name = 'PROGRAM', autostart, codeFile, codeAddr] = process.argv;
if (input) {
  const program = assemble(expand(readFileSync(input, 'utf8'), dirname(input)));
  let tape = makeTape(program, name, autostart === undefined ? undefined : Number(autostart));
  let extra = '';
  if (codeFile) {
    const bytes = new Uint8Array(readFileSync(codeFile));
    tape = Uint8Array.from([...tape, ...makeCode(bytes, name, Number(codeAddr))]);
    extra = `, plus ${bytes.length} bytes of code for ${codeAddr}`;
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, tape);
  console.log(`${output}: ${program.length} bytes of BASIC, ${tape.length} bytes of tape` +
    (autostart === undefined ? '' : `, runs from line ${autostart}`) + extra);
}
