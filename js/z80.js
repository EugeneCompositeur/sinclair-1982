// The Zilog Z80, as fitted to the Spectrum at 3.5 MHz.
//
// Decoding follows the processor's own structure rather than a list of 256
// cases: every opcode splits into the fields x-y-z (and p-q inside y), and
// those fields say what the instruction does. That is how the silicon reads
// it, and it is why the undocumented instructions fall out for free.
//
// The bus it talks to must provide read(addr), write(addr, value),
// portIn(port) and portOut(port, value).

export const F_C = 0x01, F_N = 0x02, F_PV = 0x04, F_3 = 0x08,
             F_H = 0x10, F_5 = 0x20, F_Z = 0x40, F_S = 0x80;

// Flags that depend only on the result: sign, zero, and the two undocumented
// bits that simply copy bits 5 and 3 of the answer.
const sz53 = new Uint8Array(256);
const sz53p = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let bits = 0;
  for (let b = i; b; b >>= 1) bits ^= b & 1;
  sz53[i] = (i & (F_S | F_5 | F_3)) | (i === 0 ? F_Z : 0);
  sz53p[i] = sz53[i] | (bits ? 0 : F_PV);
}

const signed = d => (d << 24) >> 24;

export class Z80 {
  constructor(bus) {
    this.bus = bus;
    this.reset();
  }

  reset() {
    this.a = this.f = 0xff;
    this.b = this.c = this.d = this.e = this.h = this.l = 0;
    this.a_ = this.f_ = 0xff;
    this.b_ = this.c_ = this.d_ = this.e_ = this.h_ = this.l_ = 0;
    this.ix = 0; this.iy = 0;
    this.sp = 0xffff; this.pc = 0;
    this.i = 0; this.r = 0;
    this.iff1 = 0; this.iff2 = 0; this.im = 0;
    this.halted = false;
    this.tstates = 0;
    this.memptr = 0;
    this.pendingEI = false;
  }

  get bc() { return (this.b << 8) | this.c; }
  set bc(v) { this.b = (v >> 8) & 255; this.c = v & 255; }
  get de() { return (this.d << 8) | this.e; }
  set de(v) { this.d = (v >> 8) & 255; this.e = v & 255; }
  get hl() { return (this.h << 8) | this.l; }
  set hl(v) { this.h = (v >> 8) & 255; this.l = v & 255; }
  get af() { return (this.a << 8) | this.f; }
  set af(v) { this.a = (v >> 8) & 255; this.f = v & 255; }

  read(a) { return this.bus.read(a & 0xffff); }
  write(a, v) { this.bus.write(a & 0xffff, v & 255); }
  fetch() { const v = this.read(this.pc); this.pc = (this.pc + 1) & 0xffff; return v; }
  fetch16() { const lo = this.fetch(); return lo | (this.fetch() << 8); }

  push(v) {
    this.sp = (this.sp - 1) & 0xffff; this.write(this.sp, v >> 8);
    this.sp = (this.sp - 1) & 0xffff; this.write(this.sp, v & 255);
  }
  pop() {
    const lo = this.read(this.sp); this.sp = (this.sp + 1) & 0xffff;
    const hi = this.read(this.sp); this.sp = (this.sp + 1) & 0xffff;
    return lo | (hi << 8);
  }

  // R counts memory-refresh cycles; the top bit is not part of the counter.
  incR() { this.r = (this.r & 0x80) | ((this.r + 1) & 0x7f); }

  // ---- arithmetic and logic -------------------------------------------

  add8(v, c) {
    const a = this.a, r = a + v + c, res = r & 255;
    this.f = (r > 255 ? F_C : 0)
      | (((a ^ res) & (v ^ res) & 0x80) ? F_PV : 0)
      | ((a ^ v ^ res) & F_H) | sz53[res];
    this.a = res;
  }

  sub8(v, c) {
    const a = this.a, r = a - v - c, res = r & 255;
    this.f = F_N | (r < 0 ? F_C : 0)
      | (((a ^ v) & (a ^ res) & 0x80) ? F_PV : 0)
      | ((a ^ v ^ res) & F_H) | sz53[res];
    this.a = res;
  }

  // CP is a subtraction that throws the answer away — but the undocumented
  // flags 5 and 3 come from the operand, not from the result.
  cp8(v) {
    const a = this.a, r = a - v, res = r & 255;
    this.f = F_N | (r < 0 ? F_C : 0)
      | (((a ^ v) & (a ^ res) & 0x80) ? F_PV : 0)
      | ((a ^ v ^ res) & F_H)
      | (res === 0 ? F_Z : 0) | (res & F_S) | (v & (F_5 | F_3));
  }

  and8(v) { this.a &= v; this.f = F_H | sz53p[this.a]; }
  or8(v) { this.a |= v; this.f = sz53p[this.a]; }
  xor8(v) { this.a ^= v; this.f = sz53p[this.a]; }

  inc8(v) {
    const res = (v + 1) & 255;
    this.f = (this.f & F_C) | (res === 0x80 ? F_PV : 0)
      | ((res & 0x0f) === 0 ? F_H : 0) | sz53[res];
    return res;
  }
  dec8(v) {
    const res = (v - 1) & 255;
    this.f = (this.f & F_C) | F_N | (res === 0x7f ? F_PV : 0)
      | ((res & 0x0f) === 0x0f ? F_H : 0) | sz53[res];
    return res;
  }

  add16(a, b) {
    const r = a + b, res = r & 0xffff;
    this.f = (this.f & (F_S | F_Z | F_PV)) | (r > 0xffff ? F_C : 0)
      | (((a ^ b ^ res) >> 8) & F_H) | ((res >> 8) & (F_5 | F_3));
    this.memptr = (a + 1) & 0xffff;
    return res;
  }

  adc16(v) {
    const hl = this.hl, c = this.f & F_C, r = hl + v + c, res = r & 0xffff;
    this.f = (r > 0xffff ? F_C : 0)
      | (((hl ^ res) & (v ^ res) & 0x8000) ? F_PV : 0)
      | (((hl ^ v ^ res) >> 8) & F_H)
      | (res === 0 ? F_Z : 0) | ((res >> 8) & (F_S | F_5 | F_3));
    this.memptr = (hl + 1) & 0xffff;
    this.hl = res;
  }

  sbc16(v) {
    const hl = this.hl, c = this.f & F_C, r = hl - v - c, res = r & 0xffff;
    this.f = F_N | (r < 0 ? F_C : 0)
      | (((hl ^ v) & (hl ^ res) & 0x8000) ? F_PV : 0)
      | (((hl ^ v ^ res) >> 8) & F_H)
      | (res === 0 ? F_Z : 0) | ((res >> 8) & (F_S | F_5 | F_3));
    this.memptr = (hl + 1) & 0xffff;
    this.hl = res;
  }

  // ---- rotates and shifts ---------------------------------------------

  rlca() { const a = this.a; this.a = ((a << 1) | (a >> 7)) & 255;
    this.f = (this.f & (F_S | F_Z | F_PV)) | ((a >> 7) & 1) | (this.a & (F_5 | F_3)); }
  rrca() { const a = this.a; this.a = ((a >> 1) | (a << 7)) & 255;
    this.f = (this.f & (F_S | F_Z | F_PV)) | (a & 1) | (this.a & (F_5 | F_3)); }
  rla() { const a = this.a, c = this.f & F_C; this.a = ((a << 1) | c) & 255;
    this.f = (this.f & (F_S | F_Z | F_PV)) | ((a >> 7) & 1) | (this.a & (F_5 | F_3)); }
  rra() { const a = this.a, c = this.f & F_C; this.a = ((a >> 1) | (c << 7)) & 255;
    this.f = (this.f & (F_S | F_Z | F_PV)) | (a & 1) | (this.a & (F_5 | F_3)); }

  rlc(v) { const r = ((v << 1) | (v >> 7)) & 255; this.f = ((v >> 7) & 1) | sz53p[r]; return r; }
  rrc(v) { const r = ((v >> 1) | (v << 7)) & 255; this.f = (v & 1) | sz53p[r]; return r; }
  rl(v) { const r = ((v << 1) | (this.f & F_C)) & 255; this.f = ((v >> 7) & 1) | sz53p[r]; return r; }
  rr(v) { const r = ((v >> 1) | ((this.f & F_C) << 7)) & 255; this.f = (v & 1) | sz53p[r]; return r; }
  sla(v) { const r = (v << 1) & 255; this.f = ((v >> 7) & 1) | sz53p[r]; return r; }
  sra(v) { const r = ((v >> 1) | (v & 0x80)) & 255; this.f = (v & 1) | sz53p[r]; return r; }
  sll(v) { const r = ((v << 1) | 1) & 255; this.f = ((v >> 7) & 1) | sz53p[r]; return r; }  // undocumented
  srl(v) { const r = (v >> 1) & 255; this.f = (v & 1) | sz53p[r]; return r; }

  rot(kind, v) {
    switch (kind) {
      case 0: return this.rlc(v); case 1: return this.rrc(v);
      case 2: return this.rl(v);  case 3: return this.rr(v);
      case 4: return this.sla(v); case 5: return this.sra(v);
      case 6: return this.sll(v); default: return this.srl(v);
    }
  }

  // Bits 5 and 3 of BIT's flags come from the operand for a register, and
  // from the high half of MEMPTR when the operand is in memory.
  testBit(n, v, undoc) {
    const r = v & (1 << n);
    this.f = (this.f & F_C) | F_H
      | (r === 0 ? (F_Z | F_PV) : 0) | (r & F_S) | (undoc & (F_5 | F_3));
  }

  // ---- odds and ends ---------------------------------------------------

  daa() {
    const a = this.a;
    let add = 0, c = this.f & F_C;
    if ((this.f & F_H) || (a & 0x0f) > 9) add = 6;
    if (c || a > 0x99) { add |= 0x60; c = F_C; }
    const r = ((this.f & F_N) ? a - add : a + add) & 255;
    this.f = (this.f & F_N) | c | ((a ^ r) & F_H) | sz53p[r];
    this.a = r;
  }

  cpl() {
    this.a = ~this.a & 255;
    this.f = (this.f & (F_S | F_Z | F_PV | F_C)) | F_H | F_N | (this.a & (F_5 | F_3));
  }
  scf() { this.f = (this.f & (F_S | F_Z | F_PV)) | F_C | (this.a & (F_5 | F_3)); }
  ccf() {
    const c = this.f & F_C;
    this.f = (this.f & (F_S | F_Z | F_PV)) | (c ? F_H : 0) | (c ^ F_C) | (this.a & (F_5 | F_3));
  }
  neg() { const v = this.a; this.a = 0; this.sub8(v, 0); }

  rld() {
    const hl = this.hl, v = this.read(hl);
    this.write(hl, ((v << 4) | (this.a & 0x0f)) & 255);
    this.a = (this.a & 0xf0) | (v >> 4);
    this.f = (this.f & F_C) | sz53p[this.a];
    this.memptr = (hl + 1) & 0xffff;
  }
  rrd() {
    const hl = this.hl, v = this.read(hl);
    this.write(hl, ((v >> 4) | (this.a << 4)) & 255);
    this.a = (this.a & 0xf0) | (v & 0x0f);
    this.f = (this.f & F_C) | sz53p[this.a];
    this.memptr = (hl + 1) & 0xffff;
  }

  // ---- block moves and searches ---------------------------------------

  blockLoad(dir) {
    const v = this.read(this.hl);
    this.write(this.de, v);
    this.de = (this.de + dir) & 0xffff;
    this.hl = (this.hl + dir) & 0xffff;
    this.bc = (this.bc - 1) & 0xffff;
    const n = (v + this.a) & 255;
    this.f = (this.f & (F_C | F_Z | F_S)) | (this.bc ? F_PV : 0)
      | (n & F_3) | ((n & 0x02) ? F_5 : 0);
  }

  blockCompare(dir) {
    const v = this.read(this.hl);
    const r = (this.a - v) & 255;
    const h = (this.a ^ v ^ r) & F_H;
    this.hl = (this.hl + dir) & 0xffff;
    this.bc = (this.bc - 1) & 0xffff;
    const n = (r - (h ? 1 : 0)) & 255;
    this.f = (this.f & F_C) | F_N | (this.bc ? F_PV : 0) | h
      | (r === 0 ? F_Z : 0) | (r & F_S) | (n & F_3) | ((n & 0x02) ? F_5 : 0);
    this.memptr = (this.memptr + dir) & 0xffff;
  }

  blockIn(dir) {
    const v = this.bus.portIn(this.bc);
    this.write(this.hl, v);
    this.memptr = (this.bc + dir) & 0xffff;
    this.b = (this.b - 1) & 255;
    this.hl = (this.hl + dir) & 0xffff;
    const t = (v + ((this.c + dir) & 255)) & 511;
    this.f = ((v & 0x80) ? F_N : 0) | ((t > 255) ? (F_H | F_C) : 0)
      | sz53p[(t & 7) ^ this.b] & F_PV | sz53[this.b];
  }

  blockOut(dir) {
    const v = this.read(this.hl);
    this.b = (this.b - 1) & 255;
    this.memptr = (this.bc + dir) & 0xffff;
    this.bus.portOut(this.bc, v);
    this.hl = (this.hl + dir) & 0xffff;
    const t = (v + this.l) & 511;
    this.f = ((v & 0x80) ? F_N : 0) | ((t > 255) ? (F_H | F_C) : 0)
      | sz53p[(t & 7) ^ this.b] & F_PV | sz53[this.b];
  }

  // ---- register file, addressed the way the opcode addresses it --------

  index(pfx) { return pfx === 0xdd ? this.ix : pfx === 0xfd ? this.iy : this.hl; }
  setIndex(pfx, v) {
    if (pfx === 0xdd) this.ix = v & 0xffff;
    else if (pfx === 0xfd) this.iy = v & 0xffff;
    else this.hl = v & 0xffff;
  }

  getR(i, pfx, addr) {
    switch (i) {
      case 0: return this.b; case 1: return this.c;
      case 2: return this.d; case 3: return this.e;
      case 4: return pfx ? (this.index(pfx) >> 8) : this.h;
      case 5: return pfx ? (this.index(pfx) & 255) : this.l;
      case 6: return this.read(addr);
      default: return this.a;
    }
  }

  setR(i, v, pfx, addr) {
    v &= 255;
    switch (i) {
      case 0: this.b = v; break; case 1: this.c = v; break;
      case 2: this.d = v; break; case 3: this.e = v; break;
      case 4: if (pfx) this.setIndex(pfx, (this.index(pfx) & 255) | (v << 8)); else this.h = v; break;
      case 5: if (pfx) this.setIndex(pfx, (this.index(pfx) & 0xff00) | v); else this.l = v; break;
      case 6: this.write(addr, v); break;
      default: this.a = v;
    }
  }

  getRP(p, pfx) {
    switch (p) {
      case 0: return this.bc; case 1: return this.de;
      case 2: return this.index(pfx); default: return this.sp;
    }
  }
  setRP(p, v, pfx) {
    switch (p) {
      case 0: this.bc = v & 0xffff; break; case 1: this.de = v & 0xffff; break;
      case 2: this.setIndex(pfx, v); break; default: this.sp = v & 0xffff;
    }
  }

  condition(y) {
    switch (y) {
      case 0: return !(this.f & F_Z); case 1: return !!(this.f & F_Z);
      case 2: return !(this.f & F_C); case 3: return !!(this.f & F_C);
      case 4: return !(this.f & F_PV); case 5: return !!(this.f & F_PV);
      case 6: return !(this.f & F_S); default: return !!(this.f & F_S);
    }
  }

  alu(op, v) {
    switch (op) {
      case 0: this.add8(v, 0); break;
      case 1: this.add8(v, this.f & F_C); break;
      case 2: this.sub8(v, 0); break;
      case 3: this.sub8(v, this.f & F_C); break;
      case 4: this.and8(v); break;
      case 5: this.xor8(v); break;
      case 6: this.or8(v); break;
      default: this.cp8(v);
    }
  }

  // The address an indexed instruction works on, consuming its displacement.
  address(pfx) {
    if (!pfx) return this.hl;
    const a = (this.index(pfx) + signed(this.fetch())) & 0xffff;
    this.memptr = a;
    return a;
  }

  // ---- the interrupt line ----------------------------------------------

  interrupt() {
    if (!this.iff1 || this.pendingEI) return false;
    if (this.halted) this.halted = false;
    this.incR();
    this.iff1 = this.iff2 = 0;
    this.push(this.pc);
    if (this.im === 2) {
      const vector = (this.i << 8) | 0xff;
      this.pc = this.read(vector) | (this.read((vector + 1) & 0xffff) << 8);
      this.tstates += 19;
    } else {
      this.pc = 0x0038;
      this.tstates += 13;
    }
    this.memptr = this.pc;
    return true;
  }

  // ---- one instruction --------------------------------------------------

  step() {
    if (this.halted) { this.incR(); this.tstates += 4; return 4; }
    const before = this.tstates;
    const wasPendingEI = this.pendingEI;
    this.exec(0);
    if (wasPendingEI) this.pendingEI = false;
    return this.tstates - before;
  }

  exec(pfx) {
    this.incR();
    const op = this.fetch();
    if (pfx) this.tstates += 4;

    if (op === 0xdd || op === 0xfd) { this.exec(op); return; }
    if (op === 0xed) { this.execED(); return; }
    if (op === 0xcb) { this.execCB(pfx); return; }

    const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;

    if (x === 1) {                                   // LD r, r'
      if (y === 6 && z === 6) { this.halted = true; this.tstates += 4; return; }
      if (y === 6) {                                 // LD (HL/IX+d), r
        const a = this.address(pfx);
        this.write(a, this.getR(z, 0, 0));
        this.tstates += pfx ? 15 : 7;
      } else if (z === 6) {                          // LD r, (HL/IX+d)
        const a = this.address(pfx);
        this.setR(y, this.read(a), 0, 0);
        this.tstates += pfx ? 15 : 7;
      } else {
        this.setR(y, this.getR(z, pfx, 0), pfx, 0);
        this.tstates += 4;
      }
      return;
    }

    if (x === 2) {                                   // ALU A, r
      if (z === 6) {
        const a = this.address(pfx);
        this.alu(y, this.read(a));
        this.tstates += pfx ? 15 : 7;
      } else {
        this.alu(y, this.getR(z, pfx, 0));
        this.tstates += 4;
      }
      return;
    }

    if (x === 0) {
      switch (z) {
        case 0:
          if (y === 0) { this.tstates += 4; }                        // NOP
          else if (y === 1) {                                         // EX AF, AF'
            let t = this.a; this.a = this.a_; this.a_ = t;
            t = this.f; this.f = this.f_; this.f_ = t;
            this.tstates += 4;
          } else if (y === 2) {                                       // DJNZ
            const d = signed(this.fetch());
            this.b = (this.b - 1) & 255;
            if (this.b) { this.pc = (this.pc + d) & 0xffff; this.memptr = this.pc; this.tstates += 13; }
            else this.tstates += 8;
          } else if (y === 3) {                                       // JR
            const d = signed(this.fetch());
            this.pc = (this.pc + d) & 0xffff; this.memptr = this.pc;
            this.tstates += 12;
          } else {                                                    // JR cc
            const d = signed(this.fetch());
            if (this.condition(y - 4)) {
              this.pc = (this.pc + d) & 0xffff; this.memptr = this.pc;
              this.tstates += 12;
            } else this.tstates += 7;
          }
          return;

        case 1:
          if (q === 0) { this.setRP(p, this.fetch16(), pfx); this.tstates += 10; }
          else { this.setIndex(pfx, this.add16(this.index(pfx), this.getRP(p, pfx))); this.tstates += 11; }
          return;

        case 2:
          if (q === 0) {
            if (p === 0) { this.write(this.bc, this.a); this.memptr = ((this.a << 8) | ((this.bc + 1) & 255)); this.tstates += 7; }
            else if (p === 1) { this.write(this.de, this.a); this.memptr = ((this.a << 8) | ((this.de + 1) & 255)); this.tstates += 7; }
            else if (p === 2) {
              const nn = this.fetch16(); const v = this.index(pfx);
              this.write(nn, v & 255); this.write((nn + 1) & 0xffff, v >> 8);
              this.memptr = (nn + 1) & 0xffff; this.tstates += 16;
            } else {
              const nn = this.fetch16();
              this.write(nn, this.a);
              this.memptr = ((this.a << 8) | ((nn + 1) & 255)); this.tstates += 13;
            }
          } else {
            if (p === 0) { this.a = this.read(this.bc); this.memptr = (this.bc + 1) & 0xffff; this.tstates += 7; }
            else if (p === 1) { this.a = this.read(this.de); this.memptr = (this.de + 1) & 0xffff; this.tstates += 7; }
            else if (p === 2) {
              const nn = this.fetch16();
              this.setIndex(pfx, this.read(nn) | (this.read((nn + 1) & 0xffff) << 8));
              this.memptr = (nn + 1) & 0xffff; this.tstates += 16;
            } else {
              const nn = this.fetch16();
              this.a = this.read(nn); this.memptr = (nn + 1) & 0xffff; this.tstates += 13;
            }
          }
          return;

        case 3:
          this.setRP(p, this.getRP(p, pfx) + (q ? -1 : 1), pfx);
          this.tstates += 6;
          return;

        case 4: case 5: {                                             // INC r / DEC r
          const dec = z === 5;
          if (y === 6) {
            const a = this.address(pfx);
            this.write(a, dec ? this.dec8(this.read(a)) : this.inc8(this.read(a)));
            this.tstates += pfx ? 19 : 11;
          } else {
            this.setR(y, dec ? this.dec8(this.getR(y, pfx, 0)) : this.inc8(this.getR(y, pfx, 0)), pfx, 0);
            this.tstates += 4;
          }
          return;
        }

        case 6:                                                       // LD r, n
          if (y === 6) {
            const a = this.address(pfx);
            this.write(a, this.fetch());
            this.tstates += pfx ? 11 : 10;
          } else {
            this.setR(y, this.fetch(), pfx, 0);
            this.tstates += 7;
          }
          return;

        default:                                                      // the odd seven
          switch (y) {
            case 0: this.rlca(); break;
            case 1: this.rrca(); break;
            case 2: this.rla(); break;
            case 3: this.rra(); break;
            case 4: this.daa(); break;
            case 5: this.cpl(); break;
            case 6: this.scf(); break;
            default: this.ccf();
          }
          this.tstates += 4;
          return;
      }
    }

    // x === 3
    switch (z) {
      case 0:
        if (this.condition(y)) { this.pc = this.pop(); this.memptr = this.pc; this.tstates += 11; }
        else this.tstates += 5;
        return;

      case 1:
        if (q === 0) {
          const v = this.pop();
          if (p === 3) this.af = v; else this.setRP(p, v, pfx);
          this.tstates += 10;
        } else if (p === 0) { this.pc = this.pop(); this.memptr = this.pc; this.tstates += 10; }
        else if (p === 1) {                                           // EXX
          let t;
          t = this.b; this.b = this.b_; this.b_ = t;
          t = this.c; this.c = this.c_; this.c_ = t;
          t = this.d; this.d = this.d_; this.d_ = t;
          t = this.e; this.e = this.e_; this.e_ = t;
          t = this.h; this.h = this.h_; this.h_ = t;
          t = this.l; this.l = this.l_; this.l_ = t;
          this.tstates += 4;
        }
        else if (p === 2) { this.pc = this.index(pfx); this.tstates += 4; }
        else { this.sp = this.index(pfx); this.tstates += 6; }
        return;

      case 2: {
        const nn = this.fetch16();
        this.memptr = nn;
        if (this.condition(y)) this.pc = nn;
        this.tstates += 10;
        return;
      }

      case 3:
        switch (y) {
          case 0: { const nn = this.fetch16(); this.pc = nn; this.memptr = nn; this.tstates += 10; return; }
          case 2: {                                                   // OUT (n), A
            const n = this.fetch();
            this.bus.portOut((this.a << 8) | n, this.a);
            this.memptr = ((this.a << 8) | ((n + 1) & 255));
            this.tstates += 11; return;
          }
          case 3: {                                                   // IN A, (n)
            const n = this.fetch();
            const port = (this.a << 8) | n;
            this.a = this.bus.portIn(port);
            this.memptr = (port + 1) & 0xffff;
            this.tstates += 11; return;
          }
          case 4: {                                                   // EX (SP), HL
            const v = this.index(pfx);
            const lo = this.read(this.sp), hi = this.read((this.sp + 1) & 0xffff);
            this.write(this.sp, v & 255);
            this.write((this.sp + 1) & 0xffff, v >> 8);
            this.setIndex(pfx, lo | (hi << 8));
            this.memptr = lo | (hi << 8);
            this.tstates += 19; return;
          }
          case 5: {                                                   // EX DE, HL
            const t = this.de; this.de = this.hl; this.hl = t;
            this.tstates += 4; return;
          }
          case 6: this.iff1 = this.iff2 = 0; this.tstates += 4; return;
          default: this.iff1 = this.iff2 = 1; this.pendingEI = true; this.tstates += 4; return;
        }

      case 4: {
        const nn = this.fetch16();
        this.memptr = nn;
        if (this.condition(y)) { this.push(this.pc); this.pc = nn; this.tstates += 17; }
        else this.tstates += 10;
        return;
      }

      case 5:
        if (q === 0) { this.push(p === 3 ? this.af : this.getRP(p, pfx)); this.tstates += 11; }
        else { const nn = this.fetch16(); this.memptr = nn; this.push(this.pc); this.pc = nn; this.tstates += 17; }
        return;

      case 6:
        this.alu(y, this.fetch());
        this.tstates += 7;
        return;

      default:
        this.push(this.pc);
        this.pc = y * 8;
        this.memptr = this.pc;
        this.tstates += 11;
        return;
    }
  }

  // ---- CB: rotates, shifts and bit work --------------------------------

  execCB(pfx) {
    let addr = 0, op;
    if (pfx) {
      // DD CB d op — the displacement comes before the opcode.
      addr = (this.index(pfx) + signed(this.fetch())) & 0xffff;
      this.memptr = addr;
      op = this.fetch();
    } else {
      this.incR();
      op = this.fetch();
      addr = this.hl;
    }

    const x = op >> 6, y = (op >> 3) & 7, z = op & 7;
    const memory = z === 6 || pfx;
    const v = memory ? this.read(addr) : this.getR(z, 0, 0);

    if (x === 0) {
      this.store(this.rot(y, v), z, pfx, memory, addr);
      this.tstates += pfx ? 19 : (z === 6 ? 15 : 8);
      return;
    }

    if (x === 1) {                                      // BIT
      this.testBit(y, v, memory ? (this.memptr >> 8) : v);
      this.tstates += pfx ? 16 : (z === 6 ? 12 : 8);
      return;
    }

    const r = x === 2 ? (v & ~(1 << y)) & 255 : (v | (1 << y)) & 255;   // RES / SET
    this.store(r, z, pfx, memory, addr);
    this.tstates += pfx ? 19 : (z === 6 ? 15 : 8);
  }

  // Where a CB result goes: to the register, to memory, or — for the
  // undocumented indexed forms — to both at once.
  store(r, z, pfx, memory, addr) {
    if (!memory) { this.setR(z, r, 0, 0); return; }
    this.write(addr, r);
    if (pfx && z !== 6) this.setR(z, r, 0, 0);
  }

  // ---- ED: the extended set --------------------------------------------

  execED() {
    this.incR();
    const op = this.fetch();
    const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;

    if (x === 1) {
      switch (z) {
        case 0: {                                       // IN r, (C)
          const v = this.bus.portIn(this.bc);
          this.memptr = (this.bc + 1) & 0xffff;
          if (y !== 6) this.setR(y, v, 0, 0);
          this.f = (this.f & F_C) | sz53p[v];
          this.tstates += 12; return;
        }
        case 1:                                          // OUT (C), r
          this.bus.portOut(this.bc, y === 6 ? 0 : this.getR(y, 0, 0));
          this.memptr = (this.bc + 1) & 0xffff;
          this.tstates += 12; return;
        case 2:
          if (q === 0) this.sbc16(this.getRP(p, 0)); else this.adc16(this.getRP(p, 0));
          this.tstates += 15; return;
        case 3: {
          const nn = this.fetch16();
          if (q === 0) {
            const v = this.getRP(p, 0);
            this.write(nn, v & 255); this.write((nn + 1) & 0xffff, v >> 8);
          } else {
            this.setRP(p, this.read(nn) | (this.read((nn + 1) & 0xffff) << 8), 0);
          }
          this.memptr = (nn + 1) & 0xffff;
          this.tstates += 20; return;
        }
        case 4: this.neg(); this.tstates += 8; return;
        case 5:                                          // RETN / RETI
          this.iff1 = this.iff2;
          this.pc = this.pop(); this.memptr = this.pc;
          this.tstates += 14; return;
        case 6:
          this.im = y === 0 || y === 1 || y === 4 || y === 5 ? 0 : (y === 2 || y === 6 ? 1 : 2);
          this.tstates += 8; return;
        default:
          switch (y) {
            case 0: this.i = this.a; this.tstates += 9; return;
            case 1: this.r = this.a; this.tstates += 9; return;
            case 2:                                      // LD A, I
              this.a = this.i;
              this.f = (this.f & F_C) | sz53[this.a] | (this.iff2 ? F_PV : 0);
              this.tstates += 9; return;
            case 3:                                      // LD A, R
              this.a = this.r;
              this.f = (this.f & F_C) | sz53[this.a] | (this.iff2 ? F_PV : 0);
              this.tstates += 9; return;
            case 4: this.rrd(); this.tstates += 18; return;
            case 5: this.rld(); this.tstates += 18; return;
            default: this.tstates += 4; return;          // NOP
          }
      }
    }

    if (x === 2 && z <= 3 && y >= 4) {                    // the block instructions
      const dir = (y & 1) ? -1 : 1;
      const repeat = y >= 6;
      switch (z) {
        case 0: this.blockLoad(dir); this.tstates += 16;
          if (repeat && this.bc) { this.pc = (this.pc - 2) & 0xffff; this.tstates += 5; }
          return;
        case 1: this.blockCompare(dir); this.tstates += 16;
          if (repeat && this.bc && !(this.f & F_Z)) { this.pc = (this.pc - 2) & 0xffff; this.tstates += 5; }
          return;
        case 2: this.blockIn(dir); this.tstates += 16;
          if (repeat && this.b) { this.pc = (this.pc - 2) & 0xffff; this.tstates += 5; }
          return;
        default: this.blockOut(dir); this.tstates += 16;
          if (repeat && this.b) { this.pc = (this.pc - 2) & 0xffff; this.tstates += 5; }
          return;
      }
    }

    this.tstates += 8;                                    // everything else is a NOP
  }
}
