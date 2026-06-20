/* =====================================================================
   Умный блокнот — ВЫЧИСЛИТЕЛЬНОЕ ЯДРО (без DOM)
   ---------------------------------------------------------------------
   Здесь живут все «умные» функции: токенизатор, парсер (shunting-yard),
   вычислитель (RPN), операции над типами (число/валюта/длительность/
   время/дата), агрегатор ИТОГ и форматирование.

   Файл работает И в браузере (глобальный объект `SmartEngine`), И в Node
   (`module.exports`) — это позволяет покрыть всё юнит-тестами.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SmartEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* =========================
   КОНСТАНТЫ
   ========================= */

const WORD_OPERATORS = {
  'на': '*', 'по': '*', 'за': '*', 'умножить': '*', 'х': '*',
  'per': '*', 'each': '*', 'every': '*',
  'плюс': '+', 'и': '+', 'добавить': '+', 'plus': '+',
  'минус': '-', 'вычесть': '-', 'minus': '-',
  'разделить': '/', 'делить': '/', 'divided': '/',
};

const TOTAL_WORD_RE = /\b(итог|итого|сумма|всего|total|sum)\b/i;

const FUNCTIONS = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  log: Math.log10, ln: Math.log, exp: Math.exp, abs: Math.abs,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const FN_NAMES = Object.keys(FUNCTIONS);

const CURRENCY_MAP = {
  '$': '$', 'usd': '$', 'dollar': '$', 'dollars': '$',
  '€': '€', 'eur': '€', 'euro': '€', 'euros': '€',
  '₽': '₽', 'rub': '₽', 'руб': '₽', 'рубль': '₽', 'рублей': '₽',
  '£': '£', 'gbp': '£', 'pound': '£', 'pounds': '£',
  '¥': '¥', 'jpy': '¥', 'cny': '¥', 'yen': '¥',
  '₸': '₸', 'kzt': '₸', 'тенге': '₸',
  '₴': '₴', 'uah': '₴', 'грн': '₴',
};

const TIME_UNITS = {
  's':1,'sec':1,'secs':1,'second':1,'seconds':1,'с':1,'сек':1,'секунда':1,'секунды':1,'секунд':1,
  'm':60,'min':60,'mins':60,'minute':60,'minutes':60,'м':60,'мин':60,'минута':60,'минуты':60,'минут':60,
  'h':3600,'hr':3600,'hrs':3600,'hour':3600,'hours':3600,'ч':3600,'час':3600,'часа':3600,'часов':3600,
  'd':86400,'day':86400,'days':86400,'д':86400,'дн':86400,'день':86400,'дня':86400,'дней':86400,'сутки':86400,'суток':86400,
  'w':604800,'week':604800,'weeks':604800,'нед':604800,'неделя':604800,'недели':604800,'недель':604800,
};

const CONST_WORDS = { 'pi': Math.PI, 'e': Math.E };
const DATE_WORDS  = new Set(['today', 'now', 'сегодня']);
const TOTAL_KEYWORDS = new Set(['итог','итого','сумма','всего','total','sum']);

const MS_PER_DAY = 86400000;

/* =========================
   ТИПЫ ЗНАЧЕНИЙ
   Число может нести валюту: { __t:'num', n, cur }
   ========================= */
const T_NUM='num',T_DUR='dur',T_TIME='time',T_DATE='date';
const isObjVal=v=>v&&typeof v==='object'&&v.__t;
const isNum =v=>isObjVal(v)&&v.__t===T_NUM&&isFinite(v.n);
const isDur =v=>isObjVal(v)&&v.__t===T_DUR;
const isTime=v=>isObjVal(v)&&v.__t===T_TIME;
const isDate=v=>isObjVal(v)&&v.__t===T_DATE;

const mkNum =(n,cur=null)=>({__t:T_NUM, n, cur});
const mkDur =s=>({__t:T_DUR,s});
const mkTime=(h,m,sec=0)=>{
  const raw = h*3600+m*60+sec;
  const dayOverflow = Math.floor(raw/86400);
  return {__t:T_TIME, s:((raw%86400)+86400)%86400, dayOverflow};
};
const mkDate=d=>({__t:T_DATE,d:new Date(d.getTime())});

// Выбор валюты при бинарной операции (одинаковые или одна null)
function combineCurrency(a, b) {
  if (a.cur && b.cur) {
    if (a.cur === b.cur) return a.cur;
    return undefined; // конфликт валют — сигнал об ошибке
  }
  return a.cur || b.cur || null;
}

/* =========================
   ЕДИНЫЙ ТОКЕНИЗАТОР
   Один проход по строке → массив токенов с позициями и классами.
   Используется И для вычислений, И для подсветки.
   Токен: { kind, val?, text, cls }
   ========================= */

// Регэкспы вынесены наружу (создаются один раз)
const RX = {
  ws:       /\s+/y,
  comment:  /\/\/.*|#.*/y,
  date1:    /(\d{4})-(\d{1,2})-(\d{1,2})/y,
  date2:    /(\d{1,2})\.(\d{1,2})\.(\d{4})/y,
  time:     /(\d{1,2}):(\d{2})(?::(\d{2}))?\b/y,
  // процент от: 6% от / 6% of
  percentOf:/(\d+(?:[.,]\d+)?)\s*%\s*(?:от|of)(?![\p{L}\p{N}_])/iuy,
  percent:  /(\d+(?:[.,]\d+)?)\s*%/y,
  numUnit:  /(\d+(?:[.,]\d+)?)\s*([\p{L}$€₽£¥₸₴]+)/uy,
  num:      /\d+(?:[.,]\d+)?/y,
  op2:      /\*\*/y,
  op:       /[+\-*/^]/y,
  paren:    /[()]/y,
  curr:     /[$€₽£¥₸₴]/y,
  word:     /[\p{L}_][\p{L}\p{N}_]*/uy,
  other:    /[^\s]/y,
};

function num2float(str){ return parseFloat(str.replace(',', '.')); }

// Классифицирует слово (для подсветки + семантики)
function classifyWord(word, varNames) {
  const wl = word.toLowerCase();
  if (FN_NAMES.includes(wl))        return { cls: 'tok-fn', role: 'fn', key: wl };
  if (CURRENCY_MAP[wl])             return { cls: 'tok-curr', role: 'curr', key: CURRENCY_MAP[wl] };
  if (TIME_UNITS[wl] != null)       return { cls: 'tok-time', role: 'unit', key: wl };
  if (WORD_OPERATORS[wl])           return { cls: 'tok-op', role: 'wordop', key: WORD_OPERATORS[wl] };
  if (CONST_WORDS[wl] != null)      return { cls: 'tok-num', role: 'const', key: wl };
  if (DATE_WORDS.has(wl))           return { cls: 'tok-date', role: 'dateword', key: wl };
  if (TOTAL_KEYWORDS.has(wl))       return { cls: 'tok-keyword', role: 'keyword', key: wl };
  if (varNames && varNames.has(word)) return { cls: 'tok-var-ref', role: 'var', key: word };
  return { cls: 'tok-text', role: 'unknown', key: word }; // неизвестно (подсветим как ошибку при вычислении)
}

/**
 * Токенизирует строку.
 * @param {string} line
 * @param {Set<string>} varNames — известные имена переменных
 */
function tokenizeLine(line, varNames) {
  const tokens = [];
  const L = line.length;
  let p = 0;

  // 1) Распознаём определение переменной в начале: name =
  const eqMatch = line.match(/^(\s*)([\p{L}_][\p{L}\p{N}_]*)(\s*)=(?!=)/u);
  let defName = null;
  if (eqMatch && !RESERVED.has(eqMatch[2].toLowerCase())) {
    defName = eqMatch[2];
    if (eqMatch[1]) tokens.push({ kind:'ws', text:eqMatch[1], cls:'' });
    tokens.push({ kind:'vardef', text:eqMatch[2], cls:'tok-var-def', name:eqMatch[2] });
    if (eqMatch[3]) tokens.push({ kind:'ws', text:eqMatch[3], cls:'' });
    tokens.push({ kind:'eq', text:'=', cls:'tok-op' });
    p = eqMatch[0].length;
  }

  while (p < L) {
    let m;

    RX.ws.lastIndex = p;
    if ((m = RX.ws.exec(line)) && m.index === p) {
      tokens.push({ kind:'ws', text:m[0], cls:'' }); p += m[0].length; continue;
    }

    // Комментарий (// или #) — всё до конца строки
    RX.comment.lastIndex = p;
    if ((m = RX.comment.exec(line)) && m.index === p) {
      tokens.push({ kind:'comment', text:m[0], cls:'tok-comment' }); p += m[0].length; continue;
    }

    RX.date1.lastIndex = p;
    if ((m = RX.date1.exec(line)) && m.index === p) {
      tokens.push({ kind:'num', text:m[0], cls:'tok-date',
        val: mkDate(new Date(+m[1], +m[2]-1, +m[3])) });
      p += m[0].length; continue;
    }
    RX.date2.lastIndex = p;
    if ((m = RX.date2.exec(line)) && m.index === p) {
      tokens.push({ kind:'num', text:m[0], cls:'tok-date',
        val: mkDate(new Date(+m[3], +m[2]-1, +m[1])) });
      p += m[0].length; continue;
    }

    RX.time.lastIndex = p;
    if ((m = RX.time.exec(line)) && m.index === p) {
      const h=+m[1], mi=+m[2], sec=m[3]?+m[3]:0;
      let val;
      if (h<=23 && mi<=59 && sec<=59) val = mkTime(h,mi,sec);
      else val = mkDur(h*3600+mi*60+sec);
      tokens.push({ kind:'num', text:m[0], cls:'tok-time', val });
      p += m[0].length; continue;
    }

    // Процент от чего-то
    RX.percentOf.lastIndex = p;
    if ((m = RX.percentOf.exec(line)) && m.index === p) {
      // развернём в (n/100)* — добавим спец-токены
      tokens.push({ kind:'percentOf', text:m[0], cls:'tok-percent', val: num2float(m[1])/100 });
      p += m[0].length; continue;
    }

    // Процент (n%) → доля
    RX.percent.lastIndex = p;
    if ((m = RX.percent.exec(line)) && m.index === p) {
      tokens.push({ kind:'percent', text:m[0], cls:'tok-percent', val: num2float(m[1])/100 });
      p += m[0].length; continue;
    }

    // Число + единица (валюта/время) — без пробела или с пробелом
    RX.numUnit.lastIndex = p;
    if ((m = RX.numUnit.exec(line)) && m.index === p) {
      const numStr = m[1], unit = m[2];
      const unitLower = unit.toLowerCase();
      const between = m[0].slice(numStr.length, m[0].length - unit.length);
      if (TIME_UNITS[unitLower] != null) {
        tokens.push({ kind:'num', text:numStr, cls:'tok-num', val: mkDur(num2float(numStr)*TIME_UNITS[unitLower]) });
        if (between) tokens.push({ kind:'ws', text:between, cls:'' });
        tokens.push({ kind:'unitTag', text:unit, cls:'tok-time' });
        p += m[0].length; continue;
      }
      if (CURRENCY_MAP[unitLower]) {
        tokens.push({ kind:'num', text:numStr, cls:'tok-num', val: mkNum(num2float(numStr), CURRENCY_MAP[unitLower]) });
        if (between) tokens.push({ kind:'ws', text:between, cls:'' });
        tokens.push({ kind:'unitTag', text:unit, cls:'tok-curr' });
        p += m[0].length; continue;
      }
      // не спец-единица — берём только число, единицу разберём как слово
      tokens.push({ kind:'num', text:numStr, cls:'tok-num', val: mkNum(num2float(numStr)) });
      p += numStr.length; continue;
    }

    // Голое число
    RX.num.lastIndex = p;
    if ((m = RX.num.exec(line)) && m.index === p) {
      tokens.push({ kind:'num', text:m[0], cls:'tok-num', val: mkNum(num2float(m[0])) });
      p += m[0].length; continue;
    }

    RX.op2.lastIndex = p;
    if ((m = RX.op2.exec(line)) && m.index === p) {
      tokens.push({ kind:'op', text:'**', cls:'tok-op', val:'**' }); p += 2; continue;
    }

    RX.op.lastIndex = p;
    if ((m = RX.op.exec(line)) && m.index === p) {
      const v = m[0] === '^' ? '**' : m[0];
      tokens.push({ kind:'op', text:m[0], cls:'tok-op', val:v }); p += 1; continue;
    }

    RX.paren.lastIndex = p;
    if ((m = RX.paren.exec(line)) && m.index === p) {
      tokens.push({ kind: m[0]==='(' ? 'lp' : 'rp', text:m[0], cls:'tok-paren' }); p += 1; continue;
    }

    RX.curr.lastIndex = p;
    if ((m = RX.curr.exec(line)) && m.index === p) {
      // одиночный символ валюты (например $50 уже поймал numUnit; здесь — отдельный)
      tokens.push({ kind:'currSym', text:m[0], cls:'tok-curr', cur: CURRENCY_MAP[m[0]] }); p += 1; continue;
    }

    RX.word.lastIndex = p;
    if ((m = RX.word.exec(line)) && m.index === p) {
      const word = m[0];
      const info = classifyWord(word, varNames);
      tokens.push({ kind:'word', text:word, cls:info.cls, role:info.role, key:info.key, word });
      p += word.length; continue;
    }

    // прочее
    RX.other.lastIndex = p;
    if ((m = RX.other.exec(line)) && m.index === p) {
      tokens.push({ kind:'other', text:m[0], cls:'' }); p += 1; continue;
    }
    p++; // safety
  }

  return { tokens, defName };
}

/* =========================
   ПОДГОТОВКА ТОКЕНОВ К ВЫЧИСЛЕНИЮ
   Превращаем «сырые» токены в вычислительные, попутно помечаем ошибки
   (неизвестные слова, неопределённые переменные).
   Возвращает { calc, errorIdx } — calc для парсера, errorIdx для подсветки.
   ========================= */

function buildCalcTokens(rawTokens, variables, varNames) {
  const calc = [];
  const errorIdx = new Set();

  // Пропускаем префикс определения переменной (vardef + eq) в начале
  let startFrom = 0;
  if (rawTokens.length && rawTokens.find(t => t.kind === 'vardef')) {
    for (let k = 0; k < rawTokens.length; k++) {
      if (rawTokens[k].kind === 'eq') { startFrom = k + 1; break; }
    }
  }

  for (let idx = startFrom; idx < rawTokens.length; idx++) {
    const t = rawTokens[idx];

    switch (t.kind) {
      case 'ws':
      case 'comment':
      case 'unitTag': // единица уже учтена в значении числа
        break;

      case 'num':
        calc.push({ kind: 'num', val: t.val });
        break;

      case 'op':
        calc.push({ kind: 'op', val: t.val });
        break;

      case 'lp': calc.push({ kind: 'lp' }); break;
      case 'rp': calc.push({ kind: 'rp' }); break;

      case 'percent':
        // n% → (n/100): просто число-доля
        calc.push({ kind: 'num', val: mkNum(t.val) });
        break;

      case 'percentOf':
        // «n% от» → (n/100) * ...  → разворачиваем в lp num/100 rp * lp ... rp
        // Реализуем как: ( n/100 ) *  — далее идёт операнд
        calc.push({ kind: 'lp' });
        calc.push({ kind: 'num', val: mkNum(t.val) });
        calc.push({ kind: 'rp' });
        calc.push({ kind: 'op', val: '*' });
        break;

      case 'currSym':
        // одиночный символ валюты применяется к следующему числу
        // ищем следующее число вперёд
        for (let j = idx + 1; j < rawTokens.length; j++) {
          if (rawTokens[j].kind === 'ws') continue;
          if (rawTokens[j].kind === 'num' && isNum(rawTokens[j].val)) {
            if (!rawTokens[j].val.cur) rawTokens[j].val.cur = t.cur;
          }
          break;
        }
        break;

      case 'word': {
        if (t.role === 'fn') {
          calc.push({ kind: 'fn', val: t.key });
        } else if (t.role === 'const') {
          calc.push({ kind: 'num', val: mkNum(t.key === 'pi' ? Math.PI : Math.E) });
        } else if (t.role === 'dateword') {
          const now = new Date();
          if (t.key === 'now') calc.push({ kind: 'num', val: mkDate(now) });
          else calc.push({ kind: 'num', val: mkDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())) });
        } else if (t.role === 'wordop') {
          calc.push({ kind: 'op', val: t.key });
        } else if (t.role === 'var') {
          const v = variables[t.word];
          if (v === undefined) {
            // переменная объявлена ниже / ещё не вычислена
            errorIdx.add(idx);
            calc.push({ kind: 'err' });
          } else {
            calc.push({ kind: 'num', val: v });
          }
        } else if (t.role === 'unit' || t.role === 'curr') {
          // одиночная единица/валюта без числа — игнор в вычислении
        } else if (t.role === 'keyword') {
          // ключевое слово ИТОГ внутри строки — не операнд
        } else {
          // unknown — подсветим как ошибку, ТОЛЬКО если строка является выражением
          // (для текстовых заметок без чисел/операторов ошибку не показываем — см. ниже)
          errorIdx.add(idx);
          calc.push({ kind: 'err' });
        }
        break;
      }

      default: break;
    }
  }

  // Неявное сложение совместимых значений, идущих подряд:
  // "1ч 30мин" -> "1ч + 30мин",  "09:30 + 1ч 15мин" -> ... 1ч + 15мин
  const merged = [];
  for (let k = 0; k < calc.length; k++) {
    const cur = calc[k];
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === 'num' && cur.kind === 'num') {
      // оба операнда подряд — вставляем + ТОЛЬКО для длительностей
      const a = prev.val, b = cur.val;
      const bothDur = isDur(a) && isDur(b);
      if (bothDur) {
        merged.push({ kind: 'op', val: '+' });
      } else {
        // несовместимая склейка чисел подряд — это ошибка выражения
        merged.push({ kind: 'op', val: '__bad__' }); // помечаем
      }
    }
    merged.push(cur);
  }
  // если появился __bad__ — выражение некорректно
  const hasBad = merged.some(t => t.kind === 'op' && t.val === '__bad__');

  return { calc: merged, errorIdx, badAdjacency: hasBad };
}

/* =========================
   PARSER (Shunting-yard → RPN)
   ========================= */

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '**': 3, 'u-': 4 };
const RIGHT_ASSOC = { '**': true, 'u-': true };

function toRPN(tokens) {
  const out = [];
  const stack = [];
  let prevKind = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'num' || t.kind === 'err') { out.push(t); prevKind = 'num'; }
    else if (t.kind === 'fn') { stack.push(t); prevKind = 'fn'; }
    else if (t.kind === 'op') {
      let op = t.val;
      if (op === '-' && (prevKind === null || prevKind === 'op' || prevKind === 'lp' || prevKind === 'fn')) {
        op = 'u-';
      } else if (op === '+' && (prevKind === null || prevKind === 'op' || prevKind === 'lp' || prevKind === 'fn')) {
        prevKind = 'op'; continue;
      }
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.kind === 'op' || top.kind === 'unary') {
          const topOp = top.val;
          if (RIGHT_ASSOC[op] ? PREC[topOp] > PREC[op] : PREC[topOp] >= PREC[op]) {
            out.push(stack.pop());
          } else break;
        } else if (top.kind === 'fn') {
          out.push(stack.pop());
        } else break;
      }
      stack.push({ kind: op === 'u-' ? 'unary' : 'op', val: op });
      prevKind = 'op';
    }
    else if (t.kind === 'lp') { stack.push(t); prevKind = 'lp'; }
    else if (t.kind === 'rp') {
      while (stack.length && stack[stack.length - 1].kind !== 'lp') out.push(stack.pop());
      if (!stack.length) return null;
      stack.pop();
      if (stack.length && stack[stack.length - 1].kind === 'fn') out.push(stack.pop());
      prevKind = 'rp';
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.kind === 'lp' || top.kind === 'rp') return null;
    out.push(top);
  }
  return out;
}

/* =========================
   ОПЕРАЦИИ
   ========================= */

// Разница дат в целых днях (DST-безопасно)
function dateDiffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / MS_PER_DAY);
}
function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// Сигнал конфликта валют
const CURRENCY_CONFLICT = Symbol('currency-conflict');

function applyBinary(op, a, b) {
  if (isNum(a) && isNum(b)) {
    const cur = combineCurrency(a, b);
    if (cur === undefined) return CURRENCY_CONFLICT; // разные валюты
    switch (op) {
      case '+': return mkNum(a.n + b.n, cur);
      case '-': return mkNum(a.n - b.n, cur);
      // при умножении/делении валюту наследуем от той, у кого она есть
      case '*': return mkNum(a.n * b.n, a.cur || b.cur || null);
      case '/':
        if (b.n === 0) return null;
        return mkNum(a.n / b.n, a.cur && b.cur ? null : (a.cur || null));
      case '**': return mkNum(a.n ** b.n, null);
    }
  }
  if (isDur(a) && isDur(b)) {
    if (op === '+') return mkDur(a.s + b.s);
    if (op === '-') return mkDur(a.s - b.s);
    if (op === '/') return mkNum(a.s / b.s);
    return null;
  }
  if (isDur(a) && isNum(b)) {
    if (op === '*') return mkDur(a.s * b.n);
    if (op === '/') return mkDur(a.s / b.n);
    return null;
  }
  if (isNum(a) && isDur(b)) {
    if (op === '*') return mkDur(a.n * b.s);
    return null;
  }
  if (isTime(a) && isDur(b)) {
    if (op === '+') return mkTime(0, 0, a.s + b.s);
    if (op === '-') return mkTime(0, 0, a.s - b.s);
    return null;
  }
  if (isDur(a) && isTime(b) && op === '+') return mkTime(0, 0, a.s + b.s);
  if (isTime(a) && isTime(b) && op === '-') return mkDur(a.s - b.s);
  if (isTime(a) && isTime(b) && op === '+') return mkDur(a.s + b.s);
  if (isDate(a) && isDur(b)) {
    if (op === '+') return mkDate(addDays(a.d, b.s / 86400));
    if (op === '-') return mkDate(addDays(a.d, -b.s / 86400));
    return null;
  }
  if (isDur(a) && isDate(b) && op === '+') return mkDate(addDays(b.d, a.s / 86400));
  if (isDate(a) && isNum(b)) {
    if (op === '+') return mkDate(addDays(a.d, b.n));
    if (op === '-') return mkDate(addDays(a.d, -b.n));
    return null;
  }
  if (isNum(a) && isDate(b) && op === '+') return mkDate(addDays(b.d, a.n));
  // дата - дата → целые дни
  if (isDate(a) && isDate(b) && op === '-') return mkDur(dateDiffDays(a.d, b.d) * 86400);
  return null;
}

function applyUnary(op, a) {
  if (op === 'u-') {
    if (isNum(a)) return mkNum(-a.n, a.cur);
    if (isDur(a)) return mkDur(-a.s);
    return null;
  }
  return null;
}

function applyFunction(fn, a) {
  if (!isNum(a)) return null;
  const f = FUNCTIONS[fn];
  if (!f) return null;
  const v = f(a.n);
  if (typeof v !== 'number' || !isFinite(v)) return null;
  return mkNum(v, a.cur);
}

const EVAL_ERROR = Symbol('eval-error');

function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (t.kind === 'err') return EVAL_ERROR; // неизвестная переменная/слово
    if (t.kind === 'num') st.push(t.val);
    else if (t.kind === 'op') {
      if (st.length < 2) return null;
      const b = st.pop(), a = st.pop();
      const r = applyBinary(t.val, a, b);
      if (r === CURRENCY_CONFLICT) return CURRENCY_CONFLICT;
      if (r === null || r === undefined) return null;
      st.push(r);
    } else if (t.kind === 'unary') {
      if (!st.length) return null;
      const r = applyUnary(t.val, st.pop());
      if (r === null) return null;
      st.push(r);
    } else if (t.kind === 'fn') {
      if (!st.length) return null;
      const r = applyFunction(t.val, st.pop());
      if (r === null) return null;
      st.push(r);
    }
  }
  if (st.length !== 1) return null;
  return st[0];
}

/**
 * Вычисляет строку из уже разобранных токенов.
 * Возвращает { value, status, errorIdx }
 *   status: 'ok' | 'note' | 'error' | 'currency'
 */
function evaluateTokens(rawTokens, variables, varNames) {
  const { calc, errorIdx, badAdjacency } = buildCalcTokens(rawTokens, variables, varNames);

  const hasNum = calc.some(t => t.kind === 'num' || t.kind === 'err');
  const hasOp  = calc.some(t => t.kind === 'op' || t.kind === 'fn');

  if (!hasNum) return { value: null, status: 'note', errorIdx: new Set() };
  if (errorIdx.size > 0) return { value: null, status: 'error', errorIdx };
  if (badAdjacency)     return { value: null, status: 'error', errorIdx: new Set() };

  if (!hasOp) {
    const only = calc.filter(t => t.kind === 'num');
    if (only.length === 1) return { value: only[0].val, status: 'ok', errorIdx };
  }

  const rpn = toRPN(calc);
  if (!rpn) return { value: null, status: 'error', errorIdx: new Set() };

  let res;
  try { res = evalRPN(rpn); } catch { res = null; }

  if (res === CURRENCY_CONFLICT) return { value: null, status: 'currency', errorIdx };
  if (res === EVAL_ERROR)        return { value: null, status: 'error', errorIdx };
  if (res === null || res === undefined) return { value: null, status: 'error', errorIdx: new Set() };

  return { value: res, status: 'ok', errorIdx };
}

/* =========================
   ПЕРЕМЕННЫЕ / РЕЗЕРВ
   ========================= */

const RESERVED = new Set([
  ...FN_NAMES, 'pi', 'e', 'today', 'now', 'сегодня',
  ...TOTAL_KEYWORDS,
  ...Object.keys(WORD_OPERATORS),
  ...Object.keys(TIME_UNITS),
  ...Object.keys(CURRENCY_MAP),
]);

/* =========================
   ИТОГ
   ========================= */

function isTotalRow(rawTokens) {
  // строка-итог: есть ключевое слово ИТОГ и нет чисел/операторов кроме него
  const hasKeyword = rawTokens.some(t => t.kind === 'word' && t.role === 'keyword');
  if (!hasKeyword) return false;
  const hasNum = rawTokens.some(t => t.kind === 'num' || t.kind === 'percent' || t.kind === 'percentOf');
  const hasOp  = rawTokens.some(t => t.kind === 'op');
  return !hasNum || !hasOp;
}

function sumValues(values) {
  const nums = [], durs = [];
  let cur = null, conflict = false;
  for (const v of values) {
    if (isNum(v)) {
      nums.push(v.n);
      if (v.cur) { if (cur && cur !== v.cur) conflict = true; else cur = v.cur; }
    } else if (isDur(v)) durs.push(v.s);
  }
  if (!nums.length && !durs.length) return null;
  if (durs.length > nums.length) return mkDur(durs.reduce((a,x)=>a+x,0));
  if (nums.length) return mkNum(nums.reduce((a,x)=>a+x,0), conflict ? null : cur);
  return mkDur(durs.reduce((a,x)=>a+x,0));
}

/* =========================
   ФОРМАТИРОВАНИЕ
   ========================= */

function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  const rounded = Math.round(n * 1e10) / 1e10;
  if (Number.isInteger(rounded)) return rounded.toString();
  let str = rounded.toString();
  if (str.length > 12) str = rounded.toPrecision(8).replace(/\.?0+$/, '');
  return str;
}
// Сегменты числа: цифры (tok-num) отдельно от валютного знака/кода (tok-curr).
function numberSegments(n, currency) {
  const num = formatNumber(n);
  if (!currency) return [{ text: num, cls: 'tok-num' }];
  if ('$€£¥'.includes(currency))
    return [{ text: currency, cls: 'tok-curr' }, { text: num, cls: 'tok-num' }];
  return [{ text: num, cls: 'tok-num' }, { text: ' ', cls: '' }, { text: currency, cls: 'tok-curr' }];
}
function formatWithCurrency(n, currency) {
  return numberSegments(n, currency).map(s => s.text).join('');
}
const pad2 = n => n < 10 ? '0' + n : '' + n;

// Сегменты длительности: цифры (tok-num) отдельно от единиц (д/ч/мин/с → tok-time).
function durationSegments(seconds) {
  const segs = [];
  if (seconds < 0) segs.push({ text: '-', cls: '' });
  let s = Math.abs(seconds);
  if (s < 60) {
    segs.push({ text: formatNumber(s), cls: 'tok-num' });
    segs.push({ text: ' сек', cls: 'tok-time' });
    return segs;
  }
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const minutes = Math.floor(s / 60); s -= minutes * 60;
  const secs = Math.round(s * 1000) / 1000;
  const parts = [];
  if (days)    parts.push([String(days), 'д']);
  if (hours)   parts.push([String(hours), 'ч']);
  if (minutes) parts.push([String(minutes), 'мин']);
  if (secs)    parts.push([formatNumber(secs), 'с']);
  if (!parts.length) { segs.push({ text: '0', cls: 'tok-num' }); return segs; }
  parts.forEach((p, i) => {
    if (i) segs.push({ text: ' ', cls: '' });
    segs.push({ text: p[0], cls: 'tok-num' });
    segs.push({ text: p[1], cls: 'tok-time' });
  });
  return segs;
}
function formatDuration(seconds) {
  return durationSegments(seconds).map(s => s.text).join('');
}
function formatTime(t) {
  const total = Math.round(t.s);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  let base = sec ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}` : `${pad2(h)}:${pad2(m)}`;
  // переполнение суток
  if (t.dayOverflow) base += (t.dayOverflow > 0 ? ' +' : ' ') + t.dayOverflow + 'д';
  return base;
}
function formatDate(d) {
  const date = d.d;
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}
function formatValue(v) {
  if (isNum(v))  return formatWithCurrency(v.n, v.cur);
  if (isDur(v))  return formatDuration(v.s);
  if (isTime(v)) return formatTime(v);
  if (isDate(v)) return formatDate(v);
  return '—';
}
// Значение → массив сегментов { text, cls } для подсветки в колонке результатов.
// cls = '' для нейтральных цифр; tok-curr / tok-time / tok-date для единиц.
// Конкатенация text'ов сегментов всегда равна formatValue(v).
function formatValueSegments(v) {
  if (isNum(v))  return numberSegments(v.n, v.cur);
  if (isDur(v))  return durationSegments(v.s);
  if (isTime(v)) return [{ text: formatTime(v), cls: 'tok-time' }];
  if (isDate(v)) return [{ text: formatDate(v), cls: 'tok-date' }];
  return [{ text: '—', cls: '' }];
}
function valueClass(v) {
  if (isDur(v) || isTime(v) || isDate(v)) return 'result-time';
  return '';
}

/* =========================
   HTML-ЭКРАНИРОВАНИЕ
   ========================= */
const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ESC_MAP[c]); }

/* =========================
   РЕНДЕР ПОДСВЕТКИ из тех же токенов
   errorIdx — индексы токенов, которые надо подсветить как ошибку
   ========================= */
function renderHighlightLine(rawTokens, errorIdx) {
  let html = '';
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    const esc = escapeHtml(t.text);
    let cls = t.cls;
    if (errorIdx && errorIdx.has(i)) cls = 'tok-error';
    if (cls) html += '<span class="' + cls + '">' + esc + '</span>';
    else html += esc;
  }
  return html === '' ? ' ' : html;
}

/* =========================
   ВЫЧИСЛЕНИЕ ВСЕГО ДОКУМЕНТА (без DOM)
   Единый источник правды для UI и тестов: разбирает многострочный текст,
   ведёт область переменных, считает ИТОГ-строки.
   Возвращает массив строк-описаний:
     { kind:'none'|'number'|'assign'|'total', value, status, defName,
       tokens, errorIdx }
   ========================= */
function computeRows(text) {
  const lines = text.split('\n');

  const variables = {};
  const varNames = new Set();
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Пустая строка
    if (!line.trim()) {
      rows.push({ kind: 'none', value: null, status: 'empty', defName: null,
        tokens: [], errorIdx: null, line });
      continue;
    }

    const { tokens, defName } = tokenizeLine(line, varNames);

    // ИТОГ
    if (isTotalRow(tokens)) {
      const valuesAbove = [];
      for (let j = i - 1; j >= 0; j--) {
        if (rows[j].kind === 'total') break;
        if ((rows[j].kind === 'number' || rows[j].kind === 'assign') && rows[j].value !== null) {
          valuesAbove.push(rows[j].value);
        }
      }
      const sum = sumValues(valuesAbove);
      if (sum !== null) {
        rows.push({ kind: 'total', value: sum, status: 'ok', defName: null,
          tokens, errorIdx: null, line });
      } else {
        rows.push({ kind: 'none', value: null, status: 'total-empty', defName: null,
          tokens, errorIdx: null, line });
      }
      continue;
    }

    // Вычисляем
    const { value, status, errorIdx } = evaluateTokens(tokens, variables, varNames);

    if (defName) {
      // присваивание
      if (status === 'ok' && value !== null) {
        variables[defName] = value;
        varNames.add(defName);
        rows.push({ kind: 'assign', value, status, defName, tokens, errorIdx, line });
      } else {
        rows.push({ kind: 'none', value: null, status, defName, tokens, errorIdx, line });
      }
    } else {
      // обычное выражение / заметка
      if (status === 'ok' && value !== null) {
        rows.push({ kind: 'number', value, status, defName: null, tokens, errorIdx, line });
      } else {
        rows.push({ kind: 'none', value: null, status, defName: null, tokens, errorIdx, line });
      }
    }
  }

  return rows;
}

/* =========================
   ЭКСПОРТ
   ========================= */
return {
  // константы / справочники
  WORD_OPERATORS, FUNCTIONS, FN_NAMES, CURRENCY_MAP, TIME_UNITS,
  CONST_WORDS, DATE_WORDS, TOTAL_KEYWORDS, RESERVED, MS_PER_DAY,
  // конструкторы / предикаты типов
  mkNum, mkDur, mkTime, mkDate,
  isNum, isDur, isTime, isDate,
  combineCurrency,
  // токенизация
  num2float, classifyWord, tokenizeLine, buildCalcTokens,
  // парсер / вычисление
  toRPN, applyBinary, applyUnary, applyFunction, evalRPN, evaluateTokens,
  // даты
  dateDiffDays, addDays,
  // ИТОГ
  isTotalRow, sumValues,
  // форматирование / рендер
  formatNumber, formatWithCurrency, formatDuration, formatTime,
  formatDate, formatValue, valueClass, escapeHtml, renderHighlightLine,
  numberSegments, durationSegments, formatValueSegments,
  // документ целиком
  computeRows,
  // символы-сигналы (для тонких тестов)
  CURRENCY_CONFLICT, EVAL_ERROR,
};

});
