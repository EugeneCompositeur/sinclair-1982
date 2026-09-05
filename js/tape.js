// A .tap file is the simplest possible tape: a run of blocks, each one a
// two-byte length followed by that many bytes. Inside a block the first byte
// says what kind it is (0 for a header, 255 for data) and the last is a
// checksum of everything before it.

export class Tape {
  constructor(bytes, name = 'tape') {
    this.name = name;
    this.blocks = [];
    for (let p = 0; p + 1 < bytes.length;) {
      const length = bytes[p] | (bytes[p + 1] << 8);
      p += 2;
      if (!length || p + length > bytes.length) break;
      this.blocks.push(bytes.subarray(p, p + length));
      p += length;
    }
    this.index = 0;
  }

  rewind() { this.index = 0; }

  // The ROM asks for a particular kind of block and ignores anything else it
  // meets along the way, exactly as it would while a tape ran past the head.
  nextWithFlag(flag) {
    while (this.index < this.blocks.length) {
      const block = this.blocks[this.index++];
      if (block.length >= 2 && block[0] === flag) return block;
    }
    return null;
  }

  // The name a header block carries, for showing what is on the tape.
  get contents() {
    const names = [];
    for (const b of this.blocks) {
      if (b[0] === 0x00 && b.length >= 19) {
        names.push(String.fromCharCode(...b.subarray(2, 12)).trim());
      }
    }
    return names;
  }
}
