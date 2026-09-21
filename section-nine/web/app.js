import { objective } from '../src/engine.js';
import { adjacent, getEntity, entitiesFor, roomAt, FLOORS } from '../src/world.js';
import { activityFor, nearbyActivities, recentAmbient } from '../src/life.js';
import { journalSections, observationSections, endingSections } from '../src/presentation.js';
import { WorldClock } from '../src/world-clock.js';
import { DirectionalHold } from './input.js';
import { MobileStorage } from './storage.js';
import { paintMap } from './map.js';

const root = document.querySelector('#app');
const storage = new MobileStorage(() => window.localStorage);
const session = storage.load();
const game = session.game;
let renderedMode = null, mapCanvas = null, reader = null, scrollTimer = null, observer = null;
let offlineReady = Boolean(navigator.serviceWorker?.controller), waitingWorker = null;
const hold = new DirectionalHold((dx, dy) => {
  if (document.hidden) return false;
  const moved = session.move(dx, dy);
  storage.save(session); paint();
  return moved;
});
const clock = new WorldClock(game, {
  enabled: () => !document.hidden,
  onTick: () => { storage.save(session, false); paint(); },
});

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function button(label, action, className = '') {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function act(action) {
  hold.cancel();
  if (scrollTimer !== null) { clearTimeout(scrollTimer); scrollTimer = null; }
  action(); clock.reset(); storage.save(session); paint(true);
}
function open(view) { act(() => session.open(view)); }
function close() { act(() => session.close()); }
function saveScroll() {
  if (reader) session.scroll = reader.scrollTop;
  if (scrollTimer !== null) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrollTimer = null; storage.save(session); }, 200);
}
function heading(title, subtitle = '', back = false) {
  const header = element('header', 'topbar');
  if (back) header.append(button('‹ Штаб', close, 'quiet'));
  const text = element('div', 'heading');
  text.append(element('p', 'eyebrow', 'SECTION 09 / ЧУЖАЯ ПАМЯТЬ'));
  const titleNode = element('h1', 'title', title); titleNode.id = 'screen-title';
  text.append(titleNode);
  if (subtitle) text.append(element('p', 'subtitle', subtitle));
  header.append(text); root.append(header);
  return header;
}
function reading(title, subtitle = '') {
  heading(title, subtitle, true);
  reader = element('div', 'reader'); reader.tabIndex = -1;
  const inner = element('div', 'reader-inner'); reader.append(inner); root.append(reader);
  reader.addEventListener('scroll', saveScroll, { passive: true });
  return inner;
}
function sections(parent, items) {
  for (const [title, body] of items) parent.append(element('h2', '', title), element('p', '', body));
}
function bindDirection(node, direction = null) {
  node.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (game.mode !== 'map' || game.paused) return;
    node.setPointerCapture(event.pointerId);
    hold.down(event.pointerId, event.clientX, event.clientY, direction);
  });
  node.addEventListener('pointermove', event => hold.move(event.pointerId, event.clientX, event.clientY));
  node.addEventListener('pointerup', event => hold.up(event.pointerId));
  node.addEventListener('pointercancel', () => hold.cancel());
  node.addEventListener('lostpointercapture', event => hold.up(event.pointerId));
  node.addEventListener('contextmenu', event => event.preventDefault());
}
function mapScreen() {
  const header = heading('', '');
  const pause = button('Пауза', () => act(() => game.togglePause()), 'quiet'); pause.id = 'pause'; header.append(pause);
  const shell = element('div', 'map-shell');
  const space = element('div', 'map-space');
  mapCanvas = element('canvas'); mapCanvas.id = 'map';
  mapCanvas.setAttribute('aria-label', 'Карта штаба. Свайп — шаг, удержание — движение. Крестовину можно включить в меню.');
  space.append(mapCanvas, element('span', 'compass', 'N ↑'));
  const hint = element('span', 'map-hint', 'Свайп — шаг · удержание — идти'); hint.id = 'map-hint'; space.append(hint);
  bindDirection(mapCanvas); shell.append(space);
  const bottom = element('div', 'map-bottom');
  const goalRow = element('div', 'goal-row');
  const goal = element('div', 'goal');
  goal.append(element('div', 'goal-label', 'ТЕКУЩАЯ ЗАДАЧА'));
  const goalText = element('div'); goalText.id = 'goal'; goal.append(goalText);
  const route = button('Маршрут', () => act(() => { game.guide = !game.guide; }), 'quiet'); route.id = 'route';
  goalRow.append(goal, route); bottom.append(goalRow);
  const ambient = element('p', 'ambient'); ambient.id = 'ambient'; bottom.append(ambient);
  const near = element('div', 'near-status'); near.id = 'near-status'; bottom.append(near);
  const interactions = element('div', 'interactions'); interactions.id = 'interactions'; bottom.append(interactions);
  if (session.settings.dpad) {
    const pad = element('div', 'dpad'); pad.setAttribute('aria-label', 'Перемещение');
    for (const [label, direction, name] of [['↑', [0, -1], 'На север'], ['←', [-1, 0], 'На запад'], ['↓', [0, 1], 'На юг'], ['→', [1, 0], 'На восток']]) {
      const key = button(label, event => { if (event.detail === 0) { hold.step(...direction); } });
      key.setAttribute('aria-label', name); bindDirection(key, direction); pad.append(key);
    }
    bottom.append(pad);
  }
  shell.append(bottom);
  const nav = element('nav', 'navigation'); nav.setAttribute('aria-label', 'Экраны игры');
  for (const [icon, label, view] of [['≡', 'Журнал', 'journal'], ['◇', 'Наблюдения', 'observations'], ['▤', 'План', 'directory'], ['···', 'Меню', 'menu']]) {
    const key = button('', () => open(view));
    key.append(element('span', 'nav-icon', icon), element('span', '', label)); nav.append(key);
  }
  shell.append(nav); root.append(shell);
  observer = new ResizeObserver(() => { if (game.mode === 'map') paintMap(mapCanvas, game); });
  observer.observe(space);
}
let lastInteraction = '';
function updateMap() {
  document.querySelector('#screen-title').textContent = `${game.state.player.floor} / ${roomAt(game.state.player)}`;
  const pause = document.querySelector('#pause');
  pause.textContent = game.paused ? 'Продолжить' : 'Пауза'; pause.setAttribute('aria-pressed', String(game.paused));
  const goal = objective(game.state);
  document.querySelector('#goal').textContent = goal.title;
  const route = document.querySelector('#route'); route.setAttribute('aria-pressed', String(game.guide));
  document.querySelector('#map-hint').textContent = game.paused ? 'МИР НА ПАУЗЕ' : session.settings.dpad ? 'Крестовина или свайп по карте' : 'Свайп — шаг · удержание — идти';
  const ambient = recentAmbient(game.state);
  document.querySelector('#ambient').textContent = game.paused ? 'Можно читать журнал и изучать план.' : session.feedback || (ambient ? ambient.lines.join('\n') : game.state.timeMode === 'realtime' ? 'Штаб живёт в реальном времени.' : 'Пошаговый режим: мир ждёт вашего хода.');
  const target = game.interactionTarget;
  const near = adjacent(game.state.player, game.state);
  const status = target?.type === 'person' ? `${target.name}: ${activityFor(target.id, game.state)}` : nearbyActivities(game.state)[0];
  document.querySelector('#near-status').textContent = typeof status === 'string' ? status : status ? `${status.name}: ${activityFor(status.id, game.state)}` : ' ';
  const signature = `${target?.id}:${near.map(e => e.id).join(',')}`;
  if (signature !== lastInteraction) {
    lastInteraction = signature;
    const container = document.querySelector('#interactions'); container.replaceChildren();
    if (target) {
      const label = `${target.type === 'person' ? 'Поговорить' : target.type === 'scenery' ? 'Осмотреть' : 'Открыть'}: ${target.name}`;
      const key = button(label, () => act(() => session.interact(target.id)), 'primary'); key.id = 'interact'; container.append(key);
      if (near.length > 1) container.append(button(`Рядом: ${near.length}`, () => open('targets'), 'more'));
    } else container.append(element('div', 'empty-interaction', 'Подойдите к сотруднику или предмету вплотную.'));
  }
  mapCanvas.setAttribute('aria-label', `Карта штаба: ${game.state.player.floor} этаж, позиция ${game.state.player.x}, ${game.state.player.y}. Свайп — шаг, удержание — движение. Крестовина доступна в меню.`);
  paintMap(mapCanvas, game);
}
function dialogueScreen() {
  const entity = getEntity(game.dialogue.id, game.state);
  const node = game.currentNode;
  const inner = reading(entity.name, entity.type === 'person' ? activityFor(entity.id, game.state) : entity.role);
  const text = element('div', 'prose dialogue-text', node.text); inner.append(text);
  inner.append(element('div', 'choice-caption', 'ВАШ ОТВЕТ'));
  const choices = element('div', 'choices');
  node.options.forEach((option, index) => choices.append(button(option.label, () => act(() => session.choose(index)))));
  inner.append(choices);
}
function menuScreen() {
  const inner = reading('Управление и настройки', storage.enabled ? 'Прогресс сохраняется на этом устройстве' : 'Сеанс без автосохранения');
  const group = element('div', 'menu-group');
  const pad = button(`Крестовина: ${session.settings.dpad ? 'включена' : 'выключена'}`, () => act(() => { session.settings.dpad = !session.settings.dpad; }));
  pad.setAttribute('aria-pressed', String(session.settings.dpad)); group.append(pad);
  group.append(button(`Время: ${game.state.timeMode === 'realtime' ? 'реальное' : 'пошаговое'}`, () => act(() => game.toggleTimeMode())));
  const fontLabel = element('label', '', 'Размер текста');
  const select = element('select'); select.setAttribute('aria-label', 'Размер текста');
  for (const [value, label] of [['normal', 'Обычный'], ['large', 'Крупный'], ['extra', 'Очень крупный']]) {
    const option = element('option', '', label); option.value = value; select.append(option);
  }
  select.value = session.settings.textSize;
  select.addEventListener('change', () => act(() => { session.settings.textSize = select.value; }));
  fontLabel.append(select); group.append(fontLabel);
  const wait = button(game.state.timeMode === 'realtime' ? 'Дать сотрудникам пройти' : 'Подождать один ход', () => act(() => { session.close(); game.wait(); }));
  wait.disabled = game.paused; group.append(wait);
  group.append(button('Как играть и установить приложение', () => open('help')));
  inner.append(group);
  sections(inner, [['НА УСТРОЙСТВЕ', storage.enabled ? 'Это отдельное прохождение. Консольные сохранения не меняются. Очистка данных сайта удалит мобильный прогресс.' : storage.warning], ['ОФЛАЙН', offlineReady ? 'Готово офлайн. Приложение сохранено для запуска без сети.' : window.isSecureContext ? 'Офлайн-копия ещё не готова. Оставьте приложение открытым до завершения загрузки.' : 'Игра работает. Для офлайн-режима откройте приложение по HTTPS; адрес компьютера по обычному HTTP для этого не подходит.']]);
  inner.append(button('Новое прохождение', () => open('restart'), 'danger'));
}
function directoryScreen() {
  const inner = reading('План штаба', 'Переключайте этажи. Увеличенную схему можно двигать пальцем.');
  const floors = element('div', 'plan-controls');
  for (const floor of [24, 23]) {
    const key = button(`${floor} этаж`, () => act(() => { session.planFloor = floor; session.scroll = 0; }));
    key.setAttribute('aria-pressed', String(session.planFloor === floor)); floors.append(key);
  }
  inner.append(floors);
  const zoom = element('div', 'plan-controls');
  for (const [value, label] of [[1, 'Обзор'], [2, '×2'], [3, '×4']]) {
    const key = button(label, () => act(() => { session.planZoom = value; })); key.setAttribute('aria-pressed', String(session.planZoom === value)); zoom.append(key);
  }
  inner.append(zoom);
  const viewport = element('div', 'plan-viewport'); const canvas = element('canvas');
  canvas.setAttribute('aria-label', `Схема ${session.planFloor} этажа`); viewport.append(canvas); inner.append(viewport);
  const floor = session.planFloor;
  inner.append(element('h2', '', FLOORS[floor].name));
  const people = entitiesFor(game.state).filter(e => e.type === 'person' && e.floor === floor);
  sections(inner, [['СОТРУДНИКИ', people.map(e => `${e.glyph} — ${e.name}\n${roomAt(e)} · ${activityFor(e.id, game.state)}`).join('\n\n')], ['ПОМЕЩЕНИЯ', FLOORS[floor].rooms.map(r => r.name).join('\n')], ['ПЕРЕХОД МЕЖДУ ЭТАЖАМИ', 'Лифт L и лестница S находятся в южном холле. Поездка между этажами свободна. Выезд в гараж — отдельное действие после утверждения плана.']]);
  observer = new ResizeObserver(() => paintMap(canvas, game, { overview: true, floor, zoom: session.planZoom, availableWidth: viewport.clientWidth }));
  observer.observe(viewport);
}
function helpScreen() {
  const inner = reading('Как играть', 'Одна глава · два этажа · расследование через разговоры');
  sections(inner, [
    ['ВЫ — МОТОКО КУСАНАГИ', 'Арамаки ждёт на 24-м этаже, в кабинете за приёмной. Получите вводную, поговорите с группой и проверьте три независимых источника.'],
    ['ПЕРЕМЕЩЕНИЕ', 'Проведите пальцем по карте — один шаг. Потяните и удерживайте — идти в том же направлении. Отпустите, чтобы остановиться. Для поворота начните новый жест. В меню можно включить крестовину.'],
    ['РАЗГОВОРЫ И НАХОДКИ', 'Подойдите вплотную и нажмите кнопку под картой. Если рядом несколько объектов, выберите «Рядом». Длинные реплики и ответы прокручиваются пальцем. Осмотренные предметы открывают личные темы; в наблюдениях указано, с кем их обсудить.'],
    ['КАРТА', '@ — вы. A — Арамаки, B — Бато, T — Тогуса, I — Исикава, K — Татикома, N — Накамура, M — Мидзуно. F — лаборатория, R — архив, D — тактический стол, L — лифт, S — лестница. Маленькие цветные буквы — предметы. Оранжевым отмечена цель; кнопка «Маршрут» подскажет дорогу.'],
    ['РАССЛЕДОВАНИЕ', 'Предъявляйте найденные улики Бато, Тогусе и Арамаки. Собрав три улики, сформулируйте версию за тактическим столом и обсудите её с коллегами. Закончите повторные проверки и обоснуйте вывод Арамаки. Выезд в гараж завершает главу.'],
    ['ТЕМП', 'Боя и таймера расследования нет. При чтении и сворачивании приложения мир стоит на паузе. В меню можно переключить реальное время на пошаговый режим или дать сотрудникам пройти.'],
    ['НА ДОМАШНИЙ ЭКРАН IPHONE', 'Откройте HTTPS-адрес игры в Safari. В меню «Поделиться» выберите «На экран Домой»; если есть переключатель «Открывать как веб-приложение», включите его. После появления статуса «Готово офлайн» можно запускать игру без сети.'],
    ['СОХРАНЕНИЕ', 'Прогресс и текущий разговор сохраняются только в этом браузере или установленном приложении. Переноса между консолью, Safari и отдельными установками нет. Не очищайте данные сайта, если хотите сохранить прохождение.'],
    ['ОБ ИГРЕ', 'Неофициальная фан-игра по мотивам Ghost in the Shell. Персонажи и сеттинг принадлежат их правообладателям. Сюжет дела — оригинальный.'],
  ]);
}
function paint(force = false) {
  document.documentElement.style.setProperty('--font-size', { normal: '17px', large: '20px', extra: '23px' }[session.settings.textSize]);
  const warning = document.querySelector('#save-warning'); warning.hidden = !storage.warning; warning.textContent = storage.warning;
  if (force || renderedMode !== game.mode) {
    hold.cancel(); observer?.disconnect(); observer = null; reader = null; mapCanvas = null;
    root.replaceChildren(); renderedMode = game.mode; lastInteraction = '';
    if (game.mode === 'map') mapScreen();
    else if (game.mode === 'dialogue') dialogueScreen();
    else if (game.mode === 'menu') menuScreen();
    else if (game.mode === 'directory') directoryScreen();
    else if (game.mode === 'help') helpScreen();
    else if (game.mode === 'journal') sections(reading('Журнал расследования', `Дело 014—S · ${game.state.journal.length} записей`), journalSections(game.state));
    else if (game.mode === 'observations') sections(reading('Наблюдения', `${game.state.life.inspected.length} историй · ${game.state.life.heard.length} бесед`), observationSections(game.state));
    else if (game.mode === 'ending') sections(reading('Глава 01 завершена', 'У призраков есть адрес'), endingSections(game.state));
    else if (game.mode === 'targets') {
      const inner = reading('Кто рядом', 'Выберите собеседника или предмет'); const choices = element('div', 'choices');
      for (const entity of adjacent(game.state.player, game.state)) choices.append(button(entity.name, () => act(() => session.interact(entity.id))));
      inner.append(choices);
    } else if (game.mode === 'restart') {
      const inner = reading('Начать заново?', 'Текущий мобильный прогресс будет заменён');
      inner.append(element('p', '', 'Улики, решения, наблюдения и разговоры этого прохождения будут удалены.'));
      const choices = element('div', 'choices');
      choices.append(button('Оставить текущее прохождение', close), button('Начать новое дело', () => act(() => { session.restart(); storage.reset(session); }), 'danger'));
      inner.append(choices);
    }
    if (reader) reader.scrollTop = session.scroll;
  }
  if (game.mode === 'map') updateMap();
}

function suspend() {
  hold.cancel(); clock.reset();
  if (reader) session.scroll = reader.scrollTop;
  storage.save(session);
}
document.addEventListener('visibilitychange', () => { suspend(); if (!document.hidden) paint(); });
window.addEventListener('pagehide', suspend);
window.addEventListener('pageshow', () => { hold.cancel(); clock.reset(); paint(); });
window.addEventListener('blur', () => { hold.cancel(); });
window.addEventListener('resize', () => { hold.cancel(); });
window.addEventListener('orientationchange', () => { hold.cancel(); });
document.addEventListener('pointerdown', event => {
  if (hold.pointers.size && !hold.pointers.has(event.pointerId)) { hold.stop(); hold.blocked = true; hold.pointers.add(event.pointerId); }
}, true);
document.addEventListener('pointerup', event => hold.up(event.pointerId), true);
document.addEventListener('pointercancel', () => hold.cancel(), true);
window.addEventListener('keydown', event => {
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (game.mode === 'map') {
    const direction = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[event.key];
    if (direction) { event.preventDefault(); hold.step(...direction); }
  }
});

document.querySelector('#apply-update').addEventListener('click', () => {
  suspend();
  if (!storage.enabled) { paint(); return; }
  waitingWorker?.postMessage({ type: 'ACTIVATE_UPDATE' });
});
async function registerOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    const registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url));
    const announce = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting; document.querySelector('#update').hidden = false;
      }
    };
    announce();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') announce(); });
    });
    await navigator.serviceWorker.ready;
    offlineReady = true;
    if (game.mode === 'menu') paint(true);
  } catch {
    offlineReady = Boolean(navigator.serviceWorker?.controller);
  }
}
let reloading = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (waitingWorker && !reloading) { reloading = true; window.location.reload(); }
});
paint(); storage.save(session); clock.start(); registerOffline();
