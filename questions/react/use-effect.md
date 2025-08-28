# useEffect и Side Effects

## 📋 Вопрос

Как обрабатывать side effects в React с помощью useEffect, и какие распространенные ошибки возникают при его использовании?

## 💡 Ответ

useEffect — это React Hook для выполнения побочных эффектов (side effects) в функциональных компонентах. Он объединяет функциональность componentDidMount, componentDidUpdate и componentWillUnmount из классовых компонентов.

### Основы useEffect

#### Базовый синтаксис

```javascript
import React, { useState, useEffect } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  // Эффект без зависимостей - выполняется после каждого рендера
  useEffect(() => {
    document.title = `Count: ${count}`;
  });
  
  // Эффект с зависимостями - выполняется только при изменении count
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);
  
  // Эффект с пустым массивом зависимостей - выполняется только при монтировании
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

#### Cleanup функции

```javascript
function TimerComponent() {
  const [seconds, setSeconds] = useState(0);
  
  useEffect(() => {
    // Setup
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    
    // Cleanup функция
    return () => {
      clearInterval(interval);
    };
  }, []); // Пустой массив - эффект выполняется только при монтировании
  
  return <div>Timer: {seconds}s</div>;
}
```

### Жизненный цикл с useEffect

#### Монтирование (componentDidMount)

```javascript
function ComponentDidMount() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Выполняется только при монтировании
    console.log('Component mounted');
    
    // Загрузка данных
    fetchData().then(setData);
    
    // Cleanup при размонтировании
    return () => {
      console.log('Component will unmount');
    };
  }, []); // Пустой массив зависимостей
  
  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>;
}
```

#### Обновление (componentDidUpdate)

```javascript
function ComponentDidUpdate({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Выполняется при изменении userId
    console.log('User ID changed:', userId);
    
    if (userId) {
      fetchUser(userId).then(setUser);
    }
  }, [userId]); // Эффект зависит от userId
  
  return user ? <div>User: {user.name}</div> : <div>No user</div>;
}
```

#### Размонтирование (componentWillUnmount)

```javascript
function EventListenerComponent() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    // Добавление event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup - удаление listener при размонтировании
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Эффект выполняется только при монтировании
  
  return <div>Window width: {windowWidth}px</div>;
}
```

### Типичные сценарии использования

#### 1. Загрузка данных

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isCancelled = false;
    
    const fetchUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const userData = await response.json();
        
        // Проверяем, не был ли компонент размонтирован
        if (!isCancelled) {
          setUser(userData);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    if (userId) {
      fetchUser();
    }
    
    // Cleanup
    return () => {
      isCancelled = true;
    };
  }, [userId]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user found</div>;
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

#### 2. Subscriptions и WebSocket

```javascript
function ChatComponent({ roomId }) {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    // Создание WebSocket соединения
    const ws = new WebSocket(`ws://localhost:8080/chat/${roomId}`);
    setSocket(ws);
    
    // Обработчики событий
    ws.onopen = () => {
      console.log('Connected to chat');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // Cleanup
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId]);
  
  const sendMessage = (text) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ text, timestamp: Date.now() }));
    }
  };
  
  return (
    <div>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>{msg.text}</div>
        ))}
      </div>
      <input 
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
```

#### 3. Локальное хранилище

```javascript
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });
  
  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };
  
  // Синхронизация с localStorage при изменениях в других вкладках
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);
  
  return [storedValue, setValue];
}

// Использование
function SettingsComponent() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
    </div>
  );
}
```

### Распространенные ошибки

#### 1. Бесконечные циклы

```javascript
// ❌ Плохо: бесконечный цикл
function BadExample() {
  const [count, setCount] = useState(0);
  const [data, setData] = useState([]);
  
  useEffect(() => {
    // Каждый рендер создает новый массив, что вызывает новый эффект
    setData([1, 2, 3]);
  }, [data]); // data меняется каждый раз!
  
  return <div>{count}</div>;
}

// ✅ Хорошо: правильные зависимости
function GoodExample() {
  const [count, setCount] = useState(0);
  const [data, setData] = useState([]);
  
  useEffect(() => {
    // Выполняется только при монтировании
    setData([1, 2, 3]);
  }, []); // Пустой массив зависимостей
  
  return <div>{count}</div>;
}
```

#### 2. Забытый cleanup

```javascript
// ❌ Плохо: memory leak
function BadTimer() {
  const [time, setTime] = useState(Date.now());
  
  useEffect(() => {
    setInterval(() => {
      setTime(Date.now());
    }, 1000);
    // Нет cleanup - интервал продолжает работать после размонтирования!
  }, []);
  
  return <div>{new Date(time).toLocaleTimeString()}</div>;
}

// ✅ Хорошо: правильный cleanup
function GoodTimer() {
  const [time, setTime] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 1000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, []);
  
  return <div>{new Date(time).toLocaleTimeString()}</div>;
}
```

#### 3. Неправильные зависимости

```javascript
// ❌ Плохо: missing dependencies
function BadDependencies({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // userId отсутствует в зависимостях!
  
  return user ? <div>{user.name}</div> : <div>Loading...</div>;
}

// ✅ Хорошо: все зависимости указаны
function GoodDependencies({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    if (userId) {
      fetchUser(userId).then(setUser);
    }
  }, [userId]); // userId в зависимостях
  
  return user ? <div>{user.name}</div> : <div>Loading...</div>;
}
```

#### 4. Async функции в useEffect

```javascript
// ❌ Плохо: async функция напрямую в useEffect
function BadAsync() {
  const [data, setData] = useState(null);
  
  useEffect(async () => {
    // Это вызовет предупреждение!
    const result = await fetchData();
    setData(result);
  }, []);
  
  return <div>{data}</div>;
}

// ✅ Хорошо: async функция внутри эффекта
function GoodAsync() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchData();
        setData(result);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, []);
  
  return <div>{data}</div>;
}
```

### Продвинутые паттерны

#### 1. Отмена запросов

```javascript
function DataComponent({ url }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(url, {
          signal: abortController.signal
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Cleanup - отмена запроса
    return () => {
      abortController.abort();
    };
  }, [url]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{JSON.stringify(data)}</div>;
}
```

#### 2. Debounced эффекты

```javascript
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      searchAPI(debouncedSearchTerm).then(setResults);
    } else {
      setResults([]);
    }
  }, [debouncedSearchTerm]);
  
  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <ul>
        {results.map(result => (
          <li key={result.id}>{result.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

#### 3. Условные эффекты

```javascript
function ConditionalEffect({ shouldFetch, userId }) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Эффект выполняется только при соблюдении условий
    if (shouldFetch && userId) {
      let isCancelled = false;
      
      fetchUserData(userId).then(result => {
        if (!isCancelled) {
          setData(result);
        }
      });
      
      return () => {
        isCancelled = true;
      };
    }
  }, [shouldFetch, userId]);
  
  return data ? <div>{data.name}</div> : <div>No data</div>;
}
```

### Custom Hooks с useEffect

#### Переиспользуемая логика

```javascript
// Hook для работы с API
function useAPI(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!url) return;
    
    let isCancelled = false;
    const abortController = new AbortController();
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(url, {
          signal: abortController.signal
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!isCancelled) {
          setData(result);
        }
      } catch (err) {
        if (!isCancelled && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [url]);
  
  const refetch = useCallback(() => {
    if (url) {
      // Trigger re-fetch by updating a dependency
      setData(null);
      setError(null);
    }
  }, [url]);
  
  return { data, loading, error, refetch };
}

// Hook для отслеживания видимости элемента
function useIntersectionObserver(targetRef, options = {}) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);
    
    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [targetRef, options]);
  
  return isVisible;
}

// Использование custom hooks
function ProductList() {
  const { data: products, loading, error, refetch } = useAPI('/api/products');
  const targetRef = useRef();
  const isVisible = useIntersectionObserver(targetRef, { threshold: 0.1 });
  
  useEffect(() => {
    if (isVisible) {
      console.log('Product list is visible');
    }
  }, [isVisible]);
  
  if (loading) return <div>Loading products...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div ref={targetRef}>
      <button onClick={refetch}>Refresh</button>
      {products?.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

### Тестирование useEffect

```javascript
import { renderHook, act } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';

// Тестирование custom hook
test('useAPI hook fetches data correctly', async () => {
  const mockData = { id: 1, name: 'Test' };
  
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockData)
  });
  
  const { result } = renderHook(() => useAPI('/api/test'));
  
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBe(null);
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
  });
});

// Тестирование компонента с useEffect
test('component loads data on mount', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ name: 'John Doe' })
  });
  
  render(<UserProfile userId="123" />);
  
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
  
  expect(fetch).toHaveBeenCalledWith('/api/users/123');
});
```

### Оптимизация производительности

#### Мемоизация зависимостей

```javascript
function OptimizedComponent({ filters, sortBy }) {
  const [data, setData] = useState([]);
  
  // Мемоизируем объект параметров
  const queryParams = useMemo(() => ({
    ...filters,
    sortBy
  }), [filters, sortBy]);
  
  useEffect(() => {
    fetchData(queryParams).then(setData);
  }, [queryParams]); // Стабильная ссылка благодаря useMemo
  
  return <div>{data.length} items</div>;
}
```

### Senior-советы

1. **Всегда указывайте зависимости** - используйте ESLint правило exhaustive-deps
2. **Используйте cleanup функции** для предотвращения memory leaks
3. **Избегайте async функций** напрямую в useEffect
4. **Отменяйте запросы** с помощью AbortController
5. **Мемоизируйте объекты** в зависимостях с useMemo
6. **Разделяйте эффекты** по ответственности
7. **Тестируйте асинхронную логику** с proper mocking

### Альтернативы useEffect

В некоторых случаях useEffect можно заменить другими подходами:

```javascript
// Вместо useEffect для вычислений используйте useMemo
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(props.data);
}, [props.data]);

// Вместо useEffect для обработчиков событий используйте useCallback
const handleClick = useCallback((id) => {
  onItemClick(id);
}, [onItemClick]);

// Для синхронизации с внешними библиотеками используйте useSyncExternalStore
const width = useSyncExternalStore(
  (callback) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  },
  () => window.innerWidth
);
```

## 🔗 Связанные темы

- [Context API vs Redux](context-api.md)
- [Конкурентный рендеринг React 18](concurrent-rendering.md)
- [Promises, Async/Await и Generators](../javascript/async-programming.md)
- [Garbage Collection и оптимизация памяти](../javascript/garbage-collection.md)
