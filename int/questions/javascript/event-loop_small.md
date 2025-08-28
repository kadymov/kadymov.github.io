# Event Loop - Шпаргалка

## Ключевые компоненты
- **Call stack** - выполняется синхронный код
- **Microtask queue** - Promise.then, queueMicrotask (приоритет выше)
- **Macrotask queue** - setTimeout, setInterval, I/O

## Порядок выполнения
1. Выполнить все синхронные операции
2. Выполнить **все** microtasks
3. Рендеринг (браузер)
4. Выполнить **одну** macrotask
5. Повторить с п.2

## Базовый пример
```javascript
console.log('1');
setTimeout(() => console.log('2'), 0); // Macrotask
Promise.resolve().then(() => console.log('3')); // Microtask
console.log('4');
// Вывод: 1 4 3 2
```

## Senior-особенности

### React интеграция
- setState в Promise.then выполняется раньше setTimeout
- Batch updates в React 18 учитывают event loop
- useEffect cleanup может создать race conditions

### Node.js отличия
- `process.nextTick` имеет приоритет выше Promise.then
- setImmediate vs setTimeout(0) - порядок зависит от фазы

### Производительность
```javascript
// ❌ Блокирует UI
for (let i = 0; i < 1000000; i++) { /* работа */ }

// ✅ Разбивка на chunks
function workChunk(data, index = 0) {
  // Обработка части данных
  if (index < data.length) {
    setTimeout(() => workChunk(data, index + 1000), 0);
  }
}
```

## Частые ошибки
- Бесконечные microtasks блокируют рендеринг
- Глубокая рекурсия в Promise.then
- Неправильный порядок cleanup в useEffect

## Отладка
- Chrome DevTools Performance
- `performance.mark/measure`
- React DevTools Profiler
