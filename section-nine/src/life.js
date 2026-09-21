import { ENTITIES, floorAt, terrainWalkable, getEntity, entitiesFor, entityAt, distance } from './world.js';
import { DETAILS } from './details.js';

export const REALTIME_TICK_MS = 750;
export const REALTIME_AMBIENT_GAP = 32;

const stop = (x, y, activity, travel, dwell = 9) => ({ x, y, activity, travel, dwell });
export const ROUTINES = {
  aramaki: [stop(6, 5, 'читает бумажное дело', 'возвращается к столу', 14), stop(2, 6, 'смотрит на город', 'идёт к окну', 10)],
  ishikawa: [stop(43, 5, 'разбирает сетевые логи', 'идёт к своей консоли', 12), stop(49, 2, 'сверяет индикаторы узла', 'проверяет сетевой узел'), stop(46, 8, 'сравнивает две трассировки', 'идёт к соседнему экрану')],
  togusa: [stop(5, 18, 'сверяет протокол осмотра', 'возвращается к протоколу', 12), stop(5, 20, 'раскладывает бумажные копии', 'идёт к папкам', 7), stop(14, 24, 'делает паузу за кофе', 'идёт в комнату отдыха', 12)],
  batou: [stop(6, 5, 'проверяет затвор', 'возвращается к верстаку', 12), stop(7, 7, 'сверяет боекомплект', 'идёт к оружейным шкафам'), stop(15, 5, 'проверяет бронежилет', 'идёт в комнату выдачи', 11)],
  tachikoma: [stop(8, 21, 'проходит самодиагностику', 'катится на платформу', 10), stop(11, 24, 'считает следы на полу', 'объезжает платформу', 6), stop(15, 24, 'проверяет заряд', 'катится к зарядному блоку', 10)],
  duty: [stop(16, 5, 'проверяет пропуска', 'возвращается к посетителям'), stop(14, 5, 'сверяет журнал дежурств', 'идёт к стойке'), stop(16, 8, 'отвечает по внутренней связи', 'отходит с гарнитурой', 7)],
  mechanic: [stop(12, 18, 'перебирает инструменты', 'идёт к инструментам'), stop(11, 21, 'слушает приводы Татикомы', 'обходит платформу', 12), stop(4, 20, 'калибрует манипулятор', 'идёт к сервисному стенду')],
};

export const AMBIENT = [
  { id: 'duty-umbrella', speaker: 'duty', lines: ['Накамура, в гарнитуру: «Зонт всё ещё здесь».', 'Из гарнитуры: «Значит, у владельца есть повод вернуться».'] },
  { id: 'chief-tea', speaker: 'aramaki', lines: ['Арамаки, по связи: «Чай можно не менять. Я помню».', 'Накамура: «Вы и вчера так сказали, начальник».'] },
  { id: 'togusa-dinner', speaker: 'togusa', lines: ['Тогуса, тихо в телефон: «Постараюсь успеть к ужину».', 'Пауза. «Нет, это не то же самое, что обещаю».'] },
  { id: 'ishikawa-coffee', speaker: 'ishikawa', lines: ['Исикава: «Узел жив. Это кофеварка не отвечает».', 'Голос в канале: «Приоритет у неё, если честно».'] },
  { id: 'batou-dog', speaker: 'batou', lines: ['Бато, в гарнитуру: «Ключ у консьержа. Корм — справа».', '«И не верь ему: он уже завтракал».'] },
  { id: 'tachikoma-sound', speaker: 'tachikoma', partner: 'mechanic', lines: ['Татикома: «У меня новый звук. Это характер?»', 'Мидзуно: «Подшипник. Характер гарантия не покрывает».'] },
  { id: 'mechanic-oil', speaker: 'mechanic', lines: ['Мидзуно, по связи: «Бато, банка снова пустая».', 'Бато: «Куплю ещё. Только ложку не потеряйте».'] },
  { id: 'case-quiet', speaker: 'duty', requires: 'briefed', lines: ['Накамура: «По этому делу — только через Арамаки».', 'В гарнитуре спорят. Она повторяет: «Только через него».'] },
  { id: 'batou-names', speaker: 'batou', requires: 'batouAccess', lines: ['Бато, в канал: «Проверь фамилии, не только номера».', 'Исикава: «Уже проверяю».'] },
  { id: 'memory-copies', speaker: 'togusa', requires: 'memory', lines: ['Тогуса, по связи: «Оригинал оставьте под пломбой».', '«Да, даже если копия рассказывает всё очень складно».'] },
  { id: 'network-silence', speaker: 'ishikawa', requires: 'trace', lines: ['Исикава: «Запросов больше не шлите. Там нас услышали».', 'На соседней консоли гаснет индикатор передачи.'] },
  { id: 'tachikoma-marks', speaker: 'tachikoma', lines: ['Татикома: «Я оставила следы. Значит, здесь была я!»', 'Она сверяет рисунок протектора с отметинами на полу.'] },
];

export function freshLife(player) {
  const life = {
    tick: 0,
    npcs: Object.fromEntries(Object.entries(ROUTINES).map(([id, route]) => {
      const entity = ENTITIES.find(e => e.id === id);
      return [id, { floor: entity.floor, x: entity.x, y: entity.y, stop: 0, wait: route[0].dwell }];
    })),
    heard: [],
    inspected: [],
  };
  // New background staff must not invalidate an old save where the player was
  // standing at their newly introduced starting spot.
  for (const [id, npc] of Object.entries(life.npcs)) {
    if (!player || distance(npc, player) !== 0) continue;
    const route = ROUTINES[id];
    const index = route.findIndex(p => distance({ ...p, floor: npc.floor }, player) !== 0 && !Object.values(life.npcs).some(other => other.floor === npc.floor && other.x === p.x && other.y === p.y));
    if (index < 0) throw new Error('Нет свободного рабочего места для сотрудника.');
    Object.assign(npc, { x: route[index].x, y: route[index].y, stop: index, wait: route[index].dwell });
  }
  return life;
}

export function validateLife(raw, player) {
  if (!raw || !Number.isSafeInteger(raw.tick) || raw.tick < 0 || !raw.npcs || typeof raw.npcs !== 'object') throw new Error('Повреждён распорядок штаба.');
  const occupied = new Set([`${player.floor}:${player.x},${player.y}`]);
  const npcs = {};
  for (const [id, route] of Object.entries(ROUTINES)) {
    const n = raw.npcs[id];
    const original = ENTITIES.find(e => e.id === id);
    if (!n || n.floor !== original.floor || !Number.isInteger(n.x) || !Number.isInteger(n.y) || !terrainWalkable(n.x, n.y, n.floor) || !Number.isInteger(n.stop) || !route[n.stop] || !Number.isInteger(n.wait) || n.wait < 0 || n.wait > route[n.stop].dwell) throw new Error(`Повреждено положение сотрудника: ${id}.`);
    if (n.wait > 0 && (n.x !== route[n.stop].x || n.y !== route[n.stop].y)) throw new Error('Сотрудник остановлен вне рабочего места.');
    const key = `${n.floor}:${n.x},${n.y}`;
    if (occupied.has(key) || ENTITIES.some(e => e.type !== 'person' && distance(e, n) === 0)) throw new Error('Персонажи или объекты пересекаются.');
    occupied.add(key);
    npcs[id] = { floor: n.floor, x: n.x, y: n.y, stop: n.stop, wait: n.wait };
  }
  if (!Array.isArray(raw.heard) || raw.heard.length > AMBIENT.length || raw.heard.some((entry, index) => !entry || !AMBIENT.some(e => e.id === entry.id) || !Number.isSafeInteger(entry.turn) || entry.turn < 0 || entry.turn > raw.tick || (index > 0 && entry.turn < raw.heard[index - 1].turn)) || new Set(raw.heard.map(e => e.id)).size !== raw.heard.length) throw new Error('Повреждена история фоновых разговоров.');
  if (!Array.isArray(raw.inspected) || raw.inspected.length > DETAILS.length || raw.inspected.some(id => !DETAILS.some(d => d.id === id)) || new Set(raw.inspected).size !== raw.inspected.length) throw new Error('Повреждены наблюдения.');
  return { tick: raw.tick, npcs, heard: raw.heard.map(e => ({ id: e.id, turn: e.turn })), inspected: [...raw.inspected] };
}

function atStop(npc, target) { return npc.x === target.x && npc.y === target.y; }
export function activityFor(id, state) {
  const npc = state.life.npcs[id];
  if (!npc) return '';
  const target = ROUTINES[id][npc.stop];
  if (atStop(npc, target)) return target.activity;
  return distance(npc, state.player) === 1 ? 'ждёт вашей реплики' : target.travel;
}

function vacant(p, state, id) {
  const occupant = entityAt(p.x, p.y, p.floor, state);
  return terrainWalkable(p.x, p.y, p.floor) && distance(p, state.player) !== 0 && (!occupant || occupant.id === id);
}
const offsets = [[0, -1], [-1, 0], [1, 0], [0, 1]];
function nextStep(npc, goal, state, id) {
  const queue = [{ ...npc, first: null }];
  const seen = new Set([`${npc.x},${npc.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (atStop(current, goal)) return current.first;
    for (const [dx, dy] of offsets) {
      const p = { floor: npc.floor, x: current.x + dx, y: current.y + dy };
      const key = `${p.x},${p.y}`;
      if (!seen.has(key) && vacant(p, state, id)) {
        seen.add(key);
        queue.push({ ...p, first: current.first ?? p });
      }
    }
  }
  return null;
}

// Walls and glazing occlude local speech. Furniture does not; radio replies are
// explicitly written as radio and are heard only near the transmitting person.
export function canHear(player, speaker) {
  if (distance(player, speaker) > 7) return false;
  let x = player.x, y = player.y;
  const dx = Math.abs(speaker.x - x), dy = -Math.abs(speaker.y - y);
  const sx = x < speaker.x ? 1 : -1, sy = y < speaker.y ? 1 : -1;
  let error = dx + dy;
  while (x !== speaker.x || y !== speaker.y) {
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
    if (['#', ':', '"', ' '].includes(floorAt(player.floor).map[y]?.[x])) return false;
  }
  return true;
}

export function advanceLife(state, { waiting = false } = {}) {
  const life = state.life;
  life.tick++;
  for (const [index, [id, route]] of Object.entries(ROUTINES).entries()) {
    const npc = life.npcs[id];
    // Approaching someone holds them in place for E; waiting explicitly lets
    // them continue or yield. Nobody runs off while the player reads a window.
    if (!waiting && distance(npc, state.player) <= 1 && floorAt(npc.floor).map[npc.y][npc.x] !== '+') continue;
    if (npc.wait > 0) { npc.wait--; continue; }
    if ((life.tick + index) % 2 !== 0) continue;
    if (atStop(npc, route[npc.stop])) npc.stop = (npc.stop + 1) % route.length;
    let next = nextStep(npc, route[npc.stop], state, id);
    if (!next && distance(npc, state.player) <= 2) {
      // Yield out of a doorway instead of trapping the player in a narrow room.
      next = offsets.map(([dx, dy]) => ({ floor: npc.floor, x: npc.x + dx, y: npc.y + dy }))
        .filter(p => vacant(p, state, id)).sort((a, b) => distance(b, state.player) - distance(a, state.player))[0];
    }
    if (next) { npc.x = next.x; npc.y = next.y; }
    if (atStop(npc, route[npc.stop])) npc.wait = route[npc.stop].dwell;
  }
  const last = life.heard.at(-1);
  if (last && life.tick - last.turn < (state.timeMode === 'realtime' ? REALTIME_AMBIENT_GAP : 14)) return null;
  const event = AMBIENT.find(event => !life.heard.some(e => e.id === event.id)
    && (!event.requires || state.flags[event.requires])
    && canHear(state.player, getEntity(event.speaker, state))
    && (!event.partner || canHear(getEntity(event.speaker, state), getEntity(event.partner, state))));
  if (event) life.heard.push({ id: event.id, turn: life.tick });
  return event ?? null;
}

export function recentAmbient(state) {
  const last = state.life.heard.at(-1);
  return last && state.life.tick - last.turn < 12 ? AMBIENT.find(e => e.id === last.id) : null;
}
export function nearbyActivities(state) {
  return entitiesFor(state).filter(e => e.type === 'person' && canHear(state.player, e))
    .sort((a, b) => distance(a, state.player) - distance(b, state.player));
}
