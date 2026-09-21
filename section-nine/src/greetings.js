import { ENTITIES, FLOORS, roomInfo } from './world.js';
import { CONVERSATIONS } from './conversations.js';

const PEOPLE = ENTITIES.filter(entity => entity.type === 'person').map(entity => entity.id);
const PLACES = Object.values(FLOORS).flatMap(floor => floor.rooms.map(room => `${floor.number}:${room.id}`));
// Corridors and service cores do not displace the meaningful visit that led here.
const PASSAGES = new Set(['corridor', 'spine', 'lobby', 'lift', 'stairs', 'reception', 'airlock', 'equipment', 'outside']);
const rule = (id, person, kind, source, text, when = () => true) => ({ id, person, kind, source, text, when });
export const GREETINGS = [
  ...CONVERSATIONS.map(topic => rule(`observation-${topic.person}-${topic.object}`, topic.person, 'observation', topic.object, topic.greeting, s => s.life.inspected.includes(topic.object))),
  rule('duty-chief-approved', 'duty', 'talk', 'aramaki', 'Уже согласовали выезд? Шеф передал распоряжение подготовить гараж. Я пока придержу входящие — пусть у вас будет несколько спокойных минут.', s => Boolean(s.approach)),
  rule('duty-chief-briefed', 'duty', 'talk', 'aramaki', 'Уже от шефа? Судя по вашему лицу, утро отменяется. Если понадобится тихая переговорная, скажите — придержу одну для группы.', s => s.flags.briefed && !s.approach),
  rule('duty-chief-visit', 'duty', 'talk', 'aramaki', 'Уже закончили с шефом? Он сегодня даже чай не заметил. Если придётся вернуться, я пока никого к нему не направляю.', s => !s.flags.briefed),
  rule('duty-chief-room', 'duty', 'visit', '24:chief', 'Заглядывали в кабинет? Шеф бывает у окна — от двери его не всегда видно. Можете пройти ещё раз, посетителей пока нет.', s => !s.flags.briefed),
  rule('duty-lab', 'duty', 'visit', '23:lab', 'Из лаборатории? После этого белого света здесь, наверное, совсем темно. Могу приглушить экран на стойке, пока говорим.'),
  rule('duty-batou', 'duty', 'talk', 'batou', 'От Бато? Если снова просил провести что-нибудь как «расходники», пусть сначала заполнит графу назначения. В прошлый раз там было написано «надо».'),
  rule('duty-togusa', 'duty', 'talk', 'togusa', 'Тогуса уже передал вам материалы? Он просил не смешивать копии осмотра с остальными бумагами. Я оставила для них отдельный лоток.', s => s.flags.testimony),
  rule('duty-return', 'duty', 'floor', '24', 'Снова наверху, майор. На техническом этаже всё ещё гудит вентиляция? Я уже перестала понимать, слышу её или просто помню.'),
  rule('batou-chief', 'batou', 'talk', 'aramaki', 'От шефа? По делу он обычно говорит мало, а думать после этого приходится долго. С чего начнём?', s => s.flags.briefed),
  rule('batou-archive', 'batou', 'visit', '23:servers', 'Из серверной? Сними с документов печати глазами и посмотри, что останется. Если есть странность в карточке — покажи, разберём.', s => s.flags.batouAccess),
  rule('batou-togusa', 'batou', 'talk', 'togusa', 'Тогуса уже заставил тебя сверять каждую минуту? Правильно. Я могу помнить человека лучше, чем время. Он обычно замечает разницу.'),
  rule('batou-tachikoma', 'batou', 'talk', 'tachikoma', 'Татикома тебя тоже остановила с вопросом? Если разговор был про масло, разрешения на вторую порцию я не давал. Если про память — тут я бы её выслушал.'),
  rule('togusa-lab', 'togusa', 'visit', '23:lab', 'Вернулась из лаборатории? Давай сравним результат с осмотром. Мне важно, что подтвердилось независимо от самой записи.', s => s.flags.testimony),
  rule('togusa-batou', 'togusa', 'talk', 'batou', 'Поговорила с Бато? Его воспоминания о Судо нам пригодятся. Я только буду помечать отдельно, где личный опыт, а где сведения из дела.', s => s.flags.briefed),
  rule('togusa-records', 'togusa', 'visit', '24:records', 'Была среди старых дел? Там на полке стоит бумажный журавлик. Если он упал, поставь обратно. У него здесь своя работа.'),
  rule('ishikawa-chief', 'ishikawa', 'talk', 'aramaki', 'Шеф закончил вводную? Я оставил трассировку открытой. Можем пройти по ней вместе, пока никто не решил «почистить» ещё один узел.', s => s.flags.briefed),
  rule('ishikawa-archive', 'ishikawa', 'visit', '23:servers', 'Вернулась из серверной? Хорошо, что военный архив пока работает отдельно от сети. Иногда самый полезный кабель — отключённый.'),
  rule('ishikawa-togusa', 'ishikawa', 'talk', 'togusa', 'Тогуса наверняка напомнил тебе про независимый источник. Я тоже напомню: адрес пакета и адрес человека могут оказаться разными.', s => s.flags.trace),
  rule('aramaki-batou', 'aramaki', 'talk', 'batou', 'Успели поговорить с Бато? Он знает эту войну изнутри. Выслушайте его, но оставьте место и для того, чего он не мог видеть.', s => s.flags.briefed),
  rule('aramaki-togusa', 'aramaki', 'talk', 'togusa', 'От Тогусы? Хорошо. Иногда к делу полезно приложить человека, который не торопится соглашаться с первой убедительной версией.', s => s.flags.briefed),
  rule('aramaki-lab', 'aramaki', 'visit', '23:lab', 'После лаборатории обычно появляется больше вопросов. Надеюсь, теперь они точнее. Я слушаю.', s => s.flags.briefed),
  rule('tachikoma-batou', 'tachikoma', 'talk', 'batou', 'Вы только что говорили с Бато? Он про меня ничего не спрашивал? Не передавайте ему этот вопрос. И этот тоже!'),
  rule('tachikoma-lab', 'tachikoma', 'visit', '23:lab', 'Майор, вы были в лаборатории памяти? А когда там находят чужое воспоминание, ему выдают отдельную бирку? Чтобы оно знало, кому теперь принадлежит.'),
  rule('tachikoma-mechanic', 'tachikoma', 'talk', 'mechanic', 'Мидзуно что-нибудь сказал о моём приводе? Он называет это техническим шумом. Но ведь у каждого из нас технический шум разный!'),
  rule('mechanic-tachikoma', 'mechanic', 'talk', 'tachikoma', 'Она уже изложила вам свою теорию личности? Я дошёл до третьего пункта, потом пришлось попросить её не двигаться, пока держу подшипник.'),
  rule('mechanic-batou', 'mechanic', 'talk', 'batou', 'От Бато? Передайте при случае: затвор я посмотрю, когда он принесёт его на стенд. Фраза «на слух нормально» не заменяет проверку.'),
  rule('mechanic-diagnostics', 'mechanic', 'visit', '23:diagnostics', 'Заглядывали в кибердиагностику? Разобранную кисть пока оставьте там. Человек просил вернуть прежнюю чувствительность, а это дольше, чем заменить привод.'),
  rule('duty-ready', 'duty', null, null, 'Распоряжение на выезд получено, майор. Если нужно что-то передать группе через приёмную — сейчас самое время.', s => Boolean(s.approach)),
  rule('duty-on-case', 'duty', null, null, 'Вводную уже получили? Тогда посетителей направлю в обход группы. Если кто-то начнёт искать вас через приёмную, сначала свяжусь по внутреннему каналу.', s => s.flags.briefed && !s.approach),
];
const EVERYDAY = {
  duty: ['Если вам нужен кто-то из группы, проверю по внутренней связи. Люди сегодня перемещаются быстрее, чем обновляется указатель.', 'В приёмной пока тихо. Я пользуюсь моментом, чтобы закрыть вчерашние пропуска. Утро всегда почему-то начинается со вчера.', 'Кофе на кухне свежий. На стойке мой — его лучше не трогать, он здесь почти с начала смены.'],
  mechanic: ['Сейчас закончу со стендом и освобожу проход. В этой мастерской свободное место всегда существует только в планах.', 'Если услышите три коротких сигнала — это проверка привода. Если четыре — значит, Татикома опять решила помочь с проверкой.'],
  batou: ['Снова ты, майор. Давай, я слушаю.', 'Что ещё проверяем? Снаряжение подождёт пару минут.'],
  togusa: ['Да, майор. Протокол рядом — можем свериться.', 'Есть ещё вопрос? Я пока никуда не убираю материалы.'],
  ishikawa: ['Канал открыт, майор. На чём остановились?', 'Я здесь. Только дай пометить текущую строку.'],
  aramaki: ['Вернулись, майор. Я слушаю.', 'Продолжим. Какие вопросы остались?'],
  tachikoma: ['Майор, вы снова здесь! У меня как раз появился ещё один вопрос.', 'Можно я немного отвлекусь от диагностики? Разговор ведь тоже проверка связи.'],
};

export const freshHistory = () => ({ recent: [], greeted: {}, used: [] });
export function validateHistory(raw = freshHistory()) {
  if (!raw || !Array.isArray(raw.recent) || raw.recent.length > 8 || !raw.greeted || typeof raw.greeted !== 'object' || Array.isArray(raw.greeted) || !Array.isArray(raw.used) || raw.used.length > GREETINGS.length) throw new Error('Повреждена история встреч.');
  for (const event of raw.recent) {
    const allowed = event?.kind === 'talk' ? PEOPLE : event?.kind === 'visit' ? PLACES : event?.kind === 'floor' ? ['23', '24'] : [];
    if (!allowed.includes(event?.id)) throw new Error('Неизвестная встреча или помещение.');
  }
  if (Object.entries(raw.greeted).some(([id, count]) => !PEOPLE.includes(id) || !Number.isSafeInteger(count) || count < 1)) throw new Error('Неверное число встреч.');
  if (new Set(raw.used).size !== raw.used.length || raw.used.some(id => !GREETINGS.some(rule => rule.id === id))) throw new Error('Неизвестное приветствие.');
  return { recent: raw.recent.map(({ kind, id }) => ({ kind, id })), greeted: { ...raw.greeted }, used: [...raw.used] };
}
export function rememberContext(state, kind, id) {
  const recent = state.history.recent;
  if (recent.at(-1)?.kind === kind && recent.at(-1)?.id === id) return;
  recent.push({ kind, id });
  if (recent.length > 8) recent.shift();
}
export function rememberPlace(state) {
  const room = roomInfo(state.player);
  if (!PASSAGES.has(room.id) && PLACES.includes(`${state.player.floor}:${room.id}`)) rememberContext(state, 'visit', `${state.player.floor}:${room.id}`);
}
// Choose once when a conversation starts. Rendering and scrolling are read-only.
export function takeGreeting(state, person) {
  if (!PEOPLE.includes(person)) return null;
  const history = state.history;
  const lastTalk = history.recent.findLast(event => event.kind === 'talk');
  const eligible = GREETINGS.filter(rule => rule.person === person && !history.used.includes(rule.id) && rule.when(state));
  let selected;
  // A newly inspected object takes precedence; older finds remain available later.
  for (const object of [...state.life.inspected].reverse()) {
    selected = eligible.find(rule => rule.kind === 'observation' && rule.source === object);
    if (selected) break;
  }
  for (const kind of ['context', 'floor']) {
    if (selected) break;
    for (const event of [...history.recent].reverse()) {
      if ((kind === 'floor') !== (event.kind === 'floor')) continue;
      if (event.kind === 'talk' && event !== lastTalk) continue;
      selected = eligible.find(rule => rule.kind === event.kind && rule.source === event.id);
      if (selected) break;
    }
    if (selected) break;
  }
  selected ??= eligible.find(rule => rule.kind === null);
  const visits = history.greeted[person] ?? 0;
  history.greeted[person] = visits + 1;
  // A contextual chief greeting supersedes the generic post-briefing fallback.
  if (person === 'duty' && state.flags.briefed && !history.used.includes('duty-on-case')) history.used.push('duty-on-case');
  if (person === 'duty' && selected?.id === 'duty-chief-approved' && !history.used.includes('duty-ready')) history.used.push('duty-ready');
  if (selected && !history.used.includes(selected.id)) history.used.push(selected.id);
  const text = selected?.text ?? (visits ? EVERYDAY[person][(visits - 1) % EVERYDAY[person].length] : null);
  rememberContext(state, 'talk', person);
  return text ? { text, replace: ['duty', 'mechanic'].includes(person) } : null;
}
