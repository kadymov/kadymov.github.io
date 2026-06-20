/* =====================================================================
   Юнит-тесты вычислительного ядра «Умного блокнота».
   Запуск:  node --test     (либо npm test)
   Зависимостей нет — используется встроенный в Node тест-раннер.
   ===================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('./engine.js');

/* ---------------------------------------------------------------------
   Хелперы
   ------------------------------------------------------------------- */

// Прогон одной строки выражения, возврат { value, status }.
function evalLine(src, vars = {}, names = new Set()) {
  const { tokens } = E.tokenizeLine(src, names);
  return E.evaluateTokens(tokens, vars, names);
}

// Полный текст → отформатированный результат ПОСЛЕДНЕЙ значимой строки.
function lastResult(src) {
  const rows = E.computeRows(src);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].line && rows[i].line.trim()) {
      const r = rows[i];
      if (r.value === null) return { out: '', status: r.status, kind: r.kind };
      const out = r.kind === 'assign'
        ? r.defName + ' = ' + E.formatValue(r.value)
        : E.formatValue(r.value);
      return { out, status: r.status, kind: r.kind };
    }
  }
  return { out: '', status: 'empty', kind: 'none' };
}

const fmt = src => lastResult(src).out;

/* =====================================================================
   1. Конструкторы и предикаты типов
   ===================================================================== */

test('mkNum / isNum', () => {
  const v = E.mkNum(5);
  assert.equal(E.isNum(v), true);
  assert.equal(v.n, 5);
  assert.equal(v.cur, null);
  assert.equal(E.isNum(E.mkDur(10)), false);
});

test('isNum отвергает Infinity / NaN', () => {
  assert.equal(E.isNum(E.mkNum(Infinity)), false);
  assert.equal(E.isNum(E.mkNum(NaN)), false);
});

test('mkTime нормализует и считает переполнение суток', () => {
  const t = E.mkTime(25, 0, 0);            // 25:00 → 01:00, +1 сутки
  assert.equal(E.isTime(t), true);
  assert.equal(t.s, 3600);
  assert.equal(t.dayOverflow, 1);
});

test('mkTime с отрицательным временем уходит в предыдущие сутки', () => {
  const t = E.mkTime(0, 0, -3600);         // -1ч → 23:00, -1 сутки
  assert.equal(t.s, 23 * 3600);
  assert.equal(t.dayOverflow, -1);
});

test('combineCurrency: одинаковые/частичные/конфликт', () => {
  assert.equal(E.combineCurrency(E.mkNum(1, '₽'), E.mkNum(2, '₽')), '₽');
  assert.equal(E.combineCurrency(E.mkNum(1, '₽'), E.mkNum(2)), '₽');
  assert.equal(E.combineCurrency(E.mkNum(1), E.mkNum(2)), null);
  assert.equal(E.combineCurrency(E.mkNum(1, '₽'), E.mkNum(2, '$')), undefined);
});

/* =====================================================================
   2. Токенизатор
   ===================================================================== */

test('tokenizeLine: число + оператор + число', () => {
  const { tokens, defName } = E.tokenizeLine('2 + 3', new Set());
  assert.equal(defName, null);
  const kinds = tokens.filter(t => t.kind !== 'ws').map(t => t.kind);
  assert.deepEqual(kinds, ['num', 'op', 'num']);
});

test('tokenizeLine: определение переменной', () => {
  const { tokens, defName } = E.tokenizeLine('x = 5', new Set());
  assert.equal(defName, 'x');
  assert.equal(tokens[0].kind, 'vardef');
});

test('tokenizeLine: зарезервированное слово не становится переменной', () => {
  const { defName } = E.tokenizeLine('sin = 5', new Set());
  assert.equal(defName, null);
});

test('tokenizeLine: число с валютным суффиксом', () => {
  const { tokens } = E.tokenizeLine('1000 руб', new Set());
  const num = tokens.find(t => t.kind === 'num');
  assert.equal(num.val.cur, '₽');
  assert.equal(num.val.n, 1000);
});

test('tokenizeLine: длительность 2ч', () => {
  const { tokens } = E.tokenizeLine('2ч', new Set());
  const num = tokens.find(t => t.kind === 'num');
  assert.equal(E.isDur(num.val), true);
  assert.equal(num.val.s, 7200);
});

test('tokenizeLine: время суток vs длительность по диапазону', () => {
  const day  = E.tokenizeLine('09:30', new Set()).tokens.find(t => t.kind === 'num');
  const over = E.tokenizeLine('99:99', new Set()).tokens.find(t => t.kind === 'num');
  assert.equal(E.isTime(day.val), true);
  assert.equal(E.isDur(over.val), true);   // вне диапазона часов/минут → длительность
});

test('tokenizeLine: даты ISO и dotted', () => {
  const iso = E.tokenizeLine('2024-06-15', new Set()).tokens.find(t => t.kind === 'num');
  const dot = E.tokenizeLine('15.06.2024', new Set()).tokens.find(t => t.kind === 'num');
  assert.equal(E.formatDate(iso.val), '2024-06-15');
  assert.equal(E.formatDate(dot.val), '2024-06-15');
});

test('tokenizeLine: десятичная запятая', () => {
  const { tokens } = E.tokenizeLine('1,5', new Set());
  assert.equal(tokens.find(t => t.kind === 'num').val.n, 1.5);
});

test('classifyWord распознаёт роли', () => {
  assert.equal(E.classifyWord('sqrt', new Set()).role, 'fn');
  assert.equal(E.classifyWord('руб', new Set()).role, 'curr');
  assert.equal(E.classifyWord('ч', new Set()).role, 'unit');
  assert.equal(E.classifyWord('плюс', new Set()).role, 'wordop');
  assert.equal(E.classifyWord('today', new Set()).role, 'dateword');
  assert.equal(E.classifyWord('ИТОГ', new Set()).role, 'keyword');
  assert.equal(E.classifyWord('foo', new Set(['foo'])).role, 'var');
  assert.equal(E.classifyWord('foo', new Set()).role, 'unknown');
});

/* =====================================================================
   3. Базовая арифметика
   ===================================================================== */

const arith = [
  ['2 + 2', '4'], ['10 - 3', '7'], ['6 * 7', '42'], ['10 / 4', '2.5'],
  ['2 ^ 10', '1024'], ['2 ** 8', '256'],
  ['2 + 3 * 4', '14'], ['(2 + 3) * 4', '20'],
  ['-5 + 3', '-2'], ['10 * (-2)', '-20'], ['((1+2)*(3+4))', '21'],
  ['1.5 + 2.5', '4'], ['1,5 + 2,5', '4'],
];
for (const [src, exp] of arith) {
  test(`арифметика: ${src} = ${exp}`, () => assert.equal(fmt(src), exp));
}

test('деление на ноль → ошибка (пусто)', () => {
  assert.equal(fmt('5 / 0'), '');
  assert.equal(lastResult('5 / 0').status, 'error');
});

test('0.1 + 0.2 округляется до 0.3', () => {
  assert.equal(fmt('0.1 + 0.2'), '0.3');
});

/* =====================================================================
   4. Функции и константы
   ===================================================================== */

const fns = [
  ['sqrt(16)', '4'], ['abs(-7)', '7'], ['round(3.7)', '4'],
  ['floor(3.9)', '3'], ['ceil(3.1)', '4'], ['log(1000)', '3'],
  ['sqrt(9) + 1', '4'],
];
for (const [src, exp] of fns) {
  test(`функция: ${src} = ${exp}`, () => assert.equal(fmt(src), exp));
}

test('константы pi и e', () => {
  assert.equal(E.isNum(evalLine('pi').value), true);
  assert.ok(Math.abs(evalLine('pi').value.n - Math.PI) < 1e-9);
  assert.ok(Math.abs(evalLine('e').value.n - Math.E) < 1e-9);
});

test('applyFunction отвергает не-число и неизвестную функцию', () => {
  assert.equal(E.applyFunction('sqrt', E.mkDur(4)), null);
  assert.equal(E.applyFunction('нет_такой', E.mkNum(4)), null);
});

/* =====================================================================
   5. Проценты
   ===================================================================== */

test('голый процент 50% = 0.5', () => assert.equal(fmt('50%'), '0.5'));
test('процент от: 20% от 200 = 40', () => assert.equal(fmt('20% от 200'), '40'));
test('процент от (en): 10% of 50 = 5', () => assert.equal(fmt('10% of 50'), '5'));
test('цепочка процентов: 1000 - 10% от 1000 = 900', () =>
  assert.equal(fmt('1000 - 10% от 1000'), '900'));

/* =====================================================================
   6. Словесные операторы
   ===================================================================== */

const words = [
  ['5 на 3', '15'], ['5 плюс 3', '8'], ['10 минус 4', '6'],
  ['10 разделить 2', '5'], ['4 х 5', '20'],
];
for (const [src, exp] of words) {
  test(`слово-оператор: ${src} = ${exp}`, () => assert.equal(fmt(src), exp));
}

/* =====================================================================
   7. Валюты
   ===================================================================== */

test('валюта суффикс: 1000 руб', () => assert.equal(fmt('1000 руб'), '1000 ₽'));
test('валюта префикс: $50', () => assert.equal(fmt('$50'), '$50'));
test('валюта суффикс: 50$', () => assert.equal(fmt('50$'), '$50'));
test('сложение одной валюты: 100 руб + 200 руб', () =>
  assert.equal(fmt('100 руб + 200 руб'), '300 ₽'));
test('умножение валюты на число: 1000 руб * 3', () =>
  assert.equal(fmt('1000 руб * 3'), '3000 ₽'));
test('евро префикс: €99', () => assert.equal(fmt('€99'), '€99'));
test('процент от суммы в валюте: 6% от 1000 руб', () =>
  assert.equal(fmt('6% от 1000 руб'), '60 ₽'));

test('конфликт валют → статус currency', () => {
  const r = lastResult('100 руб + 50 $');
  assert.equal(r.out, '');
  assert.equal(r.status, 'currency');
});

test('applyBinary возвращает символ конфликта валют', () => {
  const r = E.applyBinary('+', E.mkNum(1, '₽'), E.mkNum(2, '$'));
  assert.equal(r, E.CURRENCY_CONFLICT);
});

/* =====================================================================
   8. Время и длительности
   ===================================================================== */

test('длительность: 2ч', () => assert.equal(fmt('2ч'), '2ч'));
test('составная длительность: 1ч 30мин', () => assert.equal(fmt('1ч 30мин'), '1ч 30мин'));
test('сложение длительностей: 1ч + 30мин', () => assert.equal(fmt('1ч + 30мин'), '1ч 30мин'));
test('длительность * число: 2ч * 3', () => assert.equal(fmt('2ч * 3'), '6ч'));
test('длительность / число: 3ч / 2', () => assert.equal(fmt('3ч / 2'), '1ч 30мин'));
test('длительность / длительность → число: 2ч / 1ч', () =>
  assert.equal(fmt('2ч / 1ч'), '2'));

test('время суток: 09:30', () => assert.equal(fmt('09:30'), '09:30'));
test('время + длительность: 09:30 + 1ч 15мин', () =>
  assert.equal(fmt('09:30 + 1ч 15мин'), '10:45'));
test('время - время → длительность: 18:00 - 09:30', () =>
  assert.equal(fmt('18:00 - 09:30'), '8ч 30мин'));
test('переполнение суток: 23:00 + 3ч', () =>
  assert.equal(fmt('23:00 + 3ч'), '02:00 +1д'));
test('время с секундами: 01:02:03', () => assert.equal(fmt('01:02:03'), '01:02:03'));

/* =====================================================================
   9. Даты
   ===================================================================== */

test('дата ISO остаётся датой', () => assert.equal(fmt('2024-06-15'), '2024-06-15'));
test('дата - дата → длительность в днях', () =>
  assert.equal(fmt('2024-06-15 - 2024-06-01'), '14д'));
test('дата + дни', () => assert.equal(fmt('2024-06-01 + 14'), '2024-06-15'));
test('дата + неделя', () => assert.equal(fmt('2024-06-01 + 1нед'), '2024-06-08'));

test('dateDiffDays DST-безопасен', () => {
  const a = new Date(2024, 5, 15), b = new Date(2024, 5, 1);
  assert.equal(E.dateDiffDays(a, b), 14);
});

/* =====================================================================
   10. Переменные (область видимости между строками)
   ===================================================================== */

test('переменная и её использование', () => assert.equal(fmt('x = 5\nx + 1'), '6'));
test('цепочка переменных', () => assert.equal(fmt('a = 2\nb = a * 3\nb'), '6'));
test('переменная с валютой', () => assert.equal(fmt('цена = 100 руб\nцена * 2'), '200 ₽'));
test('кириллические имена', () => assert.equal(fmt('ставка = 3500\nставка'), '3500'));
test('подчёркивание в имени', () => assert.equal(fmt('проект_A = 100\nпроект_A + 1'), '101'));
test('латиница', () => assert.equal(fmt('projectA = 5\nprojectA'), '5'));
test('сумма двух переменных', () => assert.equal(fmt('a_1 = 10\nb_2 = 20\na_1 + b_2'), '30'));

test('неизвестная переменная → ошибка', () => {
  const r = lastResult('y + 1');
  assert.equal(r.out, '');
  assert.equal(r.status, 'error');
});

test('forward-ссылка (переменная объявлена ниже) → ошибка', () => {
  const rows = E.computeRows('a = b\nb = 5');
  assert.equal(rows[0].status, 'error');  // a = b, где b ещё нет
});

/* =====================================================================
   11. ИТОГ
   ===================================================================== */

test('ИТОГ суммирует числа выше', () => assert.equal(fmt('10\n20\n30\nИТОГ'), '60'));
test('total (en) суммирует', () => assert.equal(fmt('5\n5\ntotal'), '10'));
test('ИТОГ по валюте', () => assert.equal(fmt('100 руб\n200 руб\nИТОГ'), '300 ₽'));
test('ИТОГ по длительностям', () => assert.equal(fmt('1ч\n2ч\nИТОГ'), '3ч'));

test('ИТОГ сбрасывается после предыдущего ИТОГ', () => {
  // второй ИТОГ суммирует только строки после первого ИТОГ
  assert.equal(fmt('10\nИТОГ\n5\n5\nИТОГ'), '10');
});

test('isTotalRow распознаёт строку-итог', () => {
  const t1 = E.tokenizeLine('ИТОГ', new Set()).tokens;
  const t2 = E.tokenizeLine('2 + 2', new Set()).tokens;
  assert.equal(E.isTotalRow(t1), true);
  assert.equal(E.isTotalRow(t2), false);
});

test('sumValues: смешанные типы выбирают доминирующий', () => {
  const s = E.sumValues([E.mkNum(100, '₽'), E.mkDur(7200)]);
  // чисел и длительностей поровну → числа выигрывают (durs.length > nums.length === false)
  assert.equal(E.isNum(s), true);
});

test('sumValues: конфликт валют сбрасывает валюту', () => {
  const s = E.sumValues([E.mkNum(100, '₽'), E.mkNum(50, '$')]);
  assert.equal(s.cur, null);
  assert.equal(s.n, 150);
});

/* =====================================================================
   12. Текст / заметки / комментарии
   ===================================================================== */

test('обычный текст с неизвестными словами помечается ошибкой', () => {
  // каждое незнакомое слово становится err-токеном → строка подсвечивается
  const r = lastResult('просто заметка');
  assert.equal(r.out, '');
  assert.equal(r.status, 'error');
});
test('бесчисленная строка-единица → заметка (note)', () => {
  // одиночная единица/валюта без числа не порождает ни числа, ни ошибки
  assert.equal(lastResult('руб').status, 'note');
});
test('строка-комментарий //', () => assert.equal(lastResult('// коммент').status, 'note'));
test('строка-комментарий #', () => assert.equal(lastResult('# заголовок').status, 'note'));
test('выражение + комментарий', () => assert.equal(fmt('2 + 2 // ответ'), '4'));

/* =====================================================================
   13. Краевые случаи / устойчивость парсера
   ===================================================================== */

test('висячий оператор → ошибка', () => assert.equal(fmt('5 +'), ''));
test('незакрытая скобка → ошибка', () => assert.equal(fmt('(5 + 3'), ''));
test('лишняя закрывающая скобка → ошибка', () => assert.equal(fmt('5 + 3)'), ''));

test('toRPN возвращает null при несбалансированных скобках', () => {
  const { calc } = E.buildCalcTokens(E.tokenizeLine('(5 + 3', new Set()).tokens, {}, new Set());
  assert.equal(E.toRPN(calc), null);
});

test('текст с числом не валится, а помечается ошибкой', () => {
  // "купил 3 яблока" — слова неизвестны → ошибка, без исключений
  assert.doesNotThrow(() => lastResult('купил 3 яблока'));
});

test('большие и крошечные числа форматируются', () => {
  assert.doesNotThrow(() => fmt('999999999 * 999999999'));
  assert.equal(fmt('0.1 + 0.2'), '0.3');
});

test('пустой ввод → нет строк-результатов', () => {
  const rows = E.computeRows('');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'empty');
});

/* =====================================================================
   14. Форматирование (изолированно)
   ===================================================================== */

test('formatNumber: целые без дробной части', () => {
  assert.equal(E.formatNumber(4), '4');
  assert.equal(E.formatNumber(2.5), '2.5');
  assert.equal(E.formatNumber(Infinity), '—');
});

test('formatWithCurrency: символ слева / код справа', () => {
  assert.equal(E.formatWithCurrency(50, '$'), '$50');
  assert.equal(E.formatWithCurrency(1000, '₽'), '1000 ₽');
  assert.equal(E.formatWithCurrency(50, null), '50');
});

test('formatDuration: знак и составные части', () => {
  assert.equal(E.formatDuration(7200), '2ч');
  assert.equal(E.formatDuration(5400), '1ч 30мин');
  assert.equal(E.formatDuration(-3600), '-1ч');
  assert.equal(E.formatDuration(30), '30 сек');
});

test('formatTime: с секундами и переполнением', () => {
  assert.equal(E.formatTime(E.mkTime(9, 30)), '09:30');
  assert.equal(E.formatTime(E.mkTime(1, 2, 3)), '01:02:03');
  assert.equal(E.formatTime(E.mkTime(25, 0)), '01:00 +1д');
});

test('escapeHtml экранирует спецсимволы', () => {
  assert.equal(E.escapeHtml('<a> & "b"'), '&lt;a&gt; &amp; &quot;b&quot;');
});

test('valueClass различает временные типы', () => {
  assert.equal(E.valueClass(E.mkNum(5)), '');
  assert.equal(E.valueClass(E.mkDur(60)), 'result-time');
  assert.equal(E.valueClass(E.mkDate(new Date())), 'result-time');
});

/* =====================================================================
   15. renderHighlightLine (подсветка из токенов)
   ===================================================================== */

test('renderHighlightLine оборачивает токены в span с классом', () => {
  const { tokens } = E.tokenizeLine('2 + 2', new Set());
  const html = E.renderHighlightLine(tokens, null);
  assert.match(html, /tok-num/);
  assert.match(html, /tok-op/);
});

test('renderHighlightLine помечает ошибочные индексы', () => {
  const names = new Set();
  const { tokens } = E.tokenizeLine('y + 1', names);
  const { errorIdx } = E.evaluateTokens(tokens, {}, names);
  const html = E.renderHighlightLine(tokens, errorIdx);
  assert.match(html, /tok-error/);
});

/* =====================================================================
   16. Сегменты для подсветки колонки результатов
   ===================================================================== */

// Удобный сбор: только подсвеченные (cls != '') куски текста.
const units = segs => segs.filter(s => s.cls).map(s => s.cls + ':' + s.text);

test('numberSegments: знак валюты (tok-curr) отделён от цифр (tok-num)', () => {
  assert.deepEqual(E.numberSegments(50, '$'),
    [{ text: '$', cls: 'tok-curr' }, { text: '50', cls: 'tok-num' }]);
});

test('numberSegments: код валюты (tok-curr) отделён от цифр (tok-num)', () => {
  assert.deepEqual(E.numberSegments(1000, '₽'),
    [{ text: '1000', cls: 'tok-num' }, { text: ' ', cls: '' }, { text: '₽', cls: 'tok-curr' }]);
});

test('numberSegments: без валюты — число как tok-num', () => {
  assert.deepEqual(E.numberSegments(42, null), [{ text: '42', cls: 'tok-num' }]);
});

test('durationSegments: цифры tok-num, единицы tok-time', () => {
  const segs = E.durationSegments(5400); // 1ч 30мин
  assert.deepEqual(units(segs),
    ['tok-num:1', 'tok-time:ч', 'tok-num:30', 'tok-time:мин']);
});

test('formatValueSegments: время целиком — tok-time', () => {
  assert.deepEqual(E.formatValueSegments(E.mkTime(9, 30)),
    [{ text: '09:30', cls: 'tok-time' }]);
});

test('formatValueSegments: дата целиком — tok-date', () => {
  const segs = E.formatValueSegments(E.mkDate(new Date(2024, 5, 15)));
  assert.deepEqual(segs, [{ text: '2024-06-15', cls: 'tok-date' }]);
});

test('инвариант: конкатенация сегментов == formatValue', () => {
  const vals = [
    E.mkNum(42), E.mkNum(50, '$'), E.mkNum(1000, '₽'),
    E.mkDur(5400), E.mkDur(30), E.mkDur(-3600),
    E.mkTime(9, 30), E.mkTime(25, 0), E.mkDate(new Date(2024, 5, 15)),
  ];
  for (const v of vals) {
    const joined = E.formatValueSegments(v).map(s => s.text).join('');
    assert.equal(joined, E.formatValue(v), 'mismatch for ' + JSON.stringify(v));
  }
});

test('рефакторинг formatDuration/formatWithCurrency не изменил строки', () => {
  assert.equal(E.formatDuration(5400), '1ч 30мин');
  assert.equal(E.formatDuration(-3600), '-1ч');
  assert.equal(E.formatDuration(30), '30 сек');
  assert.equal(E.formatWithCurrency(50, '$'), '$50');
  assert.equal(E.formatWithCurrency(1000, '₽'), '1000 ₽');
});
