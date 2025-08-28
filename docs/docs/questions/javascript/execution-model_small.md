# JavaScript Execution Model - Senior Cheat Sheet (small)

## Архитектура выполнения

**Call Stack** → **Event Loop** → **Task Queues**

### Приоритеты очередей
1. **Call Stack** (синхронный код)
2. **Microtasks** (Promise.then, queueMicrotask)
3. **Animation Frames** (requestAnimationFrame)
4. **Macrotasks** (setTimeout, events, I/O)

## Распределение задач

```javascript
console.log('1');                    // Синхронно
setTimeout(() => console.log('2'), 0);  // Macrotask
Promise.resolve().then(() => console.log('3'));  // Microtask
queueMicrotask(() => console.log('4'));  // Microtask
console.log('5');                    // Синхронно

// Порядок: 1, 5, 3, 4, 2
```

### Node.js специфика
```javascript
process.nextTick(() => console.log('1')); // Высший приоритет
Promise.resolve().then(() => console.log('2'));
queueMicrotask(() => console.log('3'));

// Node.js порядок: 1, 2, 3
```

## Event Loop алгоритм

```
while (eventLoop.running) {
  // 1. Выполнить одну macrotask
  executeMacrotask();
  
  // 2. Выполнить ВСЕ microtasks
  while (microtaskQueue.length) {
    executeMicrotask();
  }
  
  // 3. Рендеринг (если нужно)
  if (shouldRender()) {
    runAnimationCallbacks();
    render();
  }
}
```

## Типичные ловушки

### 1. Microtasks блокируют macrotasks
```javascript
// ❌ Бесконечная блокировка
function infiniteMicrotasks() {
  Promise.resolve().then(infiniteMicrotasks);
}

// ✅ С ограничением
function safeMicrotasks(count = 0) {
  if (count < 100) {
    Promise.resolve().then(() => safeMicrotasks(count + 1));
  }
}
```

### 2. Async/await порядок
```javascript
async function test() {
  console.log('1');
  await Promise.resolve();  // Microtask boundary
  console.log('2');
  await Promise.resolve();  // Еще одна microtask
  console.log('3');
}

console.log('start');
test();
console.log('end');

// Порядок: start, 1, end, 2, 3
```

### 3. Циклы с async
```javascript
// ❌ forEach с async не работает как ожидается
[1,2,3].forEach(async (x) => {
  await delay(100);
  console.log(x); // Все выполнятся параллельно
});

// ✅ for...of ждет каждую итерацию
for (const x of [1,2,3]) {
  await delay(100);
  console.log(x); // Последовательно
}

// ✅ Параллельное выполнение
await Promise.all([1,2,3].map(async (x) => {
  await delay(100);
  console.log(x);
}));
```

## React интеграция

### Race conditions в useEffect
```javascript
// ❌ Race condition
useEffect(() => {
  fetch(`/api/users/${userId}`)
    .then(r => r.json())
    .then(setUser); // Может быть устаревшим
}, [userId]);

// ✅ С отменой
useEffect(() => {
  let cancelled = false;
  
  fetch(`/api/users/${userId}`)
    .then(r => r.json())
    .then(user => !cancelled && setUser(user));
    
  return () => { cancelled = true; };
}, [userId]);
```

### Timing React updates
```javascript
const handleClick = () => {
  console.log('1 - Handler start');
  
  setCount(c => c + 1);  // Scheduled update
  console.log('2 - After setState');
  
  Promise.resolve().then(() => {
    console.log('3 - Microtask');
  });
  
  setTimeout(() => {
    console.log('4 - Macrotask');
  }, 0);
};

// Порядок: 1, 2, 3, React update, 4
```

## Performance паттерны

### Разбивка тяжелых операций
```javascript
// ❌ Блокирующая операция
for (let i = 0; i < 10000000; i++) {
  heavyWork(i);
}

// ✅ С yield для event loop
async function processInChunks(items, chunkSize = 1000) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(heavyWork);
    
    // Yield control to event loop
    await new Promise(r => setTimeout(r, 0));
  }
}
```

### Оптимальный порядок операций
```javascript
function optimizedFlow() {
  // 1. Немедленный UI feedback
  showLoading();
  
  // 2. Критические microtasks
  Promise.resolve().then(updateCriticalUI);
  
  // 3. Некритические macrotasks
  setTimeout(() => {
    analytics();
    prefetch();
  }, 0);
}
```

## Debugging техники

### Timing measurement
```javascript
console.time('operation');
performance.mark('start');

setTimeout(() => {
  performance.mark('end');
  performance.measure('duration', 'start', 'end');
  console.timeEnd('operation');
}, 100);
```

### Execution tracking
```javascript
function track(name, fn) {
  console.log(`${name} scheduled`);
  return (...args) => {
    console.log(`${name} executing`);
    return fn(...args);
  };
}

setTimeout(track('timeout', work), 0);
Promise.resolve().then(track('promise', work));
```

## Senior Rules

1. **Microtasks > Animation > Macrotasks** - запомни приоритеты
2. **Избегай бесконечных microtasks** - блокируют рендеринг
3. **AbortController** для отмены async операций
4. **Race conditions** - всегда думай о cleanup в React
5. **Chunking** для тяжелых операций
6. **Mock timers** в тестах для timing-dependent кода
7. **Performance API** для профилирования

## Anti-patterns

```javascript
// ❌ Неправильные паттерны
useEffect(async () => { ... });        // async useEffect
setInterval(() => {}, 0);              // Без cleanup
Promise.resolve().then(recursiveMicrotask); // Infinite microtasks
[].forEach(async () => {});            // async в forEach

// ❌ Блокировка event loop
while (heavyCondition()) {
  doWork(); // Синхронная тяжелая работа
}
```

**Главное**: Event Loop - это сердце JS. Понимай приоритеты, избегай блокировок, всегда думай о cleanup!
