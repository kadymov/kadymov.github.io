# Event Loop, Microtasks и Macrotasks

## 📋 Вопрос

Объясните механизм event loop в JavaScript, включая роль microtasks и macrotasks.

## 💡 Ответ

Event loop — это механизм в JavaScript (в runtime вроде V8 в Node.js или браузерах), который позволяет выполнять асинхронный код в однопоточном окружении. JavaScript однопоточный, но event loop делает его non-blocking, обрабатывая задачи из очередей.

### Основные компоненты

- **Call stack:** Стек вызовов, где выполняется синхронный код. Если стек пуст, event loop проверяет очереди.
- **Web APIs:** Асинхронные операции (setTimeout, fetch) регистрируются здесь и выполняются в фоне (в браузере — в отдельных потоках).
- **Task queue (macrotasks):** Очередь для macrotasks, таких как setTimeout, setInterval, I/O в Node.js, события DOM (click). Они добавляются после выполнения Web APIs.
- **Microtask queue:** Очередь для microtasks с более высоким приоритетом, таких как Promise.resolve().then(), process.nextTick (в Node.js), MutationObserver. Microtasks выполняются сразу после текущей macrotask, перед рендерингом.

### Как работает

Event loop крутится в цикле: проверяет call stack. Если пуст — берет microtasks и выполняет все до конца. Затем macrotasks — одну за раз. После macrotask снова microtasks, и так далее.

**Приоритет:** Microtasks > Rendering (в браузере) > Macrotasks.

### Пример выполнения

```javascript
console.log('1'); // Синхронно
setTimeout(() => console.log('2'), 0); // Macrotask
Promise.resolve().then(() => console.log('3')); // Microtask
console.log('4'); // Синхронно

// Вывод: 1 4 3 2
```

### Подробный анализ порядка выполнения

1. **console.log('1')** - синхронная операция, выполняется немедленно
2. **setTimeout** - добавляет callback в macrotask queue
3. **Promise.resolve().then()** - добавляет callback в microtask queue
4. **console.log('4')** - синхронная операция, выполняется немедленно
5. Call stack пуст, event loop проверяет microtask queue - выполняет Promise.then
6. Затем проверяет macrotask queue - выполняет setTimeout

### Сложный пример

```javascript
console.log('start');

setTimeout(() => console.log('timeout 1'), 0);
setTimeout(() => console.log('timeout 2'), 0);

Promise.resolve().then(() => {
  console.log('promise 1');
  return Promise.resolve();
}).then(() => {
  console.log('promise 2');
});

Promise.resolve().then(() => {
  console.log('promise 3');
});

console.log('end');

// Вывод: start end promise 1 promise 3 promise 2 timeout 1 timeout 2
```

### Важные концепции для React

На senior-уровне важно понимать, что это влияет на порядок выполнения в React:

- **useEffect с асинхронными вызовами** может вызывать race conditions
- **setState в Promise.then** выполняется раньше setTimeout
- **Batch updates** в React 18 учитывают event loop

### Оптимизация и лучшие практики

```javascript
// ❌ Плохо: блокирует UI
function heavyTask() {
  for (let i = 0; i < 1000000; i++) {
    // тяжелые вычисления
  }
}

// ✅ Хорошо: разбиваем на части
function heavyTaskAsync(start = 0) {
  const chunk = 10000;
  for (let i = start; i < start + chunk && i < 1000000; i++) {
    // тяжелые вычисления
  }
  
  if (start + chunk < 1000000) {
    setTimeout(() => heavyTaskAsync(start + chunk), 0);
  }
}
```

### Senior-советы

- Избегайте глубоких рекурсий в microtasks, чтобы не блокировать UI
- Используйте `performance.mark` для профилирования
- В Node.js `process.nextTick` имеет еще более высокий приоритет чем промисы
- Понимание event loop критично для отладки асинхронного кода

### Инструменты для анализа

- Chrome DevTools Performance tab
- `console.time` и `console.timeEnd`
- React DevTools Profiler для анализа рендеров

## 🔗 Связанные темы

- [Promises, Async/Await и Generators](async-programming.md)
- [useEffect и Side Effects](../react/use-effect.md)
- [Конкурентный рендеринг React 18](../react/concurrent-rendering.md)
