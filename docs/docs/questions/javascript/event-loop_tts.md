# Event Loop, Microtasks и Macrotasks (TTS)

Вопрос: Объясните механизм event loop в JavaScript, включая роль microtasks и macrotasks.

Event loop — это механизм в JavaScript, который позволяет выполнять асинхронный код в однопоточном окружении. JavaScript однопоточный, но event loop делает его неблокирующим, обрабатывая задачи из очередей.

Основные компоненты системы:

Первый компонент - Call stack или стек вызовов. Здесь выполняется синхронный код. Если стек пуст, event loop проверяет очереди.

Второй компонент - Web APIs. Асинхронные операции, такие как setTimeout и fetch, регистрируются здесь и выполняются в фоне в отдельных потоках браузера.

Третий компонент - Task queue или очередь macrotasks. Это очередь для macrotasks, таких как setTimeout, setInterval, операции ввода-вывода в Node.js, и события DOM. Они добавляются после выполнения Web APIs.

Четвертый компонент - Microtask queue или очередь microtasks. Это очередь для microtasks с более высоким приоритетом, таких как Promise.resolve().then(), process.nextTick в Node.js, и MutationObserver. Microtasks выполняются сразу после текущей macrotask, перед рендерингом.

Принцип работы Event Loop:

Event loop работает в постоянном цикле. Сначала он проверяет call stack. Если стек пуст, то берет все microtasks и выполняет их до конца. Затем переходит к macrotasks и выполняет одну за раз. После выполнения macrotask снова проверяет microtasks, и так далее.

Важно понимать приоритет: Microtasks имеют приоритет выше Rendering в браузере, который в свою очередь имеет приоритет выше Macrotasks.

Пример выполнения:

Когда мы пишем console.log с цифрой 1, это выполняется синхронно. Затем setTimeout с console.log цифры 2 добавляется в macrotask queue. Promise.resolve().then() с console.log цифры 3 добавляется в microtask queue. Четвертый console.log выполняется синхронно. В результате вывод будет: 1, 4, 3, 2.

Подробный анализ порядка выполнения:

Первым выполняется console.log с цифрой 1 как синхронная операция. Затем setTimeout добавляет callback в macrotask queue. Promise.resolve().then() добавляет callback в microtask queue. console.log с цифрой 4 выполняется синхронно. Когда call stack становится пустым, event loop проверяет microtask queue и выполняет Promise.then. Затем проверяет macrotask queue и выполняет setTimeout.

В более сложном примере с несколькими промисами и таймаутами порядок будет: start, end, promise 1, promise 3, promise 2, timeout 1, timeout 2.

Важные концепции для React:

На уровне senior разработчика важно понимать, что event loop влияет на порядок выполнения в React. useEffect с асинхронными вызовами может вызывать race conditions. setState в Promise.then выполняется раньше setTimeout. Batch updates в React 18 учитывают event loop.

Оптимизация и лучшие практики:

Избегайте блокирования UI тяжелыми вычислениями. Вместо выполнения тяжелой задачи сразу, разбивайте ее на части и используйте setTimeout для передачи управления между частями.

Советы для senior разработчиков:

Избегайте глубоких рекурсий в microtasks, чтобы не блокировать пользовательский интерфейс. Используйте performance.mark для профилирования производительности. В Node.js process.nextTick имеет еще более высокий приоритет чем промисы. Понимание event loop критично для отладки асинхронного кода.

Для анализа производительности можно использовать Chrome DevTools Performance tab, console.time и console.timeEnd, а также React DevTools Profiler для анализа рендеров.

Связанные темы: Promises, Async/Await и Generators, useEffect и Side Effects, Конкурентный рендеринг React 18.
