// Boots the real ROM with no browser in sight and reads the screen back by
// matching each 8x8 cell against the ROM's own character set. If the processor
// is right, the copyright line appears by itself.

import { readFileSync } from 'fs';
import { Spectrum } from '../js/machine.js';

const rom = new Uint8Array(readFileSync(new URL('../roms/48.rom', import.meta.url)));
const machine = new Spectrum(rom);

const frames = Number(process.argv[2] || 100);
for (let i = 0; i < frames; i++) machine.runFrame();

// The character set lives at $3D00 and covers codes 32..127.
const glyphs = new Map();
for (let code = 32; code < 128; code++) {
  const bytes = [...rom.subarray(0x3d00 + (code - 32) * 8, 0x3d00 + (code - 32) * 8 + 8)];
  glyphs.set(bytes.join(','), code === 127 ? '(c)' : String.fromCharCode(code));
}

const pixelAddr = (x, y) =>
  0x4000 + (((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | x);

const lines = [];
for (let row = 0; row < 24; row++) {
  let text = '';
  for (let col = 0; col < 32; col++) {
    const bytes = [];
    for (let y = 0; y < 8; y++) bytes.push(machine.memory[pixelAddr(col, row * 8 + y)]);
    text += glyphs.get(bytes.join(',')) ?? (bytes.some(b => b) ? '?' : ' ');
  }
  lines.push(text.replace(/\s+$/, ''));
}

const cpu = machine.cpu;
console.log(`after ${frames} frames: PC=${cpu.pc.toString(16).padStart(4, '0')} ` +
  `SP=${cpu.sp.toString(16)} IM=${cpu.im} IFF1=${cpu.iff1} border=${machine.border}`);
console.log('screen:');
for (const line of lines) if (line.trim()) console.log('  |' + line);
if (!lines.some(l => l.trim())) console.log('  (blank)');
