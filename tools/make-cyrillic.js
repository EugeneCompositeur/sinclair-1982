// A Cyrillic character set for the Spectrum, in the ROM's own hand.
//
// The machine has no Russian letters: codes 32..127 are plain ASCII. Soviet
// clones solved it the only way possible — by pointing the CHARS system
// variable at a character set in RAM and putting Cyrillic where the lowercase
// Latin used to be. That is exactly what happens here.
//
// Letters whose shape Russian shares with Latin are not redrawn: they are
// lifted straight out of the ROM, so they match the rest of the font exactly.
//
//   node tools/make-cyrillic.js > games/cyrillic.bas

import { readFileSync } from 'fs';

const rom = new Uint8Array(readFileSync(new URL('../roms/48.rom', import.meta.url)));
const fromRom = ch => [...rom.subarray(0x3d00 + (ch.charCodeAt(0) - 32) * 8, 0x3d00 + (ch.charCodeAt(0) - 32) * 8 + 8)];

const drawn = rows => rows.map(r => parseInt(r.replace(/\./g, '0').replace(/#/g, '1'), 2));

// The order is А..Я without Ё — thirty-two letters for codes 96..127.
export const ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

const glyphs = {
  А: fromRom('A'), В: fromRom('B'), Е: fromRom('E'), К: fromRom('K'),
  М: fromRom('M'), Н: fromRom('H'), О: fromRom('O'), Р: fromRom('P'),
  С: fromRom('C'), Т: fromRom('T'), Х: fromRom('X'),

  Б: drawn(['........', '.######.', '.#......', '.#####..', '.#....#.', '.#....#.', '.#####..', '........']),
  Г: drawn(['........', '.######.', '.#......', '.#......', '.#......', '.#......', '.#......', '........']),
  Д: drawn(['........', '..#####.', '..#...#.', '..#...#.', '.##...#.', '#######.', '#.....#.', '........']),
  Ж: drawn(['........', '.#.#.#..', '.#.#.#..', '..###...', '..###...', '.#.#.#..', '.#.#.#..', '........']),
  З: drawn(['........', '.#####..', '#.....#.', '....##..', '......#.', '#.....#.', '.#####..', '........']),
  И: drawn(['........', '.#....#.', '.#...##.', '.#..#.#.', '.#.#..#.', '.##...#.', '.#....#.', '........']),
  Й: drawn(['..####..', '.#....#.', '.#...##.', '.#..#.#.', '.#.#..#.', '.##...#.', '.#....#.', '........']),
  Л: drawn(['........', '...####.', '...#..#.', '..##..#.', '..#...#.', '.#....#.', '.#....#.', '........']),
  П: drawn(['........', '.######.', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '........']),
  У: drawn(['........', '.#....#.', '.#....#.', '..#...#.', '...####.', '......#.', '.#####..', '........']),
  Ф: drawn(['........', '...#....', '.#####..', '.#.#.#..', '.#.#.#..', '.#####..', '...#....', '........']),
  Ц: drawn(['........', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '.######.', '......#.', '........']),
  Ч: drawn(['........', '.#....#.', '.#....#.', '.#....#.', '..#####.', '......#.', '......#.', '........']),
  Ш: drawn(['........', '.#.#.#..', '.#.#.#..', '.#.#.#..', '.#.#.#..', '.#.#.#..', '.#####..', '........']),
  Щ: drawn(['........', '.#.#.#..', '.#.#.#..', '.#.#.#..', '.#.#.#..', '.######.', '......#.', '........']),
  Ъ: drawn(['........', '##......', '.#......', '.#####..', '.#....#.', '.#....#.', '.#####..', '........']),
  Ы: drawn(['........', '.#....#.', '.#....#.', '.###..#.', '.#..#.#.', '.#..#.#.', '.###..#.', '........']),
  Ь: drawn(['........', '.#......', '.#......', '.#####..', '.#....#.', '.#....#.', '.#####..', '........']),
  Э: drawn(['........', '.#####..', '#.....#.', '...####.', '......#.', '#.....#.', '.#####..', '........']),
  Ю: drawn(['........', '.#...##.', '.#..#..#', '.####..#', '.####..#', '.#..#..#', '.#...##.', '........']),
  Я: drawn(['........', '..#####.', '.#....#.', '.#....#.', '..#####.', '...#..#.', '.#....#.', '........']),
};

export const font = () => ALPHABET.split('').flatMap(letter => {
  const g = glyphs[letter];
  if (!g) throw new Error(`no glyph for ${letter}`);
  return g;
});

if (process.argv[1] && process.argv[1].endsWith('make-cyrillic.js')) {
  const bytes = font();
  const out = [];
  out.push('9595 REM the character set, letter by letter');
  ALPHABET.split('').forEach((letter, i) => {
    out.push(`${9600 + i} DATA ${bytes.slice(i * 8, i * 8 + 8).join(',')}`);
  });
  console.log(out.join('\n'));
}
