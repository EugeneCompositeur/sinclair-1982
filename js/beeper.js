// The Spectrum's entire sound hardware is one bit of one port, wired to a
// loudspeaker. Everything the machine ever played — BEEP, the loading screech,
// the music in games — is that bit being flipped at the right moments.
//
// So there is nothing to synthesise: we record when the bit changed, average
// it over each audio sample, and hand the result to the sound card.

const WORKLET = `
class Beeper extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.last = 0;
    this.port.onmessage = e => {
      // Never let the backlog grow: latency is worse than a dropped frame.
      if (this.queue.length > 6) this.queue.length = 0;
      this.queue.push(e.data);
    };
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    let i = 0;
    while (i < out.length) {
      const chunk = this.queue[0];
      if (!chunk) { out.fill(this.last, i); break; }
      const take = Math.min(out.length - i, chunk.length - this.offset);
      out.set(chunk.subarray(this.offset, this.offset + take), i);
      i += take; this.offset += take;
      if (this.offset >= chunk.length) { this.queue.shift(); this.offset = 0; }
    }
    if (out.length) this.last = out[out.length - 1];
    return true;
  }
}
registerProcessor('beeper', Beeper);
`;

export class Beeper {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.ready = false;
    this.muted = false;
  }

  get sampleRate() { return this.ctx ? this.ctx.sampleRate : 44100; }

  // Browsers will not make a sound until the user has touched something, so
  // this is called from the first key press.
  async start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try {
      await this.ctx.audioWorklet.addModule(url);
      this.node = new AudioWorkletNode(this.ctx, 'beeper', { outputChannelCount: [1] });
      this.node.connect(this.ctx.destination);
      this.ready = true;
    } finally {
      URL.revokeObjectURL(url);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  play(samples) {
    if (!this.ready || this.muted) return;
    this.node.port.postMessage(samples, [samples.buffer]);
  }
}
