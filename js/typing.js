// Turning a line of BASIC into the keys a finger would press.
//
// On this machine a word is not spelled out — it arrives whole, from one key.
// Which key, and with which shift, depends on where the word stands: PRINT is
// a single press at the start of a statement, THEN is SYMBOL SHIFT + G, RND
// needs the extended mode first. All of that is worked out from the ROM's own
// tables, the same ones that put the words on the keycaps.

import { KEYS } from './rom-data.js';

const byKeyword = {};      // word -> key, pressed alone at a statement's start
const bySymbol = {};       // word or sign -> key, with SYMBOL SHIFT
const byExtended = {};     // word -> key, after the extended-mode key
const byExtendedShift = {};// word or sign -> key, extended mode and SYMBOL SHIFT

for (const k of KEYS) {
  const letter = /^[A-Z]$/.test(k.id);
  if (k.keyword) byKeyword[k.keyword] = k.id;
  if (k.symbol) bySymbol[k.symbol] = k.id;
  if (letter && k.above) byExtended[k.above] = k.id;
  if (k.below && !k.special) byExtendedShift[k.below] = k.id;
}

const WORDS = [...new Set([
  ...Object.keys(byKeyword), ...Object.keys(bySymbol),
  ...Object.keys(byExtended), ...Object.keys(byExtendedShift),
])].filter(word => word.length > 1).sort((a, b) => b.length - a.length);

function forCharacter(ch) {
  if (ch === ' ') return [['SPACE']];
  if (/[0-9]/.test(ch)) return [[ch]];
  if (/[a-z]/.test(ch)) return [[ch.toUpperCase()]];
  if (/[A-Z]/.test(ch)) return [['CS', ch]];
  if (bySymbol[ch]) return [['SS', bySymbol[ch]]];
  if (byExtendedShift[ch]) return [['EXT'], ['SS', byExtendedShift[ch]]];
  if (byExtended[ch]) return [['EXT'], [byExtended[ch]]];
  return [];
}

function forWord(word, atStatementStart) {
  if (atStatementStart && byKeyword[word]) return [[byKeyword[word]]];
  if (bySymbol[word]) return [['SS', bySymbol[word]]];
  if (byExtended[word]) return [['EXT'], [byExtended[word]]];
  if (byExtendedShift[word]) return [['EXT'], ['SS', byExtendedShift[word]]];
  return null;
}

export function keystrokes(line) {
  const out = [];
  let i = 0;
  let numbering = true;        // still inside the line number
  let statement = true;        // a keyword may be typed with one key here

  while (i < line.length) {
    const ch = line[i];

    if (numbering && /[0-9 ]/.test(ch)) {
      out.push(...forCharacter(ch));
      i++;
      continue;
    }
    numbering = false;

    let word = null;
    for (const candidate of WORDS) if (line.startsWith(candidate, i)) { word = candidate; break; }
    const keys = word && forWord(word, statement);
    if (keys) {
      out.push(...keys);
      i += word.length;
      // The machine writes its own space after a word; don't type a second one.
      if (line[i] === ' ') i++;
      if (word === 'REM') {                        // a remark is plain text
        for (; i < line.length; i++) out.push(...forCharacter(line[i]));
        break;
      }
      statement = word === 'THEN';
      continue;
    }

    out.push(...forCharacter(ch));
    statement = ch === ':' || (statement && ch === ' ');
    i++;
  }
  return out;
}

// A whole listing: every line, each finished with ENTER.
export const typing = lines =>
  lines.flatMap(line => [...keystrokes(line), ['ENTER']]);
