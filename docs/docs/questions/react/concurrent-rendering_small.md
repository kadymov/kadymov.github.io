# React 18 Concurrent Rendering - Senior Cheat Sheet (small)

## Основы

**Concurrent Rendering** = React может прерывать, приостанавливать и возобновлять рендеринг для поддержания отзывчивости UI

### Включение
```jsx
// React 17
ReactDOM.render(<App />, root);

// React 18 - включает concurrent features
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

### Приоритеты обновлений
1. **Высокий** - user interactions (click, input)
2. **Обычный** - загрузка данных
3. **Низкий** - аналитика, фоновые обновления (могут быть прерваны)

## useTransition

**Для обновлений состояния** - помечает обновления как "переходы" которые могут быть прерваны

```jsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();
  
  const handleSearch = (value) => {
    setQuery(value); // Высокий приоритет - немедленно
    
    startTransition(() => {
      setResults(expensiveSearch(value)); // Может быть прервано
    });
  };
  
  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <div>Searching...</div>}
      <div className={isPending ? 'opacity-50' : ''}>
        {results.map(r => <div key={r.id}>{r.title}</div>)}
      </div>
    </div>
  );
}
```

## useDeferredValue

**Для значений** - откладывает обновление значения до завершения более приоритетных обновлений

```jsx
import { useState, useDeferredValue, useMemo } from 'react';

function App() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  
  const results = useMemo(() => {
    return expensiveSearch(deferredQuery);
  }, [deferredQuery]);
  
  const isStale = query !== deferredQuery;
  
  return (
    <div>
      <input onChange={(e) => setQuery(e.target.value)} />
      <div className={isStale ? 'opacity-60' : ''}>
        <SearchResults query={deferredQuery} results={results} />
      </div>
    </div>
  );
}
```

## useTransition vs useDeferredValue

| | useTransition | useDeferredValue |
|---|---------------|------------------|
| **Для чего** | Обновлений состояния | Значений/props |
| **Контроль** | Полный (startTransition) | Автоматический |
| **Индикатор** | isPending флаг | Сравнение значений |
| **Использование** | Тяжелые setState | Производные значения |

```jsx
// useTransition - контролируем обновления
const [isPending, startTransition] = useTransition();
startTransition(() => setData(newData));

// useDeferredValue - автоматическая отсрочка
const deferredValue = useDeferredValue(value);
```

## Автоматический Batching

React 18 группирует ВСЕ обновления состояния, включая асинхронные

```jsx
// React 17 - НЕ батчится в async
setTimeout(() => {
  setCount(c => c + 1); // Рендер 1
  setFlag(f => !f);     // Рендер 2
});

// React 18 - батчится везде
setTimeout(() => {
  setCount(c => c + 1); // \
  setFlag(f => !f);     // / Один рендер
});

// Отключение батчинга при необходимости
import { flushSync } from 'react-dom';

flushSync(() => setCount(c => c + 1)); // Принудительный рендер
flushSync(() => setFlag(f => !f));     // Еще один рендер
```

## StrictMode изменения

В dev режиме StrictMode стал более строгим - **двойной рендеринг** и **двойной запуск эффектов**

```jsx
function Component() {
  useEffect(() => {
    console.log('Effect'); // Выполнится дважды в dev
    
    // ❌ Проблема - побочный эффект без cleanup
    window.counter = (window.counter || 0) + 1;
    
    return () => {
      console.log('Cleanup'); // Тоже выполнится
    };
  }, []);
}

// ✅ Правильная обработка
function FixedComponent() {
  useEffect(() => {
    let cancelled = false;
    
    fetchData().then(data => {
      if (!cancelled) setData(data); // Защита от race condition
    });
    
    return () => { cancelled = true; };
  }, []);
}
```

## Race Conditions - предотвращение

### Проблема
```jsx
// ❌ Race condition
function UserProfile({ userId }) {
  useEffect(() => {
    fetchUser(userId).then(setUser); // Ответы могут прийти не по порядку
  }, [userId]);
}
```

### Решение 1: Cancelled флаг
```jsx
useEffect(() => {
  let cancelled = false;
  
  fetchUser(userId).then(user => {
    if (!cancelled) setUser(user);
  });
  
  return () => { cancelled = true; };
}, [userId]);
```

### Решение 2: AbortController
```jsx
useEffect(() => {
  const controller = new AbortController();
  
  const loadUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        signal: controller.signal
      });
      const user = await response.json();
      setUser(user);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
      }
    }
  };
  
  loadUser();
  return () => controller.abort();
}, [userId]);
```

### Custom Hook для безопасных запросов
```jsx
function useAsyncData(asyncFn, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    
    const load = async () => {
      setLoading(true);
      try {
        const result = await asyncFn(controller.signal);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, deps);
  
  return { data, loading, error };
}

// Использование
const { data: user, loading, error } = useAsyncData(
  (signal) => fetch(`/api/users/${userId}`, { signal }).then(r => r.json()),
  [userId]
);
```

## Suspense интеграция

```jsx
function App() {
  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userId="123" />
    </Suspense>
  );
}

// С библиотеками поддерживающими Suspense
function UserProfile({ userId }) {
  const user = useSuspenseQuery(['user', userId], () => fetchUser(userId));
  return <div>{user.name}</div>;
}
```

## Лучшие практики

### Когда использовать useTransition
```jsx
// ✅ Хорошо - тяжелые обновления UI
startTransition(() => {
  setFilteredData(expensiveFilter(data)); // Фильтрация больших списков
  setSearchResults(expensiveSearch(query)); // Поиск
});

// ❌ Плохо - критические операции
startTransition(() => {
  submitForm(); // Должно быть немедленным!
});
```

### Когда использовать useDeferredValue
```jsx
// ✅ Хорошо - производные значения
const deferredQuery = useDeferredValue(searchQuery);
const results = useMemo(() => search(deferredQuery), [deferredQuery]);

// ❌ Плохо - простые значения
const deferredName = useDeferredValue(userName); // Излишне для простого отображения
```

## Миграция checklist

1. **createRoot** вместо ReactDOM.render
2. **StrictMode compatibility** - исправь побочные эффекты
3. **AbortController** для всех fetch запросов
4. **useTransition** для тяжелых обновлений
5. **useDeferredValue** для производных значений
6. **Тестируй в dev StrictMode** - найди проблемы заранее

## Senior Rules

1. **Постепенная миграция** - начни с createRoot
2. **useTransition для UI**, **useDeferredValue для значений**  
3. **AbortController always** - для всех async операций
4. **StrictMode в dev** - обязательно включай
5. **Не transition все** - только тяжелые операции
6. **Race condition protection** - используй cancelled флаги
7. **Профилируй с DevTools** - измеряй реальные улучшения
8. **Suspense границы** - для лучшего UX

**Главное**: Concurrent rendering = отзывчивость UI. Не блокируй main thread тяжелыми операциями!
