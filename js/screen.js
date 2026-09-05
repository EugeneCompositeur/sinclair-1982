// The ULA's half of the machine: 256x192 pixels, 32x24 attribute cells, a border,
// and the flash clock. The framebuffer is laid out exactly as it is at $4000 in
// the real machine, so once the Z80 core lands it can simply write here.

import { FONT_BASE64 } from './rom-data.js';

// The 8x8 character set, lifted from the ROM at $3D00 (codes 32..127).
export const FONT = Uint8Array.from(atob(FONT_BASE64), c => c.charCodeAt(0));

// Sixteen colours: eight, at two brightness levels. Bit 0 is blue, 1 red, 2 green.
const LEVEL = [0xd7, 0xff];
export const PALETTE = [];
for (const v of LEVEL) {
  for (let c = 0; c < 8; c++) {
    PALETTE.push([(c & 2) ? v : 0, (c & 4) ? v : 0, (c & 1) ? v : 0]);
  }
}

export const WIDTH = 256, HEIGHT = 192, BORDER_X = 32, BORDER_Y = 24;

// The display file is not linear: consecutive bytes run along a pixel row, but
// rows are interleaved by third of the screen and by scanline within a cell.
const pixelAddr = (x, y) =>
  ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | x;

// The character set starts at code 32, so a space is glyph zero.
export function zxCode(ch) {
  if (ch === '£') return 96;   // £
  if (ch === '©') return 127;  // ©
  const c = ch.charCodeAt(0);
  return (c >= 32 && c < 127) ? c : 32;
}

export const attr = (ink, paper, bright = 0, flash = 0) =>
  (flash ? 0x80 : 0) | (bright ? 0x40 : 0) | ((paper & 7) << 3) | (ink & 7);

export class Display {
  constructor(canvas, memory = null, base = 0) {
    this.canvas = canvas;
    canvas.width = WIDTH + BORDER_X * 2;
    canvas.height = HEIGHT + BORDER_Y * 2;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.image = this.ctx.createImageData(canvas.width, canvas.height);
    // Either a private buffer, or a window straight onto the machine's RAM at
    // $4000 — 6144 bytes of pixels followed by 768 of attributes.
    this.mem = memory ? memory.subarray(base, base + 6912) : new Uint8Array(6912);
    this.border = 7;
    this.flashPhase = false;
    this.frame = 0;
    this.clear();
  }

  clear(a = attr(0, 7)) {
    this.mem.fill(0, 0, 6144);
    this.mem.fill(a, 6144);
  }

  charAt(row, col, code, a) {
    const g = (code - 32) * 8;
    for (let y = 0; y < 8; y++) {
      this.mem[pixelAddr(col, row * 8 + y)] = FONT[g + y];
    }
    this.mem[6144 + row * 32 + col] = a;
  }

  printAt(row, col, text, a = attr(0, 7)) {
    for (let i = 0; i < text.length && col + i < 32; i++) {
      this.charAt(row, col + i, zxCode(text[i]), a);
    }
  }

  // The ULA inverts FLASH cells every 16 frames, so the full cycle is 32.
  tick() {
    this.frame++;
    this.flashPhase = (this.frame & 16) !== 0;
  }

  render() {
    const d = this.image.data, w = this.canvas.width;
    const b = PALETTE[this.border & 15];
    for (let i = 0; i < d.length; i += 4) {
      d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; d[i + 3] = 255;
    }
    for (let y = 0; y < HEIGHT; y++) {
      for (let cx = 0; cx < 32; cx++) {
        const bits = this.mem[pixelAddr(cx, y)];
        const a = this.mem[6144 + (y >> 3) * 32 + cx];
        const bright = (a & 0x40) ? 8 : 0;
        let ink = PALETTE[(a & 7) | bright];
        let paper = PALETTE[((a >> 3) & 7) | bright];
        if ((a & 0x80) && this.flashPhase) { const t = ink; ink = paper; paper = t; }
        let o = ((y + BORDER_Y) * w + cx * 8 + BORDER_X) * 4;
        for (let bit = 7; bit >= 0; bit--, o += 4) {
          const c = (bits >> bit & 1) ? ink : paper;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
        }
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
