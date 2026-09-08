// The panel beside the machine: the shelf of tapes, the list of commands, and
// the settings. It opens from the keys along the bottom of the keyboard.

import { KEYS } from './rom-data.js';
import { COMMANDS, GROUPS } from './commands.js';
import { saved, forget, download } from './library.js';
import { LESSONS } from './lessons.js';

// Which keys produce which word — worked out from the ROM's own tables rather
// than written down by hand.
const KEYSTROKE = {};
for (const k of KEYS) {
  const letter = /^[A-Z]$/.test(k.id);
  if (k.keyword) KEYSTROKE[k.keyword] = k.id;
  if (k.symbol && k.symbol.length > 1) KEYSTROKE[k.symbol] = `SYMBOL SHIFT + ${k.id}`;
  if (letter && k.above) KEYSTROKE[k.above] = `E, затем ${k.id}`;
  if (letter && k.below && k.below.length > 1) KEYSTROKE[k.below] = `E, затем SYMBOL SHIFT + ${k.id}`;
  if (!letter && !k.special && k.below) KEYSTROKE[k.below] = `E, затем SYMBOL SHIFT + ${k.id}`;
}
// The comparison signs sit on keys whose symbol is the sign itself.
for (const k of KEYS) if (k.symbol && '<=,>=,<>'.includes(k.symbol) && k.symbol.length === 2) {
  KEYSTROKE[k.symbol] = `SYMBOL SHIFT + ${k.id}`;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export class Panel {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;               // { insertTape, autoLoad, setTheme, theme, setSound, sound }
    this.view = null;
    this.tapes = null;

    this.title = root.querySelector('.panel-title');
    this.body = root.querySelector('.panel-body');
    root.querySelector('.panel-close').addEventListener('click', () => this.close());
  }

  get open() { return !this.root.hidden; }

  // The lessons, one lesson and the reference are all the same drawer.
  toggle(view) {
    const family = v => (v && (v.startsWith('lesson') || v === 'commands')) ? 'lessons' : v;
    if (this.open && family(this.view) === family(view)) return this.close();
    this.show(view);
  }

  close() {
    this.root.hidden = true;
    this.view = null;
    this.actions.onResize?.();
  }

  show(view) {
    this.view = view;
    this.root.hidden = false;
    this.body.replaceChildren();
    if (view === 'tapes') { this.title.textContent = 'Полка с лентами'; this.renderTapes(); }
    else if (view === 'lessons') { this.title.textContent = 'Уроки'; this.renderLessonList(); }
    else if (view.startsWith('lesson:')) this.renderLesson(view.slice(7));
    else if (view === 'commands') { this.title.textContent = 'Все команды бейсика'; this.renderCommands(); }
    else if (view === 'settings') { this.title.textContent = 'Настройки'; this.renderSettings(); }
    this.body.scrollTop = 0;
    this.actions.onResize?.();
  }

  // ---- the lessons ----

  renderLessonList() {
    this.body.appendChild(el('p', 'panel-note',
      'По порядку, от первой строчки до устройства машины. У каждого примера есть кнопка — ' +
      'программа сама окажется в машине, и её можно запускать и ломать.'));

    LESSONS.forEach((lesson, i) => {
      const card = el('button', 'card card-choice');
      const head = el('div', 'card-head');
      head.append(el('span', 'card-name', lesson.title), el('span', 'card-key', `${i + 1}`));
      card.append(head, el('p', 'card-text', lesson.about));
      card.addEventListener('click', () => this.show(`lesson:${lesson.id}`));
      this.body.appendChild(card);
    });

    const reference = el('button', 'card card-choice');
    reference.append(el('span', 'card-name', 'Все команды бейсика'),
      el('p', 'card-text', 'Справочник: девяносто одна команда, что делает и какой клавишей набирается.'));
    reference.addEventListener('click', () => this.show('commands'));
    this.body.appendChild(reference);
  }

  renderLesson(id) {
    const index = LESSONS.findIndex(l => l.id === id);
    const lesson = LESSONS[index];
    if (!lesson) return this.show('lessons');
    this.title.textContent = lesson.title;

    this.body.appendChild(this.link('\u2190 ко всем урокам', () => this.show('lessons')));

    for (const part of lesson.parts) {
      if (part.p) this.body.appendChild(el('p', 'lesson-text', part.p));
      if (part.note) this.body.appendChild(el('p', 'lesson-note', part.note));
      if (part.task) {
        const task = el('div', 'lesson-task');
        task.append(el('span', 'lesson-task-title', 'Попробуй сам'), el('p', 'lesson-text', part.task));
        this.body.appendChild(task);
      }
      if (part.code) this.body.appendChild(this.listing(part.code));
    }

    const feet = el('div', 'card-buttons');
    if (index > 0) feet.appendChild(this.button('\u2190 назад', () => this.show(`lesson:${LESSONS[index - 1].id}`)));
    if (index < LESSONS.length - 1) {
      feet.appendChild(this.button(`дальше: ${LESSONS[index + 1].title} \u2192`,
        () => this.show(`lesson:${LESSONS[index + 1].id}`), true));
    }
    this.body.appendChild(feet);
  }

  listing(lines) {
    const wrap = el('div', 'listing');
    wrap.appendChild(el('pre', 'card-example', lines.join('\n')));
    const row = el('div', 'card-buttons');
    const put = this.button('вписать в машину', async () => {
      put.disabled = true;
      const was = put.textContent;
      put.textContent = 'вписываю…';
      await this.actions.loadListing(lines);
      put.textContent = was;
      put.disabled = false;
    }, true);
    row.appendChild(put);
    wrap.appendChild(row);
    return wrap;
  }

  button(text, onClick, strong = false) {
    const b = el('button', 'button' + (strong ? ' button-strong' : ''), text);
    b.addEventListener('click', onClick);
    return b;
  }

  link(text, onClick) {
    const b = el('button', 'panel-link', text);
    b.addEventListener('click', onClick);
    return b;
  }

  // ---- the shelf ----

  async renderTapes() {
    const how = el('p', 'panel-note',
      'Свои программы записывай прямо на машине: набери SAVE "ИМЯ", нажми ENTER, ' +
      'и когда она попросит — любую клавишу. Запись появится здесь и переживёт закрытие браузера.');
    this.body.appendChild(how);

    const row = el('div', 'card-buttons');
    const pick = el('button', 'button', 'взять ленту с диска');
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.tap';
    file.hidden = true;
    pick.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (file.files[0]) { await this.actions.importTape(file.files[0]); this.show('tapes'); }
    });
    row.append(pick, file);
    this.body.appendChild(row);

    const mine = saved();
    if (mine.length) {
      const section = el('section', 'group');
      section.appendChild(el('h3', 'group-title', 'Мои записи'));
      for (const item of mine) section.appendChild(this.tapeCard({
        name: item.name,
        note: `${item.kind}, ${Math.max(1, Math.round(item.size / 1024 * 10) / 10)} КБ — ` +
              new Date(item.when).toLocaleString('ru'),
        bytes: item.bytes,
        id: item.id,
      }));
      this.body.appendChild(section);
    }

    if (!this.tapes) {
      const loading = el('p', 'panel-note', 'Смотрю, что на полке…');
      this.body.appendChild(loading);
      try {
        const response = await fetch(new URL('../tapes/index.json', import.meta.url));
        this.tapes = await response.json();
      } catch { this.tapes = []; }
      loading.remove();
      if (this.view !== 'tapes') return;
    }

    if (this.tapes.length) {
      const section = el('section', 'group');
      section.appendChild(el('h3', 'group-title', 'Полка'));
      for (const tape of this.tapes) section.appendChild(this.tapeCard({
        name: tape.name,
        note: tape.note || `${Math.round(tape.bytes / 1024 * 10) / 10} КБ`,
        file: tape.file,
      }));
      this.body.appendChild(section);
    }
  }

  tapeCard({ name, note, file, bytes, id }) {
    const card = el('div', 'card');
    const head = el('div', 'card-head');
    head.append(el('span', 'card-name', name), el('span', 'card-key', id ? 'моё' : 'полка'));
    card.appendChild(head);
    if (note) card.appendChild(el('p', 'card-how', note));

    const put = async () => {
      if (file) await this.actions.insertTape(file);
      else this.actions.insertBytes(name, bytes());
    };

    const row = el('div', 'card-buttons');
    const insert = el('button', 'button', 'вставить');
    insert.addEventListener('click', async () => {
      await put();
      insert.textContent = 'вставлена';
      setTimeout(() => { insert.textContent = 'вставить'; }, 1400);
    });
    const play = el('button', 'button button-strong', 'загрузить');
    play.addEventListener('click', async () => {
      play.disabled = true;
      play.textContent = 'загружаю…';
      await put();
      await this.actions.autoLoad();
      play.disabled = false;
      play.textContent = 'загрузить';
      this.close();
    });
    row.append(insert, play);

    if (id) {
      const keep = el('button', 'button', 'скачать');
      keep.addEventListener('click', () => download(name, bytes()));
      const drop = el('button', 'button', 'стереть');
      drop.addEventListener('click', () => {
        if (drop.dataset.sure) { forget(id); this.show('tapes'); return; }
        drop.dataset.sure = '1';
        drop.textContent = 'точно?';
        setTimeout(() => { delete drop.dataset.sure; drop.textContent = 'стереть'; }, 3000);
      });
      row.append(keep, drop);
    }

    card.appendChild(row);
    return card;
  }

  // ---- every command in the language ----

  renderCommands() {
    const search = el('input', 'search');
    search.type = 'search';
    search.placeholder = 'найти команду…';
    this.body.appendChild(search);

    this.body.appendChild(el('p', 'panel-note',
      'Каждое слово бейсика набирается одной клавишей, а не по буквам. Здесь написано, какой именно.'));

    this.body.appendChild(this.link('\u2190 к урокам', () => this.show('lessons')));

    const list = el('div', 'lessons');
    this.body.appendChild(list);

    const cards = [];
    for (const [group, names] of GROUPS) {
      const section = el('section', 'group');
      section.appendChild(el('h3', 'group-title', group));
      for (const name of names) {
        const command = COMMANDS[name];
        if (!command) continue;
        const card = el('div', 'card');
        const head = el('div', 'card-head');
        head.append(el('span', 'card-name', name), el('span', 'card-key', KEYSTROKE[name] || ''));
        card.append(head, el('p', 'card-text', command.what), el('p', 'card-how', command.how));
        const example = el('pre', 'card-example', command.example);
        card.appendChild(example);
        section.appendChild(card);
        cards.push({ card, section, hay: (name + ' ' + command.what + ' ' + command.how).toLowerCase() });
      }
      list.appendChild(section);
    }

    search.addEventListener('input', () => {
      const needle = search.value.trim().toLowerCase();
      const shown = new Set();
      for (const { card, section, hay } of cards) {
        const hit = !needle || hay.includes(needle);
        card.hidden = !hit;
        if (hit) shown.add(section);
      }
      for (const section of list.children) section.hidden = !shown.has(section);
    });
  }

  // ---- settings ----

  renderSettings() {
    this.body.appendChild(this.choice('Тема', [
      ['dark', 'Тёмная', 'Машина стоит в темноте, как ночью на столе.'],
      ['light', 'Светлая', 'Экран разливается на всю страницу, края обозначены тонкой линией.'],
    ], this.actions.theme(), value => this.actions.setTheme(value)));

    this.body.appendChild(this.choice('Звук', [
      ['on', 'Включён', 'Бипер работает — тот самый единственный бит.'],
      ['off', 'Выключен', 'Тишина.'],
    ], this.actions.sound() ? 'on' : 'off', value => this.actions.setSound(value === 'on')));

    const section = el('section', 'group');
    section.appendChild(el('h3', 'group-title', 'Машина'));
    const restart = el('button', 'card card-choice');
    restart.append(el('span', 'card-name', 'Перезапустить'),
      el('p', 'card-text', 'Как выдернуть питание и включить снова. Всё, что не сохранено на ленту, пропадёт.'));
    restart.addEventListener('click', () => {
      if (restart.dataset.sure) { this.actions.restart(); this.close(); return; }
      restart.dataset.sure = '1';
      restart.querySelector('.card-name').textContent = 'Точно перезапустить?';
      setTimeout(() => {
        delete restart.dataset.sure;
        restart.querySelector('.card-name').textContent = 'Перезапустить';
      }, 4000);
    });
    section.appendChild(restart);
    this.body.appendChild(section);

    this.body.appendChild(el('p', 'panel-note',
      'Выбранное запоминается в этом браузере.'));
  }

  choice(title, options, current, onPick) {
    const section = el('section', 'group');
    section.appendChild(el('h3', 'group-title', title));
    for (const [value, label, note] of options) {
      const card = el('button', 'card card-choice' + (value === current ? ' chosen' : ''));
      card.append(el('span', 'card-name', label), el('p', 'card-text', note));
      card.addEventListener('click', () => {
        onPick(value);
        for (const other of section.querySelectorAll('.card-choice')) other.classList.remove('chosen');
        card.classList.add('chosen');
      });
      section.appendChild(card);
    }
    return section;
  }
}
