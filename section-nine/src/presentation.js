import { floorAt, entityAt, roomInfo, navigationTarget, getEntity } from './world.js';
import { objective } from './engine.js';
import { AMBIENT } from './life.js';
import { DETAILS } from './details.js';
import { CONVERSATIONS } from './conversations.js';
import { caseworkSummary, reportSummary } from './casework.js';
import { HYPOTHESES, APPROACHES } from './story.js';

export const PALETTE = {
  text: [198, 210, 211], dim: [103, 130, 137], faint: [49, 70, 81],
  teal: [112, 212, 191], orange: [238, 172, 109], purple: [190, 166, 245],
  blue: [113, 167, 203], white: [230, 238, 232], red: [230, 126, 126],
};
const ROOM_COLORS = {
  corridor: [12, 22, 29], core: [21, 28, 38], office: [25, 30, 35],
  operations: [13, 32, 37], lab: [15, 26, 40], armory: [32, 29, 25],
  service: [24, 27, 30], lounge: [29, 25, 37],
};
const structural = tile => ['#', ':', '"', '+'].includes(tile);
function wallGlyph(map, x, y) {
  const mask = (structural(map[y - 1]?.[x]) ? 1 : 0) | (structural(map[y]?.[x + 1]) ? 2 : 0)
    | (structural(map[y + 1]?.[x]) ? 4 : 0) | (structural(map[y]?.[x - 1]) ? 8 : 0);
  return ['▪', '╵', '╶', '└', '╷', '│', '┌', '├', '╴', '┘', '─', '┴', '┐', '┤', '┬', '┼'][mask];
}

export function cellAppearance(game, x, y, scale, route, floor = game.state.player.floor) {
  const plan = floorAt(floor);
  const tile = plan.map[y][x];
  if (tile === ' ') return { glyph: ' ', extension: ' ', fg: PALETTE.dim, bg: [9, 17, 23], bold: false };
  const e = entityAt(x, y, floor, game.state);
  const goal = objective(game.state);
  const localGoal = navigationTarget(game.state.player, goal.target, game.state);
  const player = game.state.player;
  const horizontal = structural(plan.map[y]?.[x - 1]) || structural(plan.map[y]?.[x + 1]);
  let glyph = ({ '#': wallGlyph(plan.map, x, y), '.': '·', '+': '╴', ':': horizontal ? '┄' : '┆', '"': horizontal ? '═' : '║', '=': '═', o: '○', '%': '▥', b: '□', p: '♣', u: '▤', '^': '≡' })[tile];
  let extension = ' ';
  if (scale === 2 && structural(plan.map[y]?.[x + 1])) {
    if (tile === '#') extension = '─';
    if (tile === '"') extension = '═';
    if (tile === ':') extension = '┄';
  }
  if (tile === '=' && scale === 2) extension = '═';
  let fg = tile === '#' ? [83, 108, 123] : tile === '.' ? [37, 53, 61] : tile === '"' || tile === ':' ? PALETTE.blue : PALETTE.dim;
  let bg = ROOM_COLORS[roomInfo({ x, y, floor }).kind];
  let bold = false;
  const label = plan.labels.find(label => label.y === y && x >= label.x && x < label.x + label.text.length);
  if (label && tile === '.') { glyph = label.text[x - label.x]; fg = [128, 149, 151]; }
  if (route.has(`${x},${y}`)) { glyph = '·'; fg = PALETTE.orange; }
  if (e) {
    const active = e.id === localGoal?.id || e.id === goal.target;
    glyph = e.glyph;
    fg = active ? PALETTE.orange : e.type === 'terminal' ? PALETTE.blue : e.type === 'scenery' ? (game.state.life.inspected.includes(e.id) ? PALETTE.dim : PALETTE.purple) : PALETTE.teal;
    bg = active ? [58, 43, 31] : [24, 47, 51];
    bold = true;
  }
  if (floor === player.floor && x === player.x && y === player.y) { glyph = '@'; fg = PALETTE.white; bg = [96, 67, 135]; bold = true; }
  return { glyph, extension, fg, bg, bold };
}

export function observationSections(state) {
  const sections = state.life.heard.map((item, index) => [`УСЛЫШАНО / ЗАПИСЬ ${index + 1}`, AMBIENT.find(e => e.id === item.id).lines.join('\n')]);
  for (const id of state.life.inspected) {
    const item = DETAILS.find(d => d.id === id);
    const people = CONVERSATIONS.filter(topic => topic.object === id).map(topic => getEntity(topic.person, state).name);
    sections.push([item.name.toUpperCase(), `${item.observation}\n\nМожно обсудить: ${people.join(', ')}. В разговоре выберите «О находках в штабе».`]);
  }
  if (!sections.length) sections.push(['ЗДЕСЬ ПОКА ТИХО', 'Пройдите рядом с сотрудниками или осмотрите предметы, отмеченные маленькими буквами. Разговоры и небольшие истории сохранятся здесь. Это личные наблюдения, отдельно от доказательств по делу.']);
  return sections;
}
export function journalSections(state) {
  const goal = objective(state);
  return [['ТЕКУЩАЯ ЗАДАЧА', `${goal.title}. ${goal.detail}`],
    ...(state.flags.military || state.flags.memory ? [['ПОВТОРНЫЕ ПРОВЕРКИ', caseworkSummary(state)]] : []),
    ...state.journal.map((entry, i) => [`${String(i + 1).padStart(2, '0')} / ${entry.title}`, entry.text]),
    ...(state.hypothesis ? [['РАБОЧАЯ ВЕРСИЯ', HYPOTHESES[state.hypothesis]]] : [])];
}
export function endingSections(state) {
  const approach = APPROACHES[state.approach];
  return [['У ПРИЗРАКОВ ЕСТЬ АДРЕС', approach.text], ['ВАША РАБОЧАЯ ВЕРСИЯ', HYPOTHESES[state.hypothesis]],
    ['ОСНОВАНИЕ И ОГОВОРКИ', reportSummary(state)], [`ПЛАН: ${approach.title.toUpperCase()}`, approach.radio],
    ['МОТОКО КУСАНАГИ', '«Если память можно подделать, что остаётся от свидетеля?»'],
    ['КОНЕЦ ПЕРВОЙ ГЛАВЫ', 'Вы собрали три улики, завершили две повторные проверки и согласовали выезд с оговорённой рабочей версией. Оба этажа штаба доступны для изучения; других локаций в этой версии нет. Можно вернуться в штаб, перечитать диалоги или начать новое прохождение.']];
}
