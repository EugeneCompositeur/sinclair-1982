// The machine around the processor: 16K of ROM, 48K of RAM, and the ULA —
// which on a Spectrum is the screen, the border, the keyboard and the speaker
// all answered through a single port.

import { Z80 } from './z80.js';

// 3.5 MHz divided by the 50.08 Hz frame gives the length of one television
// frame in processor cycles. The interrupt that drives everything — the clock,
// the keyboard, the flashing cursor — arrives once per frame.
export const T_PER_FRAME = 69888;
export const FRAME_MS = 1000 * T_PER_FRAME / 3500000;

export class Spectrum {
  constructor(rom) {
    this.memory = new Uint8Array(65536);
    this.rom = rom;
    this.keys = new Uint8Array(8);      // a set bit means the key is up
    this.cpu = new Z80(this);
    this.reset();
  }

  reset() {
    this.memory.fill(0);
    this.memory.set(this.rom, 0);
    this.keys.fill(0x1f);
    this.border = 7;
    this.speaker = 0;
    this.cpu.reset();
  }

  read(addr) { return this.memory[addr]; }

  // The bottom 16K is ROM: writes there fall on the floor, exactly as they do
  // on the real machine.
  write(addr, value) { if (addr >= 0x4000) this.memory[addr] = value; }

  // Any even port address selects the ULA. Which half-rows it reports is
  // decided by which of the address lines A8..A15 are held low.
  portIn(port) {
    if (!(port & 1)) {
      let result = 0x1f;
      for (let row = 0; row < 8; row++) {
        if (!(port & (0x100 << row))) result &= this.keys[row];
      }
      return result | 0xa0;             // bits 5 and 7 float high; bit 6 is the tape
    }
    return 0xff;
  }

  portOut(port, value) {
    if (!(port & 1)) {
      this.border = value & 7;
      this.speaker = (value >> 4) & 1;
    }
  }

  setKey(row, bit, down) {
    if (down) this.keys[row] &= ~(1 << bit) & 0x1f;
    else this.keys[row] |= 1 << bit;
  }

  releaseAllKeys() { this.keys.fill(0x1f); }

  // One television frame: the interrupt, then instructions until the frame's
  // worth of cycles is spent.
  runFrame() {
    const cpu = this.cpu;
    cpu.interrupt();
    const end = cpu.tstates + T_PER_FRAME;
    while (cpu.tstates < end) cpu.step();
    cpu.tstates -= T_PER_FRAME;         // carry the overshoot into the next frame
  }
}
