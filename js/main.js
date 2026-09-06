// Starts the machine and keeps it running: fifty frames a second, each one an
// interrupt followed by 69888 processor cycles, then whatever the ULA would
// have put on the television and through the speaker.

import { Display } from './screen.js';
import { Keyboard } from './keyboard.js';
import { Spectrum, FRAME_MS, T_PER_FRAME } from './machine.js';
import { Beeper } from './beeper.js';
import { Tape } from './tape.js';
import { Panel } from './panel.js';

const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const recall = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const wait = ms => new Promise(done => setTimeout(done, ms));

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
const tapeName = new URLSearchParams(location.search).get('tape') || 'syshchik';
const tapeBytes = await load(`../tapes/${tapeName}.tap`);
if (tapeBytes) machine.insert(new Tape(tapeBytes, tapeName));

const keyboard = new Keyboard(document.getElementById('keyboard'), machine, action => {
  if (action === 'F1') { machine.reset(); keyboard.releaseAll(); if (machine.tape) machine.tape.rewind(); }
  if (action === 'F2') panel.toggle('tapes');
  if (action === 'F3') panel.toggle('lessons');
  if (action === 'F4') panel.toggle('settings');
});

// The theme is remembered between visits.
document.documentElement.dataset.theme = recall('theme', 'dark');

const panel = new Panel(document.getElementById('panel'), {
  onResize: () => fit(),
  theme: () => document.documentElement.dataset.theme,
  setTheme: value => { document.documentElement.dataset.theme = value; remember('theme', value); },
  sound: () => !beeper.muted,
  setSound: on => { beeper.muted = !on; remember('sound', on ? 'on' : 'off'); if (on) beeper.start(); },
  insertTape: async file => {
    const bytes = await load(`../tapes/${file}`);
    if (bytes) machine.insert(new Tape(bytes, file));
  },
  autoLoad: async () => {
    machine.reset();
    keyboard.releaseAll();
    if (machine.tape) machine.tape.rewind();
    await keyboard.waitFrames(90);          // let the ROM finish its own start-up
    await keyboard.type([['J'], ['SS', 'P'], ['SS', 'P'], ['ENTER']]);
  },
});
beeper.muted = recall('sound', 'on') === 'off';

// Sound may not start until the user has touched something.
const wake = () => { beeper.start(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);

globalThis.spectrum = machine;

// A pixel must stay square and a character cell exactly eight by eight, so the
// picture is only ever shown at a whole multiple of its own 320x240. Rather
// than shrink it to whatever is left over, we let the keyboard give way: its
// rows flatten by a few points so the screen can take the next whole step up.
const screen = document.getElementById('screen');
const desk = document.querySelector('.desk');
const tv = document.querySelector('.tv');
const machineCase = document.querySelector('.case');

const KEY_ROWS = 5, ROW_MIN = 34, ROW_MAX = 48;
const pad = (el, ...names) => names.reduce((t, n) => t + parseFloat(getComputedStyle(el)[n] || 0), 0);
const rowNow = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row'));

// Everything in the case that is not key rows: padding, gaps, the wordmark.
const caseExtra = machineCase.offsetHeight - KEY_ROWS * rowNow();

function fit() {
  const padX = pad(tv, 'paddingLeft', 'paddingRight');
  const padY = pad(tv, 'paddingTop', 'paddingBottom');
  const gap = parseFloat(getComputedStyle(desk).gap) || 0;
  const room = { w: desk.clientWidth - padX, h: desk.clientHeight - padY - gap - caseExtra };

  let scale = 0, row = ROW_MIN;
  for (let s = 6; s >= 1; s--) {
    if (screen.width * s > room.w) continue;
    const spare = (room.h - screen.height * s) / KEY_ROWS;
    if (spare >= ROW_MIN) { scale = s; row = Math.min(ROW_MAX, Math.floor(spare)); break; }
  }
  // Only if not even one pixel per pixel will fit do we scale by a fraction —
  // and even then the four-to-three ratio is kept exactly.
  if (!scale) {
    scale = Math.min(room.w / screen.width, (room.h - KEY_ROWS * ROW_MIN) / screen.height);
    row = ROW_MIN;
  }

  document.documentElement.style.setProperty('--row', row + 'px');
  screen.style.width = Math.round(screen.width * scale) + 'px';
  screen.style.height = Math.round(screen.height * scale) + 'px';
}

fit();
addEventListener('resize', fit);

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
    keyboard.tick();
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
