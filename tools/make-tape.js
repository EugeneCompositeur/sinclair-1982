// Turns a BASIC listing into a .tap file the machine can LOAD.
//
// Three things have to be right for the interpreter to accept a program:
// keywords must be single token bytes, every number must carry its binary
// value alongside the digits, and each tape block must end with a checksum.
//
//   node tools/make-tape.js games/gumshoe.bas tapes/gumshoe.tap GUMSHOE 10

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { ALPHABET } from './make-cyrillic.js';

const rom = new Uint8Array(readFileSync(new URL('../roms/48.rom', import.meta.url)));

// The token names, read out of the ROM itself. The table opens with a dummy
// entry, so the first real token — RND — is code 165.
const tokens = [];
{
  let p = 0x0095, code = 164, cur = '';
  while (code <= 255) {
    const b = rom[p++];
    cur += String.fromCharCode(b & 0x7f);
    if (b & 0x80) { if (code >= 165) tokens.push([cur, code]); cur = ''; code++; }
  }
}
// Longest first, so GO SUB is never mistaken for GO TO's beginning.
tokens.sort((a, b) => b[0].length - a[0].length);
const REM = 234;

const isWordChar = c => c !== undefined && /[A-Za-z0-9]/.test(c);

// Russian letters are written plainly in the source and land on codes 96..127,
// where the program's own character set puts them.
const CYRILLIC = new Map(ALPHABET.split('').map((letter, i) => [letter, 96 + i]));
function zxCode(ch) {
  const upper = ch.toUpperCase() === 'Ё' ? 'Е' : ch.toUpperCase();
  return CYRILLIC.get(upper) ?? (ch.charCodeAt(0) & 255);
}

// The five bytes the interpreter actually reads when it meets a number.
// Whole numbers that fit in sixteen bits get the short form; everything else
// is a sign, an exponent and a thirty-two bit mantissa.
export function encodeNumber(v) {
  if (Number.isInteger(v) && Math.abs(v) < 65536) {
    const u = v < 0 ? v + 65536 : v;
    return [0, v < 0 ? 0xff : 0x00, u & 255, (u >> 8) & 255, 0];
  }
  let x = Math.abs(v), e = 0;
  if (x !== 0) {
    while (x >= 1) { x /= 2; e++; }
    while (x < 0.5) { x *= 2; e--; }
  }
  let mant = Math.round(x * 4294967296);
  if (mant > 0xffffffff) { mant = Math.round(mant / 2); e++; }
  const bytes = [(mant >>> 24) & 255, (mant >>> 16) & 255, (mant >>> 8) & 255, mant & 255];
  bytes[0] = v < 0 ? (bytes[0] | 0x80) : (bytes[0] & 0x7f);
  return [(e + 128) & 255, ...bytes];
}

// Lines are sorted by number so an #included block can sit anywhere.
export function tokenizeLine(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {                         // strings pass through untouched
      out.push(34); i++;
      while (i < text.length) {
        out.push(zxCode(text[i]));
        const wasQuote = text[i] === '"';
        i++;
        if (wasQuote) break;
      }
      continue;
    }

    let hit = null;
    for (const [name, code] of tokens) {
      if (!text.startsWith(name, i)) continue;
      if (/^[A-Z]/.test(name) && isWordChar(text[i - 1])) continue;
      if (/[A-Z]$/.test(name) && isWordChar(text[i + name.length])) continue;
      hit = [name, code];
      break;
    }
    if (hit) {
      out.push(hit[1]);
      i += hit[0].length;
      if (hit[1] === REM) {                        // a remark is text, not code
        for (; i < text.length; i++) out.push(zxCode(text[i]));
      }
      continue;
    }

    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/.exec(text.slice(i));
    if (number && !isWordChar(text[i - 1]) && text[i - 1] !== '$') {
      for (const c of number[0]) out.push(c.charCodeAt(0));
      out.push(0x0e, ...encodeNumber(parseFloat(number[0])));
      i += number[0].length;
      continue;
    }

    out.push(zxCode(text[i]));
    i++;
  }
  return out;
}

// #include pulls in another listing — the character set lives in its own file.
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

export function assemble(source, base = '.') {
  const numbered = [];
  for (const raw of expand(source, base)) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const m = /^\s*(\d+)\s?(.*)$/.exec(line);
    if (!m) throw new Error(`line without a number: ${line}`);
    numbered.push([Number(m[1]), m[2]]);
  }
  numbered.sort((a, b) => a[0] - b[0]);

  const program = [];
  for (const [number, text] of numbered) {
    const body = tokenizeLine(text);
    body.push(0x0d);
    program.push((number >> 8) & 255, number & 255, body.length & 255, (body.length >> 8) & 255, ...body);
  }
  return Uint8Array.from(program);
}

const checksum = bytes => bytes.reduce((a, b) => a ^ b, 0);

const block = bytes => {
  const body = Uint8Array.from([...bytes, checksum(bytes)]);
  return Uint8Array.from([body.length & 255, (body.length >> 8) & 255, ...body]);
};

// A CODE block: a lump of memory with an address to put it back at.
export function makeCode(bytes, name, address) {
  const title = (name + '          ').slice(0, 10);
  const header = [
    0x00, 0x03,                                       // header, CODE
    ...[...title].map(c => c.charCodeAt(0)),
    bytes.length & 255, (bytes.length >> 8) & 255,
    address & 255, (address >> 8) & 255,              // where it belongs
    0x00, 0x80,
  ];
  return Uint8Array.from([...block(header), ...block([0xff, ...bytes])]);
}

export function makeTape(program, name, autostart) {
  const title = (name + '          ').slice(0, 10);
  const start = autostart === undefined ? 32768 : autostart;
  const header = [
    0x00, 0x00,                                        // header, program
    ...[...title].map(c => c.charCodeAt(0)),
    program.length & 255, (program.length >> 8) & 255,  // length of what follows
    start & 255, (start >> 8) & 255,                    // line to run on loading
    program.length & 255, (program.length >> 8) & 255,  // where the variables start
  ];
  return Uint8Array.from([...block(header), ...block([0xff, ...program])]);
}

const [, , input, output, name = 'PROGRAM', autostart, codeFile, codeAddr] = process.argv;
if (input) {
  const program = assemble(readFileSync(input, 'utf8'), dirname(input));
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
