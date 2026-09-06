// The machine around the processor: 16K of ROM, 48K of RAM, and the ULA —
// which on a Spectrum is the screen, the border, the keyboard and the speaker
// all answered through a single port.

import { Z80 } from './z80.js';

// 3.5 MHz divided by the 50.08 Hz frame gives the length of one television
// frame in processor cycles. The interrupt that drives everything — the clock,
// the keyboard, the flashing cursor — arrives once per frame.
export const T_PER_FRAME = 69888;
export const FRAME_MS = 1000 * T_PER_FRAME / 3500000;

// LD-BYTES, the ROM routine that reads a block off tape. We answer it
// ourselves instead of pretending to be a cassette player.
const LD_BYTES = 0x0556;

export class Spectrum {
  constructor(rom) {
    this.memory = new Uint8Array(65536);
    this.rom = rom;
    this.keys = new Uint8Array(8);      // a set bit means the key is up
    this.tape = null;
    this.frames = 0;                    // how many television frames have run
    this.speakerEvents = [];
    this.cpu = new Z80(this);
    this.reset();
  }

  reset() {
    this.memory.fill(0);
    this.memory.set(this.rom, 0);
    this.keys.fill(0x1f);
    this.border = 7;
    this.speaker = 0;
    this.speakerEvents.length = 0;
    this.frameStart = 0;
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
      const level = (value >> 4) & 1;
      if (level !== this.speaker) {
        this.speaker = level;
        const t = this.cpu.tstates - this.frameStart;
        this.speakerEvents.push(t < 0 ? 0 : t > T_PER_FRAME ? T_PER_FRAME : t, level);
      }
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
    this.frames++;
    this.frameStart = cpu.tstates;
    this.speakerEvents.length = 0;
    this.speakerLevelAtStart = this.speaker;
    cpu.interrupt();
    const end = cpu.tstates + T_PER_FRAME;
    while (cpu.tstates < end) {
      if (cpu.pc === LD_BYTES && this.tape) this.loadBlock();
      else cpu.step();
    }
    cpu.tstates -= T_PER_FRAME;         // carry the overshoot into the next frame
  }

  insert(tape) { this.tape = tape; if (tape) tape.rewind(); }

  // What LD-BYTES would have done, done instantly. On entry IX holds where the
  // bytes go, DE how many are wanted, A which kind of block, and carry says
  // load rather than verify. On exit carry means it worked.
  loadBlock() {
    const cpu = this.cpu;
    const wanted = cpu.a;
    const verify = !(cpu.f & 0x01);
    const block = this.tape.nextWithFlag(wanted);
    const fail = () => { cpu.f &= ~0x01; cpu.pc = cpu.pop(); };

    if (!block) return fail();
    const data = block.subarray(1, block.length - 1);
    if (data.length < cpu.de) return fail();

    let addr = cpu.ix;
    const length = cpu.de;
    for (let i = 0; i < length; i++) {
      if (verify) { if (this.memory[(addr + i) & 0xffff] !== data[i]) return fail(); }
      else this.write((addr + i) & 0xffff, data[i]);
    }
    cpu.ix = (addr + length) & 0xffff;
    cpu.de = 0;
    cpu.f |= 0x01;
    cpu.pc = cpu.pop();
  }

  // The speaker is one bit; a sample is that bit averaged over its own little
  // slice of the frame. That averaging is the whole of the sound.
  renderAudio(out) {
    const n = out.length, ev = this.speakerEvents;
    let idx = 0, level = this.speakerLevelAtStart ?? 0, tPrev = 0;
    for (let i = 0; i < n; i++) {
      const tEnd = (i + 1) * T_PER_FRAME / n;
      let acc = 0, t = tPrev;
      while (idx < ev.length && ev[idx] < tEnd) {
        acc += level * (ev[idx] - t);
        t = ev[idx];
        level = ev[idx + 1];
        idx += 2;
      }
      acc += level * (tEnd - t);
      out[i] = (acc / (tEnd - tPrev)) * 0.34 - 0.17;
      tPrev = tEnd;
    }
  }
}
