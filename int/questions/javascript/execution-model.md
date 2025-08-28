# Модель выполнения JavaScript

## 📋 Вопрос

Объясните модель выполнения JavaScript: стек вызовов, очередь макро- и микрозадач, промисы и async/await. Как распределяются setTimeout(0), queueMicrotask, Promise.then, requestAnimationFrame? Какие есть типичные ловушки порядка вывода?

## 💡 Ответ

Модель выполнения JavaScript — это сложная система, включающая стек вызовов, event loop, и различные очереди задач. Понимание этой модели критично для написания предсказуемого асинхронного кода.

### Архитектура выполнения

#### Основные компоненты

```javascript
// Концептуальная диаграмма модели выполнения:
/*
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Call Stack    │    │   Web APIs       │    │ Task Queues     │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ • setTimeout     │    │ • Macrotasks    │
│ │ Function 3  │ │    │ • fetch          │    │ • Microtasks    │
│ ├─────────────┤ │    │ • DOM events     │    │ • Animation     │
│ │ Function 2  │ │    │ • etc.           │    │   frames        │
│ ├─────────────┤ │    │                  │    │                 │
│ │ Function 1  │ │    │                  │    │                 │
│ └─────────────┘ │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │       Event Loop          │
                    │                           │
                    │ Координирует выполнение   │
                    │ между стеком и очередями  │
                    └───────────────────────────┘
*/
```

#### Стек вызовов (Call Stack)

```javascript
function first() {
  console.log('First');
  second();
  console.log('First End');
}

function second() {
  console.log('Second');
  third();
  console.log('Second End');
}

function third() {
  console.log('Third');
}

first();

// Call Stack в процессе выполнения:
// 1. [first]
// 2. [first, second]
// 3. [first, second, third]
// 4. [first, second] (third завершена)
// 5. [first] (second завершена)
// 6. [] (first завершена)

// Вывод:
// First
// Second
// Third
// Second End
// First End
```

### Очереди задач

#### Macrotasks (Task Queue)

```javascript
// Macrotasks включают:
// - setTimeout/setInterval
// - setImmediate (Node.js)
// - I/O operations
// - UI rendering
// - DOM events

console.log('1'); // Синхронно

setTimeout(() => {
  console.log('2'); // Macrotask
}, 0);

setTimeout(() => {
  console.log('3'); // Macrotask
}, 0);

console.log('4'); // Синхронно

// Порядок: 1, 4, 2, 3
```

#### Microtasks (Job Queue)

```javascript
// Microtasks включают:
// - Promise.then/catch/finally
// - queueMicrotask
// - MutationObserver
// - process.nextTick (Node.js)

console.log('1'); // Синхронно

Promise.resolve().then(() => {
  console.log('2'); // Microtask
});

queueMicrotask(() => {
  console.log('3'); // Microtask
});

setTimeout(() => {
  console.log('4'); // Macrotask
}, 0);

console.log('5'); // Синхронно

// Порядок: 1, 5, 2, 3, 4
// Все microtasks выполняются перед любой macrotask
```

### Детальное распределение задач

#### setTimeout(0) vs queueMicrotask vs Promise.then

```javascript
console.log('=== Start ===');

// Macrotask
setTimeout(() => console.log('setTimeout 0'), 0);

// Microtask
queueMicrotask(() => console.log('queueMicrotask'));

// Microtask
Promise.resolve().then(() => console.log('Promise.then'));

// Microtask (более высокий приоритет в Node.js)
if (typeof process !== 'undefined') {
  process.nextTick(() => console.log('nextTick'));
}

console.log('=== End ===');

/* Вывод:
=== Start ===
=== End ===
nextTick (только в Node.js)
queueMicrotask
Promise.then
setTimeout 0
*/
```

#### requestAnimationFrame

```javascript
console.log('1'); // Синхронно

requestAnimationFrame(() => {
  console.log('2'); // Animation frame (перед рендером)
});

setTimeout(() => {
  console.log('3'); // Macrotask
}, 0);

Promise.resolve().then(() => {
  console.log('4'); // Microtask
});

console.log('5'); // Синхронно

/* В браузере обычно:
1
5
4
2
3

requestAnimationFrame выполняется перед рендером,
но после microtasks
*/
```

### Event Loop алгоритм

```javascript
// Псевдокод Event Loop:
/*
while (eventLoop.waitForTask()) {
  const task = eventLoop.nextTask();
  execute(task);
  
  // Выполняем ВСЕ microtasks
  while (microtaskQueue.hasTasks()) {
    const microtask = microtaskQueue.nextMicrotask();
    execute(microtask);
  }
  
  // Рендеринг (если необходимо)
  if (shouldRender()) {
    // Animation callbacks
    runAnimationCallbacks();
    render();
  }
}
*/

// Практический пример:
function demonstrateEventLoop() {
  console.log('Script start');
  
  setTimeout(() => console.log('setTimeout 1'), 0);
  
  Promise.resolve().then(() => {
    console.log('Promise 1');
    // Добавляем еще одну microtask
    return Promise.resolve();
  }).then(() => {
    console.log('Promise 2');
  });
  
  setTimeout(() => console.log('setTimeout 2'), 0);
  
  console.log('Script end');
}

demonstrateEventLoop();

/* Подробный порядок выполнения:
1. Script start (синхронно)
2. Script end (синхронно)
3. Promise 1 (microtask)
4. Promise 2 (microtask, добавлена из Promise 1)
5. setTimeout 1 (macrotask)
6. setTimeout 2 (macrotask)
*/
```

### Сложные сценарии

#### Рекурсивные microtasks

```javascript
// ❌ Опасно: может заблокировать event loop
function recursiveMicrotask() {
  Promise.resolve().then(() => {
    console.log('Microtask');
    recursiveMicrotask(); // Бесконечная рекурсия microtasks
  });
}

// Этот код заблокирует браузер, так как macrotasks никогда не выполнятся

// ✅ Правильно: с ограничением
function safeRecursiveMicrotask(count = 0) {
  if (count < 5) {
    Promise.resolve().then(() => {
      console.log('Microtask', count);
      safeRecursiveMicrotask(count + 1);
    });
  }
}
```

#### Смешанные async/await и промисы

```javascript
async function complexAsyncFlow() {
  console.log('1');
  
  // Microtask
  await Promise.resolve();
  console.log('2');
  
  // Еще один microtask
  await Promise.resolve();
  console.log('3');
  
  // Macrotask
  setTimeout(() => console.log('4'), 0);
  
  // Microtask
  await Promise.resolve();
  console.log('5');
}

console.log('Start');
complexAsyncFlow();
console.log('End');

/* Порядок:
Start
1
End
2
3
5
4
*/
```

### Типичные ловушки

#### 1. Порядок в циклах

```javascript
// ❌ Неожиданное поведение
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log('setTimeout', i), 0);
  Promise.resolve().then(() => console.log('Promise', i));
}

/* Вывод:
Promise 0
Promise 1
Promise 2
setTimeout 0
setTimeout 1
setTimeout 2

Все промисы выполняются перед любым setTimeout
*/
```

#### 2. Async функции в циклах

```javascript
const urls = ['/api/1', '/api/2', '/api/3'];

// ❌ Последовательное выполнение
async function fetchSequential() {
  const results = [];
  for (const url of urls) {
    const data = await fetch(url);
    results.push(data);
  }
  return results;
}

// ✅ Параллельное выполнение
async function fetchParallel() {
  const promises = urls.map(url => fetch(url));
  return Promise.all(promises);
}

// ❌ Смешанное (частая ошибка)
async function fetchMixed() {
  const results = [];
  urls.forEach(async (url) => {
    const data = await fetch(url); // await не ждется в forEach
    results.push(data);
  });
  return results; // Возвращает пустой массив!
}
```

#### 3. Promise constructors vs static methods

```javascript
// Разное поведение с ошибками
console.log('1');

// Immediate microtask
Promise.resolve().then(() => {
  console.log('2');
  throw new Error('Error in then');
}).catch(() => {
  console.log('3');
});

// Macrotask
setTimeout(() => {
  console.log('4');
  throw new Error('Error in setTimeout'); // Uncaught!
}, 0);

console.log('5');

/* Порядок:
1
5
2
3
4
Error: Error in setTimeout (uncaught)
*/
```

### Применение в React

#### Race conditions в useEffect

```javascript
import React, { useState, useEffect } from 'react';

// ❌ Проблема с race condition
function BadComponent({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Быстрое переключение userId может вызвать race condition
    fetch(`/api/users/${userId}`)
      .then(response => response.json())
      .then(setUser); // Может установить устаревшие данные
  }, [userId]);
  
  return <div>{user?.name}</div>;
}

// ✅ Решение с флагом отмены
function GoodComponent({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    let isCancelled = false;
    
    fetch(`/api/users/${userId}`)
      .then(response => response.json())
      .then(userData => {
        if (!isCancelled) {
          setUser(userData);
        }
      });
    
    return () => {
      isCancelled = true;
    };
  }, [userId]);
  
  return <div>{user?.name}</div>;
}
```

#### Timing в React updates

```javascript
function TimingComponent() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    console.log('1 - Click handler start');
    
    setCount(c => c + 1); // Scheduled update
    console.log('2 - After setState');
    
    Promise.resolve().then(() => {
      console.log('3 - Promise.then'); // Microtask
    });
    
    setTimeout(() => {
      console.log('4 - setTimeout'); // Macrotask
    }, 0);
    
    console.log('5 - Click handler end');
  };
  
  console.log('6 - Render with count:', count);
  
  return <button onClick={handleClick}>Count: {count}</button>;
}

/* Порядок при клике:
6 - Render with count: 0
1 - Click handler start
2 - After setState
5 - Click handler end
3 - Promise.then
6 - Render with count: 1 (React update)
4 - setTimeout
*/
```

### Инструменты для отладки

#### Performance API

```javascript
function measureTiming() {
  performance.mark('start');
  
  setTimeout(() => {
    performance.mark('timeout');
    performance.measure('timeout-duration', 'start', 'timeout');
    
    const measure = performance.getEntriesByName('timeout-duration')[0];
    console.log(`Timeout took: ${measure.duration}ms`);
  }, 100);
  
  Promise.resolve().then(() => {
    performance.mark('promise');
    performance.measure('promise-duration', 'start', 'promise');
    
    const measure = performance.getEntriesByName('promise-duration')[0];
    console.log(`Promise took: ${measure.duration}ms`);
  });
}
```

#### Chrome DevTools

```javascript
// Использование console.time для измерения
console.time('total-operation');

console.time('sync-part');
// Синхронная операция
console.timeEnd('sync-part');

console.time('async-part');
Promise.resolve().then(() => {
  console.timeEnd('async-part');
  console.timeEnd('total-operation');
});
```

### Практические рекомендации

#### 1. Предотвращение блокировки UI

```javascript
// ❌ Блокирующая операция
function heavySync() {
  for (let i = 0; i < 10000000; i++) {
    // Тяжелые вычисления
  }
}

// ✅ Разбивка на части
async function heavyAsync() {
  const chunkSize = 100000;
  const total = 10000000;
  
  for (let i = 0; i < total; i += chunkSize) {
    // Обрабатываем чанк
    for (let j = i; j < Math.min(i + chunkSize, total); j++) {
      // Вычисления
    }
    
    // Позволяем event loop обработать другие задачи
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

#### 2. Оптимизация порядка операций

```javascript
// ✅ Оптимальный порядок для пользователя
function optimizedUserInteraction() {
  // 1. Немедленный UI feedback (синхронно)
  showLoadingState();
  
  // 2. Критические microtasks
  Promise.resolve().then(() => {
    updateCriticalUI();
  });
  
  // 3. Некритические операции в macrotasks
  setTimeout(() => {
    performAnalytics();
    prefetchData();
  }, 0);
}
```

### Senior-советы

1. **Понимайте приоритеты**: Microtasks > Animation frames > Macrotasks
2. **Избегайте бесконечных microtasks** - они блокируют рендеринг
3. **Используйте AbortController** для отмены запросов
4. **Профилируйте async код** с Performance API
5. **В React следите за race conditions** в useEffect
6. **Разбивайте тяжелые операции** на асинхронные чанки
7. **Тестируйте timing-зависимый код** с mock timers

### Debugging техники

```javascript
// Wrapper для отслеживания порядка выполнения
function trackExecution(name, fn) {
  console.log(`${name} scheduled`);
  return (...args) => {
    console.log(`${name} executing`);
    const result = fn(...args);
    console.log(`${name} completed`);
    return result;
  };
}

// Использование
setTimeout(trackExecution('timeout', () => {
  console.log('Timeout work');
}), 0);

Promise.resolve().then(trackExecution('promise', () => {
  console.log('Promise work');
}));

queueMicrotask(trackExecution('microtask', () => {
  console.log('Microtask work');
}));
```

## 🔗 Связанные темы

- [Event Loop, Microtasks и Macrotasks](event-loop.md)
- [Promises, Async/Await и Generators](async-programming.md)
- [Конкурентный рендеринг React 18](../react/concurrent-rendering.md)
- [useEffect и Side Effects](../react/use-effect.md)
