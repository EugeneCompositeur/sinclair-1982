// Starts the machine and keeps it running: fifty frames a second, each one an
// interrupt followed by 69888 processor cycles, then whatever the ULA would
// have put on the television.

import { Display } from './screen.js';
import { Keyboard } from './keyboard.js';
import { Spectrum, FRAME_MS } from './machine.js';

const response = await fetch(new URL('../roms/48.rom', import.meta.url));
const rom = new Uint8Array(await response.arrayBuffer());
if (rom.length !== 16384) throw new Error(`ROM is ${rom.length} bytes, expected 16384`);

const machine = new Spectrum(rom);
const display = new Display(document.getElementById('screen'), machine.memory, 0x4000);

const keyboard = new Keyboard(document.getElementById('keyboard'), machine, action => {
  if (action === 'F1') { machine.reset(); keyboard.releaseAll(); }
  // SAVE, LESSONS and SETTINGS are still waiting to be given a job.
});

// A handle for the debugger that is still to come — and for poking about in
// the machine from the browser console.
globalThis.spectrum = machine;

// The browser hands us a frame roughly every 16 ms; the Spectrum wants one
// every 20. Keep the remainder and spend it next time, but never try to catch
// up by more than a few frames after the tab has been asleep.
let previous = performance.now();
let owed = 0;

function tick(now) {
  owed = Math.min(owed + (now - previous), 100);
  previous = now;
  while (owed >= FRAME_MS) {
    machine.runFrame();
    display.tick();
    owed -= FRAME_MS;
  }
  display.border = machine.border;
  display.render();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
