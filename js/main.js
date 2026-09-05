// Starts the machine and keeps it running: fifty frames a second, each one an
// interrupt followed by 69888 processor cycles, then whatever the ULA would
// have put on the television and through the speaker.

import { Display } from './screen.js';
import { Keyboard } from './keyboard.js';
import { Spectrum, FRAME_MS, T_PER_FRAME } from './machine.js';
import { Beeper } from './beeper.js';
import { Tape } from './tape.js';

const load = async path => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
};

const rom = await load('../roms/48.rom');
if (!rom || rom.length !== 16384) throw new Error('the 48K ROM is missing or the wrong size');

const machine = new Spectrum(rom);
const display = new Display(document.getElementById('screen'), machine.memory, 0x4000);
const beeper = new Beeper();

// A tape is in the machine from the start, so LOAD "" has something to find.
// ?tape=name puts a different one in.
const tapeName = new URLSearchParams(location.search).get('tape') || 'gumshoe';
const tapeBytes = await load(`../tapes/${tapeName}.tap`);
if (tapeBytes) machine.insert(new Tape(tapeBytes, tapeName));

const keyboard = new Keyboard(document.getElementById('keyboard'), machine, action => {
  if (action === 'F1') { machine.reset(); keyboard.releaseAll(); if (machine.tape) machine.tape.rewind(); }
  if (action === 'F2' && machine.tape) machine.tape.rewind();
  // LESSONS and SETTINGS are still waiting to be given a job.
});

// Sound may not start until the user has touched something.
const wake = () => { beeper.start(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);

globalThis.spectrum = machine;

// The browser hands us a frame roughly every 16 ms; the Spectrum wants one
// every 20. Keep the remainder and spend it next time, but never try to catch
// up by more than a few frames after the tab has been asleep.
let previous = performance.now();
let owed = 0;

function tick(now) {
  owed = Math.min(owed + (now - previous), 100);
  previous = now;
  const perFrame = Math.round(beeper.sampleRate * T_PER_FRAME / 3500000);
  while (owed >= FRAME_MS) {
    machine.runFrame();
    display.tick();
    if (beeper.ready) {
      const samples = new Float32Array(perFrame);
      machine.renderAudio(samples);
      beeper.play(samples);
    }
    owed -= FRAME_MS;
  }
  display.border = machine.border;
  display.render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
