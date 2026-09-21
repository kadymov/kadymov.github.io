import { DETAILS } from './details.js';

export const WIDTH = 53;
export const HEIGHT = 29;
export const START = Object.freeze({ floor: 24, x: 20, y: 20 });
export const LANDINGS = Object.freeze({
  23: Object.freeze({ floor: 23, x: 25, y: 24 }),
  24: Object.freeze({ floor: 24, x: 25, y: 24 }),
});
export const STAIR_LANDINGS = Object.freeze({
  23: Object.freeze({ floor: 23, x: 32, y: 24 }),
  24: Object.freeze({ floor: 24, x: 32, y: 24 }),
});

// Authored plans, not generated levels. Both storeys share the building envelope,
// circulation spine, lift shaft, stairwell, wet service core and structural piers.
function shell() {
  const map = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(' '));
  const fill = (x1, y1, x2, y2, tile = '.') => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) map[y][x] = tile;
  };
  const at = (x, y, tile) => { map[y][x] = tile; };
  fill(0, 0, 52, 22, '#');
  fill(0, 22, 44, 28, '#'); // The southern facade steps back at the plant room.
  fill(20, 1, 21, 27); // Continuous north–south circulation spine.
  fill(1, 11, 51, 13); // Main corridor, with door recesses off both sides.
  fill(20, 20, 43, 21); // Shared lift lobby.
  fill(23, 23, 28, 27); // Lift cabin.
  fill(30, 23, 35, 27); // Protected staircase.
  fill(37, 23, 43, 27); // Washrooms on a shared plumbing stack.
  at(25, 22, '+'); at(32, 22, '+'); at(39, 22, '+');
  fill(30, 26, 34, 26, '^');
  fill(37, 24, 37, 25, 'u');
  fill(40, 25, 43, 25, '#'); at(41, 25, '+');
  at(41, 26, 'o'); at(43, 26, 'o');
  for (const [a, b] of [[2, 8], [13, 17], [25, 31], [40, 48]]) fill(a, 0, b, 0, '"');
  fill(0, 3, 0, 7, '"'); fill(52, 3, 52, 7, '"');
  fill(2, 28, 8, 28, '"'); fill(12, 28, 17, 28, '"');
  at(20, 3, '#'); // Structural pier; the second corridor lane remains open.
  return { map, fill, at };
}
const zone = (id, name, bounds, kind, description) => ({ id, name, bounds, kind, description });
const sharedRooms = [
  zone('lift', 'ЛИФТОВАЯ КАБИНА', [23, 23, 28, 27], 'core', 'Два служебных этажа. Отдельный допуск нужен только для выезда в гараж.'),
  zone('stairs', 'ПОЖАРНАЯ ЛЕСТНИЦА', [30, 23, 35, 27], 'core', 'Бетонный марш за противопожарной дверью связывает оба этажа.'),
  zone('washrooms', 'САНУЗЛЫ', [37, 23, 43, 27], 'service', 'Раковины, перегородки и тихий гул вытяжки.'),
  zone('lobby', 'ЛИФТОВОЙ ХОЛЛ', [20, 20, 43, 22], 'corridor', 'Лифт и защищённая лестница собраны в одном ядре здания.'),
  zone('corridor', 'ГЛАВНЫЙ КОРИДОР', [1, 10, 51, 14], 'corridor', 'Широкий проход соединяет западное и восточное крыло.'),
  zone('spine', 'ПРОДОЛЬНЫЙ КОРИДОР', [19, 1, 22, 27], 'corridor', 'Узкий служебный проход ведёт от кабинетов к лифтовому холлу.'),
];
const commonLabels = [
  { x: 23, y: 23, text: 'ЛИФТ' }, { x: 30, y: 23, text: 'МАРШ' },
  { x: 38, y: 23, text: 'WC' }, { x: 25, y: 20, text: 'ЛИФТОВОЙ ХОЛЛ' },
];

function commandFloor() {
  const { map, fill, at } = shell();
  fill(1, 1, 10, 9); // Chief's office opens into a reception, not the corridor.
  fill(12, 1, 18, 9); at(11, 5, '+'); at(19, 7, '+');
  fill(23, 1, 51, 9); at(43, 10, '+');
  fill(34, 1, 34, 6, ':'); fill(23, 6, 34, 6, ':'); at(29, 6, '+');
  at(22, 8, '+'); // Second entrance to operations from the longitudinal corridor.
  fill(1, 15, 9, 21); at(5, 14, '+'); // Investigation office.
  fill(1, 23, 9, 27); // Paper files accessed from the lounge.
  fill(11, 15, 18, 27); at(15, 14, '+'); at(10, 24, '+');
  fill(23, 15, 32, 18); at(27, 14, '+'); // Kitchen.
  fill(34, 15, 43, 18); at(39, 14, '+'); // Secure call booths.
  fill(45, 15, 51, 21); at(48, 14, '+'); // Ventilation plant on the setback.
  at(27, 19, '+'); at(39, 19, '+'); // Service rooms connect to the lift hall too.
  fill(4, 4, 7, 4, '='); at(5, 3, 'o');
  fill(1, 2, 1, 4, 'b'); at(9, 2, 'p'); at(3, 7, 'o'); at(7, 7, 'o');
  fill(13, 4, 15, 4, '='); at(14, 3, 'o'); at(17, 3, 'o'); at(17, 5, 'o'); at(13, 8, 'p');
  fill(27, 3, 30, 3, '='); at(27, 2, 'o'); at(30, 2, 'o'); at(27, 4, 'o');
  for (const x of [37, 43, 48]) { fill(x, 3, x + 2, 3, '='); at(x + 1, 4, 'o'); }
  fill(38, 7, 40, 7, '='); fill(47, 7, 49, 7, '='); at(48, 8, 'o'); at(50, 2, '%');
  fill(3, 17, 6, 17, '='); at(3, 18, 'o'); fill(1, 20, 3, 20, 'b');
  fill(2, 25, 7, 25, 'b');
  fill(12, 17, 12, 19, '='); at(15, 18, 'o'); at(17, 18, 'o');
  fill(13, 23, 15, 23, '='); at(17, 24, 'p');
  fill(24, 16, 24, 17, 'u'); fill(28, 17, 30, 17, '='); at(28, 16, 'o');
  fill(38, 15, 38, 17, ':'); at(38, 17, '+'); at(35, 16, '='); at(41, 16, '=');
  fill(46, 17, 46, 20, '%'); fill(50, 17, 50, 20, '%');
  return {
    number: 24, name: 'УПРАВЛЕНИЕ И ОПЕРАЦИИ', map: map.map(r => r.join('')),
    rooms: [
      zone('chief', 'КАБИНЕТ АРАМАКИ', [1, 1, 10, 9], 'office', 'Панорамное окно, низкий стол и бумажные папки. Вход через приёмную.'),
      zone('reception', 'ПРИЁМНАЯ', [12, 1, 18, 9], 'office', 'Стойка секретаря и два кресла. За внутренней дверью — кабинет шефа.'),
      zone('briefing', 'КОМНАТА БРИФИНГОВ', [23, 1, 34, 6], 'operations', 'Стеклянная переговорная внутри оперативного зала. В центре — тактический стол.'),
      zone('operations', 'ОПЕРАТИВНЫЙ ЗАЛ', [23, 1, 51, 9], 'operations', 'Островки рабочих мест и сетевые консоли. Через стекло видна комната брифингов.'),
      zone('investigation', 'СЛЕДСТВЕННАЯ КОМНАТА', [1, 15, 9, 21], 'office', 'На столе у стены разложены материалы осмотра и бумажные копии.'),
      zone('records', 'БУМАЖНЫЙ АРХИВ', [1, 23, 9, 27], 'service', 'На полках — дела, которым Арамаки не доверил единственную цифровую копию.'),
      zone('lounge', 'КОМНАТА ОТДЫХА', [11, 15, 18, 27], 'lounge', 'Диван, кофейный автомат и окно над ночным городом.'),
      zone('kitchen', 'КУХНЯ', [23, 15, 32, 18], 'service', 'Мойка и общий стол. Отсюда можно пройти в лифтовой холл.'),
      zone('calls', 'КАБИНЫ ЗАКРЫТОЙ СВЯЗИ', [34, 15, 43, 18], 'office', 'Две акустически изолированные кабины для закрытых переговоров.'),
      zone('plant', 'ВЕНТИЛЯЦИОННАЯ', [45, 15, 51, 21], 'service', 'Шумоглушители отделяют инженерное оборудование от рабочих кабинетов.'),
      ...sharedRooms,
    ],
    labels: [
      { x: 2, y: 1, text: 'АРАМАКИ' }, { x: 12, y: 1, text: 'ПРИЁМ.' },
      { x: 25, y: 1, text: 'БРИФИНГ' }, { x: 38, y: 1, text: 'ОПЕРАТИВНЫЙ' },
      { x: 2, y: 15, text: 'СЛЕДСТВ.' }, { x: 12, y: 15, text: 'ОТДЫХ' },
      { x: 2, y: 23, text: 'ДЕЛА' }, { x: 25, y: 15, text: 'КУХНЯ' },
      { x: 39, y: 15, text: 'СВЯЗЬ' }, { x: 46, y: 15, text: 'ВЕНТ.' }, ...commonLabels,
    ],
  };
}

function technicalFloor() {
  const { map, fill, at } = shell();
  fill(1, 1, 10, 9); fill(12, 1, 18, 9); at(11, 5, '+'); at(19, 7, '+');
  fill(23, 1, 40, 9); at(30, 10, '+');
  fill(23, 6, 40, 6, ':'); at(30, 6, '+');
  fill(26, 7, 26, 9, '#'); fill(34, 7, 34, 9, '#'); at(26, 8, '+'); at(34, 8, '+');
  fill(42, 1, 51, 9); at(46, 10, '+');
  fill(1, 15, 18, 27); at(7, 14, '+'); at(19, 19, '+');
  fill(13, 22, 13, 27, '#'); fill(13, 21, 18, 21, '#'); at(13, 24, '+');
  fill(23, 15, 32, 18); at(27, 14, '+'); at(27, 19, '+');
  fill(34, 15, 43, 18); at(39, 14, '+'); at(39, 19, '+');
  fill(45, 15, 51, 21); at(48, 14, '+');
  fill(2, 2, 2, 7, 'b'); fill(9, 2, 9, 7, 'b');
  fill(4, 4, 7, 4, '='); fill(14, 3, 17, 3, 'b'); fill(14, 7, 17, 7, '='); at(15, 6, 'o');
  fill(24, 2, 24, 4, 'u'); fill(27, 3, 29, 3, '='); fill(36, 3, 38, 3, '=');
  at(32, 2, '%'); at(39, 2, 'b'); at(24, 8, 'b'); at(37, 8, 'u'); at(29, 8, 'o');
  for (const x of [43, 46, 49]) { fill(x, 2, x, 3, '%'); fill(x, 7, x, 8, '%'); }
  fill(44, 5, 45, 5, '=');
  fill(2, 17, 2, 23, 'u'); fill(15, 16, 17, 16, 'b');
  fill(5, 18, 10, 18, '='); at(5, 19, '='); at(10, 19, '=');
  fill(5, 23, 10, 23, '='); at(5, 22, '='); at(10, 22, '=');
  fill(15, 25, 17, 25, 'b'); at(16, 23, '%');
  fill(24, 16, 25, 16, 'u'); fill(29, 17, 31, 17, '=');
  fill(35, 16, 35, 17, 'b'); fill(42, 16, 42, 17, 'b');
  fill(46, 17, 46, 20, '%'); fill(50, 17, 50, 20, '%');
  return {
    number: 23, name: 'ТЕХНИЧЕСКИЙ КОНТУР', map: map.map(r => r.join('')),
    rooms: [
      zone('armory', 'ОРУЖЕЙНАЯ', [1, 1, 10, 9], 'armory', 'Запираемые оружейные шкафы и стол разборки. Вход только через комнату выдачи.'),
      zone('equipment', 'КОМНАТА ВЫДАЧИ', [12, 1, 18, 9], 'armory', 'Бронежилеты, шкафчики и стойка проверки снаряжения.'),
      zone('airlock', 'ШЛЮЗ ЛАБОРАТОРИИ', [27, 7, 33, 9], 'lab', 'Две двери отделяют чистую лабораторию от общего коридора.'),
      zone('lab', 'ЛАБОРАТОРИЯ ПАМЯТИ', [23, 1, 40, 9], 'lab', 'Стеклянная перегородка, моечная и два диагностических стола.'),
      zone('servers', 'СЕРВЕРНАЯ / ВОЕННЫЙ АРХИВ', [42, 1, 51, 9], 'lab', 'Ряды стоек с проходами для обслуживания. Архивный терминал изолирован от внешней сети.'),
      zone('batteries', 'АККУМУЛЯТОРНАЯ', [14, 22, 18, 27], 'service', 'Зарядные блоки отделены от мастерской противопожарной перегородкой.'),
      zone('workshop', 'МАСТЕРСКАЯ ТАТИКОМ', [1, 15, 18, 27], 'armory', 'Сервисная платформа, инструментальные стенды и широкий проход для техники.'),
      zone('diagnostics', 'КИБЕРДИАГНОСТИКА', [23, 15, 32, 18], 'lab', 'Место осмотра повреждённых нейропротезов перед чистой лабораторией.'),
      zone('evidence', 'ХРАНИЛИЩЕ УЛИК', [34, 15, 43, 18], 'service', 'Опечатанные шкафы. Каждая передача регистрируется отдельно от цифровой копии.'),
      zone('plant', 'ЭЛЕКТРОЩИТОВАЯ', [45, 15, 51, 21], 'service', 'Резервное питание лаборатории и стойки охлаждения.'),
      ...sharedRooms,
    ],
    labels: [
      { x: 2, y: 1, text: 'ОРУЖИЕ' }, { x: 12, y: 1, text: 'ВЫДАЧА' },
      { x: 26, y: 1, text: 'ЛАБОРАТОРИЯ' }, { x: 43, y: 1, text: 'АРХИВ' },
      { x: 28, y: 7, text: 'ШЛЮЗ' }, { x: 3, y: 15, text: 'МАСТЕРСКАЯ' },
      { x: 14, y: 22, text: 'АККУМ' }, { x: 24, y: 15, text: 'ОСМОТР' },
      { x: 36, y: 15, text: 'УЛИКИ' }, { x: 46, y: 15, text: 'ЩИТОВ' }, ...commonLabels,
    ],
  };
}

export const FLOORS = Object.freeze({ 23: technicalFloor(), 24: commandFloor() });
export function floorAt(number) { return FLOORS[number]; }

export const ENTITIES = [
  { id: 'aramaki', floor: 24, x: 6, y: 5, glyph: 'A', name: 'Дайсукэ Арамаки', role: 'Начальник 9-го отдела', type: 'person' },
  { id: 'ishikawa', floor: 24, x: 43, y: 5, glyph: 'I', name: 'Исикава', role: 'Сетевая разведка', type: 'person' },
  { id: 'togusa', floor: 24, x: 5, y: 18, glyph: 'T', name: 'Тогуса', role: 'Следователь', type: 'person' },
  { id: 'table', floor: 24, x: 29, y: 4, glyph: 'D', name: 'Тактический стол', role: 'Корреляция материалов дела', type: 'terminal' },
  { id: 'batou', floor: 23, x: 6, y: 5, glyph: 'B', name: 'Бато', role: 'Оперативник / бывший рейнджер', type: 'person' },
  { id: 'tachikoma', floor: 23, x: 8, y: 21, glyph: 'K', name: 'Татикома', role: 'Автономная боевая платформа', type: 'person' },
  { id: 'forensics', floor: 23, x: 32, y: 3, glyph: 'F', name: 'Лабораторный терминал', role: 'Копия кибермозга / только чтение', type: 'terminal' },
  { id: 'archive', floor: 23, x: 47, y: 5, glyph: 'R', name: 'Военный архив', role: 'Реестр Министерства обороны', type: 'terminal' },
  ...[23, 24].flatMap(floor => [
    { id: `lift-${floor}`, story: 'elevator', floor, x: 25, y: 25, glyph: 'L', name: 'Служебный лифт', role: 'Этажи 23 / 24 · выезд по допуску', type: 'lift' },
    { id: `stairs-${floor}`, story: 'stairs', floor, x: 32, y: 25, glyph: 'S', name: 'Пожарная лестница', role: 'Защищённая лестничная клетка', type: 'stairs' },
  ]),
  { id: 'duty', floor: 24, x: 16, y: 5, glyph: 'N', name: 'Дежурная Накамура', role: 'Дежурная по штабу', type: 'person' },
  { id: 'mechanic', floor: 23, x: 12, y: 18, glyph: 'M', name: 'Техник Мидзуно', role: 'Сервис кибернетики', type: 'person' },
  ...DETAILS.map(({ id, floor, x, y, glyph, name, role }) => ({ id, floor, x, y, glyph, name, role, type: 'scenery' })),
];

function positionOf(entity, state) { return state?.life?.npcs?.[entity.id] ?? entity; }
export function getEntity(id, state) {
  const entity = ENTITIES.find(e => e.id === id);
  return entity ? { ...entity, ...positionOf(entity, state) } : null;
}
export function entitiesFor(state) { return ENTITIES.map(e => getEntity(e.id, state)); }
export function entityAt(x, y, floor, state) {
  const entity = ENTITIES.find(entity => {
    const position = positionOf(entity, state);
    return position.floor === floor && position.x === x && position.y === y;
  });
  return entity ? getEntity(entity.id, state) : undefined;
}
export function terrainWalkable(x, y, floor) { return ['.', '+'].includes(floorAt(floor)?.map[y]?.[x]); }
export function walkable(x, y, floor, state) { return terrainWalkable(x, y, floor) && !entityAt(x, y, floor, state); }
export function distance(a, b) { return a.floor === b.floor ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity; }
export function adjacent(player, state) { return entitiesFor(state).filter(entity => distance(player, entity) === 1); }
export function roomInfo({ x, y, floor }) {
  return floorAt(floor)?.rooms.find(({ bounds: [left, top, right, bottom] }) => x >= left && x <= right && y >= top && y <= bottom)
    ?? { name: 'ПРОХОД', kind: 'corridor', description: 'Проход между помещениями штаба.' };
}
export function roomAt(position) { return roomInfo(position).name; }
export function navigationTarget(start, targetId, state) {
  const target = getEntity(targetId, state);
  if (!target) return null;
  return target.floor === start.floor ? target : ENTITIES.find(e => e.id === `lift-${start.floor}`);
}

// A route ends beside the next interaction. For another floor, it ends at the
// current lift; changing floors is always an explicit player choice.
export function findPath(start, targetId, state) {
  const target = navigationTarget(start, targetId, state);
  if (!target) return [];
  const queue = [{ ...start, path: [] }];
  const visited = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (distance(current, target) === 1) return current.path;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const next = { floor: start.floor, x: current.x + dx, y: current.y + dy };
      const key = `${next.x},${next.y}`;
      if (walkable(next.x, next.y, next.floor, state) && !visited.has(key)) {
        visited.add(key);
        queue.push({ ...next, path: [...current.path, next] });
      }
    }
  }
  return [];
}
