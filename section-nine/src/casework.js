export const HYPOTHESES = {
  survivor: 'Судо жив; его военный ключ используют как приманку.',
  stolen: 'Носитель ключа Судо попал к другому; обвинение сконструировано.',
  witness: 'Судо — возможный свидетель; сначала проверяем угрозу отправителю.',
};

export const CHECKS = {
  custody: {
    title: 'Цепочка передачи нейроблока', clue: 'military', contact: 'batou', target: 'archive', floor: 23,
    action: 'Запросить цепочку передачи нейроблока.',
    lead: 'Бато разворачивает карточку. «Мы смотрели акт списания. Нужна транспортная ведомость: её составляли другие люди. В архиве есть отдельный индекс по номеру контейнера. Я открыл тебе этот раздел».\n\nАрхив R, 23-й этаж: запросить цепочку передачи HB-4417 и сравнить время приёмки с актом смерти.',
    source: 'ТРАНСПОРТНАЯ ВЕДОМОСТЬ / КОНТЕЙНЕР К-17\n\n06:12 — подписан акт смерти Судо; в нём указан HB-4410.\n06:20 — в контейнер К-17 помещён HB-4417. Диагностический статус: нейроблок жизнеспособен.\n06:46 — К-17 принят узлом медицинской эвакуации МЭ-3. Контрольная пломба совпадает.\n\nОтметки отправителя и получателя заверены разными ключами. Это не копии акта Нарусэ.',
    result: 'После подписания акта смерти нейроблок Судо передали живым. Подмена в реестре скрыла эвакуацию, а не подтверждённую утилизацию.\n\nЗапись заканчивается на МЭ-3. Между этой передачей и сегодняшним убийством — четыре года. Кто сохранил нейроблок и кто получил доступ к его ключу позднее, неизвестно.',
    note: 'HB-4417 принят живым в МЭ-3 после оформления смерти Судо. Независимые отметки подтверждают, что он пережил эвакуацию; его нынешняя судьба и владелец ключа не установлены.',
    followup: 'Бато смотрит на время приёмки. «Значит, он выбрался с той эвакуации. Это больше, чем моя память о нём. Но четыре года между МЭ-3 и портом нам ещё предстоит восстановить».',
  },
  reflection: {
    title: 'Происхождение отражения', clue: 'memory', contact: 'togusa', target: 'forensics', floor: 23,
    action: 'Выделить источник отражения.',
    lead: 'Тогуса возвращает стоп-кадр. «Не увеличивай рукав ещё раз. Отдели периферийный слой и сравни его со служебным кэшем в той же копии. При первичном осмотре мы сравнивали время, а не источник каждого фрагмента».\n\nЛаборатория F, 23-й этаж: выделить источник отражения. Тогуса приложил параметры сравнения.',
    source: 'ПЕРИФЕРИЙНЫЙ СЛОЙ / СРАВНЕНИЕ С КЭШЕМ\n\nОтражение белого рукава совпадает с фрагментом сервисной калибровки, записанной за двое суток до убийства. Совпадают шум сенсора и последовательность бликов.\n\nВ 04:01 старый фрагмент включён в новый образ с плащом и пистолетом. Оригинал калибровки находился в сервисном разделе памяти Нарусэ.',
    result: 'Белый рукав принадлежит старой записи. По нему нельзя опознать человека, находившегося рядом с Нарусэ во время смерти.\n\nСоздатель подмены имел доступ к сервисным материалам жертвы — напрямую или через копию. Это сужает направление поиска. Но доступ к материалам и физический доступ к смертельному разъёму по-прежнему нужно устанавливать отдельно.',
    note: 'Отражение взято из калибровки за двое суток до убийства. Создатель подмены имел доступ к сервисным материалам Нарусэ; белый рукав не опознаёт убийцу.',
    followup: 'Тогуса откладывает изображение. «Теперь рукав исключён из опознания. Зато у нас появился вопрос о доступе к сервисной памяти. Вот зачем стоило вернуться: та же картинка указывает уже на другой круг действий».',
  },
};

const NAMES = { batou: 'Бато', togusa: 'Тогуса', aramaki: 'Арамаки' };
const CHALLENGES = {
  batou: {
    survivor: 'Я хочу верить, что Судо жив. Но если приму твою версию только потому, что помню его на эвакуации, подведу и его, и тебя. Покажи, где заканчивается надежда и начинается след.',
    stolen: 'Ключ можно извлечь из нейроблока или воспроизвести с записи. Но «можно» не значит «так и сделали». На чём держится твоя версия о чужом носителе?',
    witness: 'Я бы выслушал его. Только Судо умел вытаскивать людей из-под огня — это ещё не значит, что теперь он просит вытащить себя. Почему связываешь просьбу именно с ним?',
  },
  togusa: {
    survivor: 'Документ о смерти ненадёжен. Согласен. Какой факт позволяет перейти от этого к живому человеку сегодня? Если такого факта нет, давай оставим переход предположением.',
    stolen: 'Подмена обвинения установлена. Кража ключа — отдельное утверждение. Какой материал поддерживает его, а какой просто показывает, что нам лгут?',
    witness: 'Тогда нужно отделить заботу о возможном свидетеле от доверия к его рассказу. Что у нас есть кроме просьбы? И что ты готова признать неизвестным?',
  },
  aramaki: {
    survivor: 'Версия о живом Судо определяет, кого мы будем искать. Мне нужно основание для поиска и граница этого основания. На какой материал вы опираетесь?',
    stolen: 'Вы предполагаете другого владельца носителя. Это объяснение должно выдержать встречу и с живым Судо, и с человеком, который никогда его не видел. Приведите аргумент.',
    witness: 'Проверка угрозы человеку — достаточная причина действовать. Но в докладе должны быть раздельно записаны личность отправителя и основания для защиты. Чем вы поддерживаете версию?',
  },
};
const ARGUMENTS = {
  military: 'Чужой номер в акте смерти', memory: 'Образ загружен до убийства', trace: 'Подпись и просьба из порта',
  custody: 'Живая передача HB-4417', reflection: 'Отражение из старой калибровки',
};
// "Useful" supports a direction of investigation, never proves the whole theory.
const ARGUMENT_REPLIES = {
  survivor: {
    military: [false, 'Чужой номер разрушает подтверждение смерти. Он не говорит, что произошло с Судо после подмены. Этого недостаточно для вывода о живом человеке сегодня. Нужна цепочка передачи нейроблока.'],
    memory: [false, 'Подложный образ показывает подготовку обвинения. Лицо можно взять из старой записи. Судо не обязан быть живым, чтобы кто-то воспользовался его изображением.'],
    trace: [false, 'Подпись воспроизведена, автор живого пакета не установлен. Сигнал ведёт к источнику, но ещё не связывает источник с сознанием Судо.'],
    custody: [true, 'Отметка приёмки подтверждает, что Судо пережил эвакуацию. Теперь поиск его дальнейшего пути имеет независимое основание. Оговорка остаётся: это состояние четырёхлетней давности, а не свидетельство его жизни сегодня.'],
    reflection: [false, 'Старый фрагмент объясняет монтаж. Он ничего не сообщает о нынешнем состоянии Судо. Доступ к сервисной памяти Нарусэ — другой след.'],
  },
  stolen: {
    military: [false, 'Ошибочный акт скрывает судьбу нейроблока, но не устанавливает смену владельца ключа. Между этими утверждениями не хватает передачи носителя.'],
    memory: [true, 'Составной образ поддерживает версию сконструированного обвинения. Искать другого участника разумно. Но кража носителя пока остаётся возможным способом, а не установленным событием.'],
    trace: [true, 'Повтор рукопожатия показывает использование готовой записи. Это позволяет искать того, у кого оказался ключ или записанный обмен. Участие самого Судо всё ещё не исключено.'],
    custody: [false, 'Мы проследили нейроблок только до МЭ-3. Приёмка не равна краже, а дальнейшая передача нам неизвестна. Надо искать продолжение цепочки, а не дописывать его.'],
    reflection: [true, 'Доступ к старой калибровке связывает монтаж с сервисными материалами Нарусэ. У версии о подготовленном обвинении появился конкретный след. Владельца военного ключа это пока не называет.'],
  },
  witness: {
    military: [false, 'Подмена реестра даёт повод искать участников эвакуации. Она не показывает, что автор просьбы — один из них или что он видел убийство.'],
    memory: [false, 'Недостоверное опознание снимает один довод против Судо. Само по себе оно не превращает его в свидетеля. Для этого нужны сведения, которыми он располагает.'],
    trace: [true, 'Просьба даёт основание проверить угрозу и предложить безопасный разговор. Этого достаточно для выбранного направления. Личность автора и содержание его возможных показаний остаются открытыми.'],
    custody: [true, 'Судо пережил эвакуацию и мог знать, как её скрыли. Это основание искать его как возможного носителя сведений. Оно ещё не связывает его с сегодняшним сообщением.'],
    reflection: [false, 'Источник рукава показывает, как собрали подмену. Он не подтверждает, что отправитель знает обстоятельства дела. Его рассказ придётся проверять независимо.'],
  },
};
const VOICE = {
  batou: { useful: 'Бато кивает и убирает оружие со стола.', weak: 'Бато качает головой. «Подожди, майор».', uncertain: '«Хорошо. Так и скажи: ищем человека, а не подтверждение нашей догадки. Я прикрою».', },
  togusa: { useful: 'Тогуса подчёркивает строку в протоколе.', weak: 'Тогуса поворачивает протокол к вам. «Здесь есть пропущенный шаг».', uncertain: '«Запишу границу прямо в протоколе. Тогда следующий факт сможет изменить версию, а не будет обязан ей соответствовать».', },
  aramaki: { useful: 'Арамаки сверяет аргумент с материалами.', weak: 'Арамаки оставляет папку открытой. «Эту связь вы пока предполагаете».', uncertain: '«Принимаю как направление проверки с явно указанной неопределённостью. Для выезда не требуется угадать виновного. Требуется понимать, что именно проверяем».', },
};

export const freshCasework = () => ({ unlocked: [], results: [], debates: [] });
const option = (label, next, effect) => ({ label, next, effect });
const node = (text, options) => ({ text, options });
function log(state, title, text) {
  if (!state.journal.some(entry => entry.title === title && entry.text === text)) state.journal.push({ title, text });
}
export function unlockCheck(state, key) {
  const check = CHECKS[key];
  if (!check || !state.flags[check.clue] || state.casework.unlocked.includes(key)) return;
  state.casework.unlocked.push(key);
  log(state, `Проверить: ${check.title}`, check.lead);
}
export function selectHypothesis(state, key) {
  if (state.approach || !Object.hasOwn(HYPOTHESES, key) || !['military', 'memory', 'trace'].every(id => state.flags[id])) return;
  if (state.hypothesis !== key) {
    log(state, 'Рабочая версия', HYPOTHESES[key]);
    state.hypothesis = key;
    // A changed thesis needs a new final review, even when returning to an old one.
    state.casework.debates = state.casework.debates.filter(entry => entry.contact !== 'aramaki');
  }
}
function argumentAvailable(state, key) {
  return Object.hasOwn(ARGUMENTS, key) && (Object.hasOwn(CHECKS, key) ? state.casework.results.includes(key) : state.flags[key]);
}
export function usefulArgument(hypothesis, key) { return ARGUMENT_REPLIES[hypothesis]?.[key]?.[0] === true; }
function recordDebate(state, contact, argument) {
  if (state.approach) return;
  const entry = { contact, hypothesis: state.hypothesis, argument, checks: [...state.casework.results] };
  const index = state.casework.debates.findIndex(old => old.contact === contact && old.hypothesis === state.hypothesis);
  if (index < 0) state.casework.debates.push(entry); else state.casework.debates[index] = entry;
  const detail = argument === null ? 'Мотоко признала, что версия остаётся предположением. Личность отправителя, судьба Судо сегодня и убийца Нарусэ не установлены.' : `${ARGUMENTS[argument]}. ${ARGUMENT_REPLIES[state.hypothesis][argument][1]}`;
  log(state, `Обсуждение версии / ${NAMES[contact]}`, `${HYPOTHESES[state.hypothesis]}\n\n${detail}\n\nНа момент разговора: ${state.casework.results.map(key => CHECKS[key].title).join('; ') || 'повторные проверки не завершены'}.`);
}
export function canApprove(state) {
  const review = state.casework.debates.find(entry => entry.contact === 'aramaki' && entry.hypothesis === state.hypothesis);
  return Boolean(state.hypothesis && Object.keys(CHECKS).every(key => state.casework.results.includes(key) && review?.checks.includes(key)) && (review.argument === null || usefulArgument(state.hypothesis, review.argument)));
}
export function caseworkSummary(state) {
  return Object.entries(CHECKS).map(([key, check]) => {
    if (!state.flags[check.clue]) return `[нужна улика] ${check.title}: сначала ${check.clue === 'military' ? 'изучите акт в архиве' : 'проверьте исходную память в лаборатории'}.`;
    if (state.casework.results.includes(key)) return `[готово] ${check.title}: ${check.note}`;
    if (state.casework.unlocked.includes(key)) return `[проверить] ${check.title}: ${check.target === 'archive' ? 'архив R' : 'лаборатория F'}, 23 этаж.`;
    return `[обсудить] ${check.title}: ${NAMES[check.contact]}, задать вопрос при предъявлении улики или обсуждении версии.`;
  }).join('\n\n');
}

export function reportSummary(state) {
  const review = state.casework.debates.find(entry => entry.contact === 'aramaki' && entry.hypothesis === state.hypothesis);
  return review?.argument ? `Основание доклада: ${ARGUMENTS[review.argument]}. ${ARGUMENT_REPLIES[state.hypothesis][review.argument][1]}` : 'Версия принята как направление проверки с явной оговоркой: личность отправителя, нынешняя судьба Судо и убийца не установлены.';
}

export function validateCasework(raw, flags) {
  const keys = Object.keys(CHECKS);
  const list = (value, allowed) => Array.isArray(value) && value.length <= allowed.length && value.every(key => allowed.includes(key)) && new Set(value).size === value.length;
  if (!raw || !list(raw.unlocked, keys) || !list(raw.results, raw.unlocked) || raw.unlocked.some(key => !flags[CHECKS[key].clue])) throw new Error('Повреждены повторные проверки.');
  if (!Array.isArray(raw.debates) || raw.debates.length > 9 || new Set(raw.debates.map(entry => `${entry?.contact}:${entry?.hypothesis}`)).size !== raw.debates.length) throw new Error('Повреждены обсуждения версии.');
  for (const entry of raw.debates) {
    if (!entry || !Object.hasOwn(NAMES, entry.contact) || !Object.hasOwn(HYPOTHESES, entry.hypothesis) || !['military', 'memory', 'trace'].every(key => flags[key]) || !list(entry.checks, raw.results)) throw new Error('Неверный доклад.');
    if (entry.argument !== null && (!argumentAvailable({ flags, casework: raw }, entry.argument) || (Object.hasOwn(CHECKS, entry.argument) && !entry.checks.includes(entry.argument)))) throw new Error('Аргумент недоступен.');
  }
  return { unlocked: [...raw.unlocked], results: [...raw.results], debates: raw.debates.map(entry => ({ contact: entry.contact, hypothesis: entry.hypothesis, argument: entry.argument, checks: [...entry.checks] })) };
}

export function checkNode(terminal, key, state) {
  const match = /^check:(custody|reflection):(source|result|saved)$/.exec(key);
  if (!match) return null;
  const [, id, phase] = match;
  const check = CHECKS[id];
  if (check.target !== terminal || !state.casework.unlocked.includes(id)) return null;
  const back = option('Вернуться к материалам.', 'intro');
  if (phase === 'source') return node(check.source, [option(id === 'custody' ? 'Сопоставить приёмку с актом смерти.' : 'Сопоставить источник с образом убийства.', `check:${id}:result`), back]);
  if (phase === 'result') return node(check.result, [option('Сохранить результат проверки.', `check:${id}:saved`, current => {
    if (!current.casework.results.includes(id)) current.casework.results.push(id);
    log(current, `Повторная проверка: ${check.title}`, check.note);
  }), back]);
  if (!state.casework.results.includes(id)) return null;
  return node(`РЕЗУЛЬТАТ СОХРАНЁН\n\n${check.note}\n\nТеперь его можно привести как аргумент при обсуждении рабочей версии.`, [back, option('Отключиться.', null)]);
}

export function debateNode(contact, key, state, returnNode) {
  if (!Object.hasOwn(NAMES, contact) || !state.hypothesis) return null;
  const back = () => option('Вернуться к разговору.', returnNode);
  const uncertain = () => option('Признать: версия пока не доказана.', 'debate:uncertain', current => recordDebate(current, contact, null));
  const follow = () => option(contact === 'aramaki' ? 'Что осталось проверить?' : 'Как проверить спорную деталь?', 'debate:lead', current => {
    if (contact !== 'aramaki') unlockCheck(current, contact === 'batou' ? 'custody' : 'reflection');
  });
  if (key === 'debate') return node(`ВАША ВЕРСИЯ: ${HYPOTHESES[state.hypothesis]}\n\n${CHALLENGES[contact][state.hypothesis]}${state.approach ? '\n\nПлан уже утверждён. Этот разговор уточняет материалы; версия выезда остаётся прежней.' : ''}`, [option('Привести улику в поддержку.', 'debate:arguments'), uncertain(), ...(!state.approach ? [option('Пересмотреть рабочую версию.', 'debate:revise')] : []), follow(), back()]);
  const argumentOption = id => option(ARGUMENTS[id], `debate:answer:${id}`, current => recordDebate(current, contact, id));
  if (key === 'debate:arguments') return node('На какой факт вы опираетесь? Собеседник оценит связь между материалом и вашей версией.', [...['military', 'memory', 'trace'].filter(id => argumentAvailable(state, id)).map(argumentOption), ...(state.casework.results.length ? [option('Результаты повторных проверок.', 'debate:results')] : []), option('Вернуться к версии.', 'debate')]);
  if (key === 'debate:results') return node('Вы открываете дополнения к делу.', [...Object.keys(CHECKS).filter(id => argumentAvailable(state, id)).map(argumentOption), option('К остальным уликам.', 'debate:arguments')]);
  if (key.startsWith('debate:answer:')) {
    const id = key.slice('debate:answer:'.length);
    if (!argumentAvailable(state, id)) return null;
    const [useful, reply] = ARGUMENT_REPLIES[state.hypothesis][id];
    return node(`${VOICE[contact][useful ? 'useful' : 'weak']}\n\n${reply}\n\n${state.approach ? 'Утверждённый доклад сохранён. Это уточнение не меняет согласованный план.' : contact === 'aramaki' && canApprove(state) ? '«Основание и оговорки зафиксированы. Можем выбрать порядок выезда».': useful ? 'Версия остаётся рабочей. Сохраняем и аргумент, и его границы.' : 'Можно привести другой материал, признать неопределённость или пересмотреть версию.'}`, [option('Привести другой аргумент.', 'debate:arguments'), uncertain(), ...(!state.approach ? [option('Пересмотреть рабочую версию.', 'debate:revise')] : []), follow(), back()]);
  }
  if (key === 'debate:uncertain') return node(`${VOICE[contact].uncertain}\n\n${contact === 'aramaki' && !canApprove(state) ? '«Но сначала закончите обе проверки. После новых результатов мы вернёмся к докладу».': contact === 'aramaki' ? '«Проверки завершены, оговорка внесена. Вернитесь к докладу — выберем план выезда».': 'Оговорка внесена в журнал. Версию можно уточнить после повторной проверки.'}`, [follow(), back()]);
  if (key === 'debate:revise') {
    if (state.approach) return null;
    return node('Какое объяснение проверяем дальше? Смена версии сохранит улики и результаты, но потребует нового обсуждения с Арамаки.', [...Object.entries(HYPOTHESES).filter(([id]) => id !== state.hypothesis).map(([id, text]) => option(text, 'debate', current => selectHypothesis(current, id))), option('Оставить текущую версию.', 'debate')]);
  }
  if (key === 'debate:lead') {
    if (contact === 'aramaki' && Object.keys(CHECKS).every(id => state.casework.results.includes(id))) return node('«Обе проверки закончены. Теперь изложите, какой факт поддерживает вашу версию, или прямо обозначьте её как предположение. На этом основании выберем порядок выезда».', [option('Вернуться к версии.', 'debate'), back()]);
    if (contact === 'aramaki') return node(`«Бато поможет проследить нейроблок. Тогуса — отделить отражение от основной записи. Сначала уточним эти две детали, затем решим, что можем утверждать».\n\n${caseworkSummary(state)}`, [back()]);
    const id = contact === 'batou' ? 'custody' : 'reflection';
    return node(state.casework.results.includes(id) ? CHECKS[id].followup : CHECKS[id].lead, [option('Вернуться к версии.', 'debate'), back()]);
  }
  return null;
}
