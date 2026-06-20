/* =====================================================================
   Умный блокнот — UI-СЛОЙ (DOM)
   ---------------------------------------------------------------------
   Здесь только то, что касается интерфейса: рендер результатов и
   подсветки из строк, посчитанных ядром (engine.js → SmartEngine),
   обработчики ввода, активная строка, авто-высота и сохранение.
   Вся «умная» логика — в engine.js.
   ===================================================================== */
'use strict';

const {
  computeRows, formatValueSegments, escapeHtml, renderHighlightLine,
} = SmartEngine;

/* =========================
   UI: элементы
   ========================= */

const editor   = document.getElementById('editor');
const syntaxEl = document.getElementById('syntax');
const results  = document.getElementById('results');
const lineHL   = document.getElementById('lineHL');
const resultHL = document.getElementById('resultHL');
const stack    = document.getElementById('stack');

const LINE_HEIGHT = 26;

/* =========================
   РЕНДЕР: строка результата + подсветка из row
   ========================= */

// Значение → HTML с посегментной подсветкой: цифры нейтральны,
// единицы (валюта/время/дата) обёрнуты в span с tok-классом.
function valueHtml(value) {
  return formatValueSegments(value).map(seg =>
    seg.cls
      ? '<span class="' + seg.cls + '">' + escapeHtml(seg.text) + '</span>'
      : escapeHtml(seg.text)
  ).join('');
}

function renderResultRow(row) {
  if (row.kind === 'total') {
    return '<span class="result-line result-total">' + valueHtml(row.value) + '</span>';
  }
  if (row.kind === 'assign') {
    return '<span class="result-line">' + escapeHtml(row.defName + ' = ') + valueHtml(row.value) + '</span>';
  }
  if (row.kind === 'number') {
    return '<span class="result-line">' + valueHtml(row.value) + '</span>';
  }
  // none / пусто / ошибка
  if (row.status === 'currency') return '<span class="result-line result-err">⚠ валюты</span>';
  if (row.status === 'error')    return '<span class="result-line result-err">⚠ ошибка</span>';
  return '<span class="result-line result-empty">·</span>';
}

function renderSyntaxRow(row) {
  if (row.status === 'empty') return ' ';
  // ошибки в подсветке показываем только когда статус действительно 'error'
  const errIdx = row.status === 'error' ? row.errorIdx : null;
  return renderHighlightLine(row.tokens, errIdx);
}

function update() {
  const rows = computeRows(editor.value);
  const outRes = [];
  const outSyntax = [];
  for (const row of rows) {
    outRes.push(renderResultRow(row));
    outSyntax.push(renderSyntaxRow(row));
  }
  syntaxEl.innerHTML = outSyntax.join('\n') + '\n';
  results.innerHTML  = outRes.join('');
}

/* =========================
   АКТИВНАЯ СТРОКА
   ========================= */

function getCaretLine() {
  const pos = editor.selectionStart;
  const before = editor.value.substring(0, pos);
  return before.split('\n').length - 1;
}

function updateActiveLine() {
  const lineIdx = getCaretLine();
  const isFocused = document.activeElement === editor;
  if (isFocused) {
    const top = (lineIdx * LINE_HEIGHT) + 'px';
    lineHL.style.top   = top;
    resultHL.style.top = top;
    lineHL.classList.add('visible');
    resultHL.classList.add('visible');
  } else {
    lineHL.classList.remove('visible');
    resultHL.classList.remove('visible');
  }
}

function autoResize() {
  editor.style.height = 'auto';
  const h = (editor.scrollHeight + 2) + 'px';
  editor.style.height = h;
  syntaxEl.style.height = h;
  stack.style.minHeight = h;
}

function onChange() {
  autoResize();
  update();
  updateActiveLine();
  saveState();
}

editor.addEventListener('input', onChange);
editor.addEventListener('keyup', updateActiveLine);
editor.addEventListener('click', updateActiveLine);
editor.addEventListener('focus', updateActiveLine);
editor.addEventListener('blur', updateActiveLine);
editor.addEventListener('select', updateActiveLine);
document.addEventListener('selectionchange', () => {
  if (document.activeElement === editor) updateActiveLine();
});

editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '\t');
  }
});

window.addEventListener('resize', autoResize);

/* =========================
   СОХРАНЕНИЕ
   ========================= */

function saveState() {
  try { localStorage.setItem('smart-notepad', editor.value); } catch {}
}
function loadState() {
  try { const v = localStorage.getItem('smart-notepad'); if (v !== null) return v; } catch {}
  return null;
}

const DEFAULT_TEXT = `// ─── Финансы фрилансера: январь 2024 ───

# Ставка и норма
ставка = 3500 руб
часов_в_день = 7
рабочих_дней = 22

# Доход по проектам
проект_A = ставка * часов_в_день * 12     // 12 дней
проект_B = 180000 руб                     // фикс
консультации = 5000 руб * 6               // 6 часовых
доход = проект_A + проект_B + консультации

# Расходы
аренда_офиса = 18000 руб
интернет = 1200 руб
подписки = 49$ + 20$ + 10$                // софт (USD отдельно от руб!)
налог_УСН = 6% от доход
расходы = аренда_офиса + интернет + налог_УСН

# Прибыль
прибыль = доход - расходы
рентабельность = прибыль / доход * 100   // в процентах

# Отложить
подушка = 20% от прибыль
инвестиции = 15% от прибыль
свободно = прибыль - подушка - инвестиции

# ─── Контрольные суммы ───
доход
расходы
прибыль
ИТОГ                                     // сумма трёх строк выше

# ─── Время до отпуска ───
дата_сегодня = today
отпуск = 2024-06-15
осталось = отпуск - дата_сегодня

рабочих_часов = часов_в_день * рабочих_дней * 5
заработаю = ставка * рабочих_часов

# ─── Тайминг рабочего дня ───
начало = 09:30
обед = 1ч 15мин
работа_до_обеда = 3ч 30мин
работа_после = 4ч
конец = начало + работа_до_обеда + обед + работа_после

# ─── Проверка ошибок ───
тест = доход + неизвестная_переменная     // ⚠ подсветится ошибкой
микс = 100 руб + 50$                      // ⚠ конфликт валют`;

const saved = loadState();
editor.value = saved !== null ? saved : DEFAULT_TEXT;

autoResize();
update();
updateActiveLine();
