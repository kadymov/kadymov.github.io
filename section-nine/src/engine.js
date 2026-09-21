import { START, ENTITIES, adjacent, entityAt, walkable, roomAt, roomInfo, getEntity } from './world.js';
import { freshLife, validateLife, advanceLife, activityFor } from './life.js';
import { HYPOTHESES, APPROACHES, getNode, startNode, hasAllClues } from './story.js';

import { freshDiscussions, validateDiscussions } from './evidence.js';

import { freshCasework, validateCasework, CHECKS, canApprove } from './casework.js';

import { freshHistory, validateHistory, rememberContext, rememberPlace, takeGreeting } from './greetings.js';

export const SAVE_VERSION = 6;
export const FLAG_NAMES = ['briefed', 'batouAccess', 'testimony', 'military', 'memory', 'trace'];

export function freshState({ timeMode = 'realtime' } = {}) {
  return {
    version: SAVE_VERSION,
    timeMode,
    player: { ...START },
    flags: Object.fromEntries(FLAG_NAMES.map(key => [key, false])),
    hypothesis: null,
    approach: null,
    completed: false,
    steps: 0,
    life: freshLife(),
    discussions: freshDiscussions(),
    casework: freshCasework(),
    history: freshHistory(),
    journal: [{ title: '06:40 / Штаб 9-го отдела', text: 'Арамаки вызвал группу до начала смены. Получите вводную в его кабинете на 24-м этаже, через приёмную в северо-западном крыле. Вы — майор Мотоко Кусанаги.' }],
  };
}

export function validateState(raw) {
  if (!raw || raw.version !== SAVE_VERSION || !raw.player || !Number.isInteger(raw.player.x) || !Number.isInteger(raw.player.y) || !Number.isInteger(raw.player.floor)) throw new Error('Неверная позиция или версия сохранения.');
  if (!['realtime', 'turn-based'].includes(raw.timeMode)) throw new Error('Неизвестный режим времени.');
  const life = validateLife(raw.life, raw.player);
  if (!walkable(raw.player.x, raw.player.y, raw.player.floor, { life })) throw new Error('Позиция игрока занята.');
  if (!raw.flags || FLAG_NAMES.some(key => typeof raw.flags[key] !== 'boolean')) throw new Error('Повреждены данные расследования.');
  if (raw.hypothesis !== null && !Object.hasOwn(HYPOTHESES, raw.hypothesis)) throw new Error('Неизвестная версия расследования.');
  if (raw.approach !== null && !Object.hasOwn(APPROACHES, raw.approach)) throw new Error('Неизвестный план выезда.');
  if (typeof raw.completed !== 'boolean' || !Number.isSafeInteger(raw.steps) || raw.steps < 0) throw new Error('Повреждён прогресс.');
  const f = raw.flags;
  if ((!f.briefed && FLAG_NAMES.slice(1).some(key => f[key])) || (f.military && !f.batouAccess) || (f.memory && !f.testimony) || (raw.hypothesis && !hasAllClues(raw)) || (raw.approach && !raw.hypothesis) || (raw.completed && !raw.approach)) throw new Error('Нарушена последовательность расследования.');
  if (!Array.isArray(raw.journal) || raw.journal.length > 500 || raw.journal.some(entry => !entry || typeof entry.title !== 'string' || typeof entry.text !== 'string' || entry.title.length > 200 || entry.text.length > 4000)) throw new Error('Повреждён журнал.');
  const casework = validateCasework(raw.casework, raw.flags);
  if (raw.approach && !canApprove({ ...raw, casework })) throw new Error('План утверждён без проверки и доклада.');
  // Never emit terminal escape sequences from a save file.
  const clean = text => text.replace(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/g, ' ');
  return {
    version: SAVE_VERSION,
    timeMode: raw.timeMode,
    player: { floor: raw.player.floor, x: raw.player.x, y: raw.player.y },
    flags: Object.fromEntries(FLAG_NAMES.map(key => [key, raw.flags[key]])),
    hypothesis: raw.hypothesis,
    approach: raw.approach,
    completed: raw.completed,
    steps: raw.steps,
    life,
    discussions: validateDiscussions(raw.discussions, raw.flags),
    casework,
    history: validateHistory(raw.history),
    journal: raw.journal.map(entry => ({ title: clean(entry.title).replace(/\n/g, ' '), text: clean(entry.text) })),
  };
}

function caseObjective(s) {
  if (!s.flags.briefed) return { title: 'Получить вводную', detail: '24 этаж. Северо-запад, вход через приёмную.', target: 'aramaki', stage: 0 };
  if (!s.flags.batouAccess) return { title: 'Поговорить с Бато', detail: '23 этаж. Оружейная на северо-западе, через комнату выдачи.', target: 'batou', stage: 1 };
  if (!s.flags.military) return { title: 'Проверить военный архив', detail: '23 этаж. Терминал R в серверной, северо-восток.', target: 'archive', stage: 1 };
  if (!s.flags.testimony) return { title: 'Выслушать Тогусу', detail: '24 этаж. Следственная комната в западном крыле.', target: 'togusa', stage: 1 };
  if (!s.flags.memory) return { title: 'Исследовать память', detail: '23 этаж. Терминал F в лаборатории, вход через шлюз.', target: 'forensics', stage: 1 };
  if (!s.flags.trace) return { title: 'Найти источник сигнала', detail: '24 этаж. Исикава в оперативном зале, северо-восток.', target: 'ishikawa', stage: 1 };
  if (!s.hypothesis) return { title: 'Сопоставить улики', detail: '24 этаж. Стол D в стеклянной комнате брифингов.', target: 'table', stage: 2 };
  if (!s.approach) {
    for (const [key, check] of Object.entries(CHECKS)) {
      if (!s.casework.results.includes(key)) return { title: s.casework.unlocked.includes(key) ? check.title : `Обсудить версию с ${check.contact === 'batou' ? 'Бато' : 'Тогусой'}`, detail: `${check.floor} этаж. ${check.action}`, target: s.casework.unlocked.includes(key) ? check.target : check.contact, stage: 3 };
    }
  }
  if (!s.approach) return { title: canApprove(s) ? 'Согласовать выезд' : 'Обосновать версию Арамаки', detail: '24 этаж. Кабинет Арамаки, через приёмную.', target: 'aramaki', stage: 3 };
  if (!s.completed) return { title: 'Завершить главу', detail: 'Лифт L на любом этаже: выберите выезд в гараж.', target: `lift-${s.player.floor}`, stage: 4 };
  return { title: 'Расследование начато', detail: 'Глава завершена. Можно изучать штаб или начать заново.', target: `lift-${s.player.floor}`, stage: 5 };
}

export function objective(state) {
  const goal = caseObjective(state);
  const target = getEntity(goal.target, state);
  if (target?.type === 'person') return { ...goal, detail: `${target.floor} этаж. ${roomAt(target)}. ${activityFor(target.id, state)}.` };
  return goal;
}

export class Game {
  constructor(state = freshState()) {
    this.state = validateState(state);
    this.mode = 'map';
    this.paused = false;
    this.yieldTicks = 0;
    this.dialogue = null;
    this.selected = 0;
    this.scroll = 0;
    this.pageSize = 10;
    this.maxScroll = 0;
    this.guide = false;
    this.facing = { x: 0, y: -1 };
    this.message = 'Арамаки за приёмной, этаж 24. [P] Пауза [T] Режим [M] План';
  }
  get currentNode() {
    const entity = ENTITIES.find(e => e.id === this.dialogue?.id);
    const result = entity ? getNode(entity.story ?? entity.id, this.dialogue.node, this.state) : null;
    const greeting = this.dialogue?.greeting;
    return result && greeting ? { ...result, text: greeting.replace ? greeting.text : `${greeting.text}\n\n${result.text}` } : result;
  }
  move(dx, dy) {
    if (this.mode !== 'map' || this.paused || Math.abs(dx) + Math.abs(dy) !== 1) return false;
    this.facing = { x: dx, y: dy };
    const next = { floor: this.state.player.floor, x: this.state.player.x + dx, y: this.state.player.y + dy };
    const entity = entityAt(next.x, next.y, next.floor, this.state);
    if (entity) return this.talk(entity.id);
    if (!walkable(next.x, next.y, next.floor, this.state)) { this.message = 'Проход закрыт. Обойдите стену или мебель.'; return false; }
    const changedRoom = roomAt(this.state.player) !== roomAt(next);
    this.state.player = next;
    this.state.steps++;
    if (changedRoom) rememberPlace(this.state);
    if (this.state.timeMode === 'turn-based') advanceLife(this.state);
    const near = adjacent(next, this.state);
    if (near.length) this.message = `[E] ${near.map(e => e.name).join(' / ')}`;
    else if (changedRoom || this.message.startsWith('[E]')) this.message = roomInfo(next).description;
    return true;
  }
  talk(id) {
    if (this.mode !== 'map' || !adjacent(this.state.player, this.state).some(e => e.id === id)) return false;
    const entity = ENTITIES.find(e => e.id === id);
    this.yieldTicks = 0;
    this.dialogue = { id, node: startNode(entity.story ?? id, this.state), greeting: entity.type === 'person' ? takeGreeting(this.state, id) : null };
    if (entity.type === 'terminal') rememberPlace(this.state);
    this.mode = 'dialogue';
    this.selected = 0;
    this.scroll = 0;
    return true;
  }
  get interactionTarget() {
    const near = adjacent(this.state.player, this.state);
    const front = entityAt(this.state.player.x + this.facing.x, this.state.player.y + this.facing.y, this.state.player.floor, this.state);
    return near.length ? (front ?? near[0]) : null;
  }
  interact() {
    const target = this.interactionTarget;
    if (target) return this.talk(target.id);
    this.message = 'Подойдите вплотную к персонажу или терминалу и нажмите E.';
    return false;
  }
  choose(index) {
    if (this.mode !== 'dialogue') return false;
    const choice = this.currentNode?.options[index];
    if (!choice) return false;
    const before = this.state.journal.length;
    const previousFloor = this.state.player.floor;
    this.dialogue.greeting = null;
    const observations = this.state.life.inspected.length;
    choice.effect?.(this.state);
    if (this.state.player.floor !== previousFloor) rememberContext(this.state, 'floor', String(this.state.player.floor));
    this.selected = 0;
    this.scroll = 0;
    if (choice.next === '$ending') { this.mode = 'ending'; this.dialogue = null; }
    else if (choice.next === '$travel') {
      this.close();
      this.message = `Этаж ${this.state.player.floor}. ${roomInfo(this.state.player).description}`;
    }
    else if (choice.next === null) this.close();
    else this.dialogue.node = choice.next;
    if (this.state.life.inspected.length > observations) this.message = 'Наблюдение записано. [N] Посмотреть истории штаба';
    if (this.state.journal.length > before) this.message = `Журнал обновлён: ${this.state.journal.at(-1).title}`;
    return true;
  }
  close() {
    this.mode = 'map';
    this.dialogue = null;
    this.scroll = 0;
    this.selected = 0;
  }
  restart() {
    this.state = freshState({ timeMode: this.state.timeMode });
    this.paused = false;
    this.yieldTicks = 0;
    this.guide = false;
    this.close();
    this.message = 'Новое дело. Арамаки ждёт на 24-м этаже, в кабинете за приёмной.';
  }
  get realtimeRunning() { return this.state.timeMode === 'realtime' && this.mode === 'map' && !this.paused; }
  tickRealtime() {
    if (!this.realtimeRunning) return false;
    advanceLife(this.state, { waiting: this.yieldTicks > 0 });
    if (this.yieldTicks > 0) this.yieldTicks--;
    return true;
  }
  togglePause() {
    this.paused = !this.paused;
    this.message = this.paused ? 'Пауза. [P] Продолжить; журналы и планы доступны.' : 'Пауза снята. [T] Переключить режим времени';
  }
  toggleTimeMode() {
    this.state.timeMode = this.state.timeMode === 'realtime' ? 'turn-based' : 'realtime';
    this.yieldTicks = 0;
    this.message = this.state.timeMode === 'realtime' ? 'Реальное время: мир живёт сам. [P] Пауза' : 'Пошаговый режим: мир продвигается после шага или «.».';
  }
  wait() {
    if (this.mode !== 'map' || this.paused) return false;
    if (this.state.timeMode === 'realtime') {
      this.yieldTicks = 4;
      this.message = 'Вы даёте сотрудникам пройти. Время идёт с обычной скоростью.';
    } else {
      advanceLife(this.state, { waiting: true });
      this.message = 'Вы пропускаете ход. Штаб продолжает жить. [N] Наблюдения';
    }
    return true;
  }
  scrollBy(delta) { this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + delta)); }
  handle(key) {
    if (key === 'escape') { this.close(); return; }
    if (this.mode === 'restart') {
      if (key === 'y' || key === 'н') this.restart();
      else if (key === 'n' || key === 'т') this.close();
      return;
    }
    if (key === 'pageup') { this.scrollBy(-this.pageSize); return; }
    if (key === 'pagedown') { this.scrollBy(this.pageSize); return; }
    if (this.mode === 'dialogue') {
      if (/^[1-5]$/.test(key)) this.choose(Number(key) - 1);
      else if (key === 'up') this.selected = Math.max(0, this.selected - 1);
      else if (key === 'down') this.selected = Math.min(this.currentNode.options.length - 1, this.selected + 1);
      else if (key === 'return' || key === 'space') this.choose(this.selected);
      return;
    }
    if (this.mode !== 'map') {
      if (key === 'up') this.scrollBy(-1);
      else if (key === 'down') this.scrollBy(1);
      else if (key === 'return' || key === 'space' || key === 'j' || key === 'о' || key === 'm' || key === 'ь' || key === 'n' || key === 'т') this.close();
      return;
    }
    const moves = { up: [0, -1], w: [0, -1], ц: [0, -1], down: [0, 1], s: [0, 1], ы: [0, 1], left: [-1, 0], a: [-1, 0], ф: [-1, 0], right: [1, 0], d: [1, 0], в: [1, 0] };
    if (['p', 'з'].includes(key)) this.togglePause();
    else if (['t', 'е'].includes(key)) this.toggleTimeMode();
    else if (moves[key]) this.move(...moves[key]);
    else if (['.', 'ю'].includes(key)) this.wait();
    else if (['e', 'у', 'return', 'space'].includes(key)) this.interact();
    else if (['j', 'о'].includes(key)) { this.mode = 'journal'; this.scroll = 0; }
    else if (['n', 'т'].includes(key)) { this.mode = 'observations'; this.scroll = 0; }
    else if (['m', 'ь'].includes(key)) { this.mode = 'directory'; this.scroll = 0; }
    else if (['?', 'h', 'р'].includes(key)) { this.mode = 'help'; this.scroll = 0; }
    else if (['g', 'п'].includes(key)) { this.guide = !this.guide; this.message = this.guide ? 'Маршрут ведёт к цели; если она на другом этаже — сначала к лифту.' : 'Маршрут скрыт.'; }
    else if (['r', 'к'].includes(key)) this.mode = 'restart';
  }
}
