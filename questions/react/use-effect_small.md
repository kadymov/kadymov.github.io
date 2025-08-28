# useEffect & Side Effects - Senior Cheat Sheet

## Основы

**useEffect** = Hook для побочных эффектов (side effects) в функциональных компонентах

### Базовый синтаксис
```jsx
// После каждого рендера
useEffect(() => {
  document.title = `Count: ${count}`;
});

// При изменении зависимостей
useEffect(() => {
  console.log('Count changed');
}, [count]);

// Только при монтировании
useEffect(() => {
  console.log('Mounted');
}, []);

// С cleanup
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer); // Cleanup
}, []);
```

## Жизненный цикл

### Mount (componentDidMount)
```jsx
useEffect(() => {
  fetchData().then(setData);
  
  return () => {
    // Cleanup при unmount
  };
}, []); // Пустой массив = только при монтировании
```

### Update (componentDidUpdate)
```jsx
useEffect(() => {
  if (userId) {
    fetchUser(userId).then(setUser);
  }
}, [userId]); // При изменении userId
```

### Unmount (componentWillUnmount)
```jsx
useEffect(() => {
  const handleResize = () => setWidth(window.innerWidth);
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize); // Cleanup
  };
}, []);
```

## Типичные ошибки

### 1. Бесконечные циклы
```jsx
// ❌ Бесконечный цикл
useEffect(() => {
  setData([1, 2, 3]); // Новый массив каждый рендер
}, [data]);

// ✅ Правильно
useEffect(() => {
  setData([1, 2, 3]);
}, []); // Пустые зависимости
```

### 2. Забытый cleanup
```jsx
// ❌ Memory leak
useEffect(() => {
  setInterval(() => {}, 1000); // Нет cleanup!
}, []);

// ✅ Правильно
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);
}, []);
```

### 3. Missing dependencies
```jsx
// ❌ ESLint exhaustive-deps предупреждение
useEffect(() => {
  fetchUser(userId); // userId не в зависимостях!
}, []);

// ✅ Правильно
useEffect(() => {
  if (userId) {
    fetchUser(userId);
  }
}, [userId]);
```

### 4. Async функции
```jsx
// ❌ Неправильно
useEffect(async () => {
  const data = await fetch('/api'); // Warning!
}, []);

// ✅ Правильно
useEffect(() => {
  const loadData = async () => {
    const data = await fetch('/api');
    setData(await data.json());
  };
  loadData();
}, []);
```

## Основные паттерны

### Data Fetching с cleanup
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchUser = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/${userId}`);
        const userData = await response.json();
        if (!cancelled) setUser(userData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    if (userId) fetchUser();
    return () => { cancelled = true; };
  }, [userId]);
  
  return loading ? <div>Loading...</div> : <div>{user?.name}</div>;
}
```

### AbortController для отмены запросов
```jsx
useEffect(() => {
  const controller = new AbortController();
  
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(err => err.name !== 'AbortError' && setError(err));
  
  return () => controller.abort();
}, []);
```

### WebSocket subscriptions
```jsx
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:8080/chat/${roomId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    setMessages(prev => [...prev, message]);
  };
  
  return () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}, [roomId]);
```

### Event Listeners
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setModalOpen(false);
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

## Custom Hooks

### useDebounce
```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}
```

### useAPI
```jsx
function useAPI(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!url) return;
    
    let cancelled = false;
    const controller = new AbortController();
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(url, { signal: controller.signal });
        const result = await response.json();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    fetchData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);
  
  return { data, loading, error };
}
```

### useLocalStorage
```jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || initialValue;
    } catch {
      return initialValue;
    }
  });
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  
  return [value, setValue];
}
```

## Performance оптимизация

### Мемоизация зависимостей
```jsx
function Component({ filters, sortBy }) {
  const [data, setData] = useState([]);
  
  // Стабильная ссылка на объект
  const queryParams = useMemo(() => ({
    ...filters,
    sortBy
  }), [filters, sortBy]);
  
  useEffect(() => {
    fetchData(queryParams).then(setData);
  }, [queryParams]);
  
  return <div>{data.length} items</div>;
}
```

## Тестирование

```jsx
import { renderHook, waitFor } from '@testing-library/react';

test('useAPI loads data', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ id: 1, name: 'Test' })
  });
  
  const { result } = renderHook(() => useAPI('/api/test'));
  
  expect(result.current.loading).toBe(true);
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ id: 1, name: 'Test' });
  });
});
```

## Альтернативы useEffect

```jsx
// Для вычислений - useMemo вместо useEffect
const expensiveValue = useMemo(() => 
  computeExpensive(data), [data]
);

// Для событий - useCallback
const handleClick = useCallback((id) => 
  onItemClick(id), [onItemClick]
);

// Для внешних подписок - useSyncExternalStore
const width = useSyncExternalStore(
  (callback) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  },
  () => window.innerWidth
);
```

## Senior Rules

1. **ESLint exhaustive-deps** - всегда следуй правилу
2. **Cleanup functions** - предотвращай memory leaks
3. **AbortController** для отмены fetch запросов
4. **Separate effects** - один эффект = одна ответственность
5. **Custom hooks** для переиспользования логики
6. **useMemo for objects** в зависимостях
7. **Race conditions** - защищайся флагами cancelled
8. **Conditional effects** - проверяй условия внутри эффекта

## Anti-patterns

```jsx
// ❌ Async useEffect
useEffect(async () => { ... });

// ❌ Мутация props/state
useEffect(() => {
  props.data.push(newItem); // Мутация!
});

// ❌ Эффекты без cleanup
useEffect(() => {
  setInterval(() => {}, 1000); // Leak!
}, []);

// ❌ Объекты в зависимостях без memo
useEffect(() => {
  fetchData({ filter: 'active' }); // Новый объект каждый рендер
}, [{ filter: 'active' }]);
```

**Главное**: useEffect для side effects только! Для вычислений используй useMemo, для событий - useCallback.
