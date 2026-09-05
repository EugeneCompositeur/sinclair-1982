// The people of the game, drawn as pictures rather than as numbers.
//
// Each is sixteen pixels square — four of the machine's character cells — and
// is written here the way it looks. The tool cuts each drawing into its four
// cells and prints them as BASIC DATA, in the order the program pokes them
// into the user-defined graphics.
//
//   node tools/make-sprites.js > games/sprites.bas

const SPRITES = {
  // The detective, standing still.
  'СЫЩИК СТОИТ': [
    '................',
    '....########....',
    '...##########...',
    '......####......',
    '.....#....#.....',
    '....##....##....',
    '....#.####.#....',
    '....#.####.#....',
    '....#.####.#....',
    '....#.####.#....',
    '....#.####.#....',
    '.....######.....',
    '......#..#......',
    '......#..#......',
    '.....##..##.....',
    '................',
  ],
  // The same man, mid-stride.
  'СЫЩИК ИДЕТ': [
    '................',
    '....########....',
    '...##########...',
    '......####......',
    '.....#....#.....',
    '...###....###...',
    '..##..####..##..',
    '....#.####.#....',
    '....#.####.#....',
    '....#.####.#....',
    '....#.####.#....',
    '.....######.....',
    '.....#....#.....',
    '....#......#....',
    '...##......##...',
    '................',
  ],
  // The thief, running, with the swag over his shoulder.
  'ВОР БЕЖИТ': [
    '................',
    '.....######.....',
    '....########....',
    '.....######.....',
    '..############..',
    '..#.....#####...',
    '........#####...',
    '.......#####....',
    '......#####.....',
    '.....##..##.....',
    '....##....##....',
    '...##......##...',
    '..##........##..',
    '.##..........##.',
    '................',
    '................',
  ],
  // A witness: the old woman from the ground floor.
  'СТАРУШКА': [
    '................',
    '.....######.....',
    '....########....',
    '....##....##....',
    '.....######.....',
    '....########....',
    '...##########...',
    '..#####..#####..',
    '....########....',
    '....########....',
    '....########....',
    '...##########...',
    '...##########...',
    '....##....##....',
    '....##....##....',
    '................',
  ],
  // A witness: the boy who is always out too late.
  'МАЛЬЧИШКА': [
    '................',
    '....######......',
    '...########.....',
    '.....####.......',
    '....######......',
    '...########.....',
    '..#..####..#....',
    '..#..####..#....',
    '.....####.......',
    '....######......',
    '....#....#......',
    '....#....#......',
    '....#....#......',
    '...##....##.....',
    '................',
    '................',
  ],
};

// A cell is eight rows of eight pixels; the four cells of a sprite run
// top-left, top-right, bottom-left, bottom-right — the order they are printed.
function cells(rows) {
  const bits = (row, from) => parseInt(row.slice(from, from + 8).replace(/\./g, '0').replace(/#/g, '1'), 2);
  const out = [];
  for (const [top, left] of [[0, 0], [0, 8], [8, 0], [8, 8]]) {
    for (let y = 0; y < 8; y++) out.push(bits(rows[top + y], left));
  }
  return out;
}

export const sprites = () => Object.values(SPRITES).flatMap(cells);

if (process.argv[1] && process.argv[1].endsWith('make-sprites.js')) {
  const lines = ['9695 REM люди на улице, по четыре знакоместа на каждого'];
  let n = 9700;
  for (const [name, rows] of Object.entries(SPRITES)) {
    if (rows.length !== 16 || rows.some(r => r.length !== 16)) {
      throw new Error(`${name} is not sixteen by sixteen`);
    }
    const bytes = cells(rows);
    lines.push(`${n++} REM ${name.toLowerCase()}`);
    for (let i = 0; i < 4; i++) lines.push(`${n++} DATA ${bytes.slice(i * 8, i * 8 + 8).join(',')}`);
  }
  console.log(lines.join('\n'));
}
