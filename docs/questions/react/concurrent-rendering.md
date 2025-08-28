# Конкурентный рендеринг React 18

## 📋 Вопрос

Как в React 18 работает конкурентный рендеринг? Зачем нужны useTransition и useDeferredValue, чем они отличаются? Что такое автоматическое батчинг-объединение, какие побочные эффекты в StrictMode в dev, и как избегать race conditions при загрузке данных (AbortController, отмена устаревших запросов)?

## 💡 Ответ

React 18 представил конкурентный рендеринг (Concurrent Rendering) — фундаментальное изменение в том, как React обрабатывает обновления. Это позволяет React прерывать, приостанавливать и возобновлять рендеринг для поддержания отзывчивости пользовательского интерфейса.

### Основы конкурентного рендеринга

#### Что изменилось

```javascript
// React 17 и ранее - блокирующий рендеринг
function App() {
  const [count, setCount] = useState(0);
  const [list, setList] = useState([]);
  
  // Эти обновления блокировали main thread
  const handleClick = () => {
    setCount(count + 1);
    setList(Array.from({length: 10000}, (_, i) => i)); // Тяжелая операция
  };
  
  return (
    <div>
      <button onClick={handleClick}>Count: {count}</button>
      {list.map(item => <div key={item}>{item}</div>)}
    </div>
  );
}

// React 18 - конкурентный рендеринг
import { createRoot } from 'react-dom/client';

// Включение конкурентных возможностей
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

#### Приоритеты обновлений

```javascript
// React 18 различает приоритеты обновлений:

// Высокий приоритет (синхронные)
// - Пользовательские взаимодействия (click, input)
// - Обновления фокуса
// - Анимации

// Обычный приоритет
// - Загрузка данных
// - Обновления списков

// Низкий приоритет (могут быть прерваны)
// - Аналитика
// - Логирование
// - Фоновые обновления

function PriorityExample() {
  const [inputValue, setInputValue] = useState('');
  const [list, setList] = useState([]);
  
  const handleInputChange = (e) => {
    // Высокий приоритет - выполняется немедленно
    setInputValue(e.target.value);
    
    // Это может быть прервано для обработки input
    setList(generateLargeList(e.target.value));
  };
  
  return (
    <div>
      <input value={inputValue} onChange={handleInputChange} />
      <List items={list} />
    </div>
  );
}
```

### useTransition Hook

useTransition позволяет пометить обновления состояния как переходы (transitions), которые могут быть прерваны более приоритетными обновлениями.

#### Основное использование

```javascript
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();
  
  const handleSearch = (value) => {
    // Синхронное обновление - высокий приоритет
    setQuery(value);
    
    // Асинхронное обновление - может быть прервано
    startTransition(() => {
      setResults(searchFunction(value));
    });
  };
  
  return (
    <div>
      <input 
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      
      {isPending && <div>Searching...</div>}
      
      <div>
        {results.map(result => (
          <div key={result.id} className={isPending ? 'opacity-50' : ''}>
            {result.title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Сложный пример с фильтрацией

```javascript
function ProductFilter() {
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('all');
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [isPending, startTransition] = useTransition();
  
  const applyFilters = (newFilter, newCategory) => {
    // Обновления UI происходят немедленно
    setFilter(newFilter);
    setCategory(newCategory);
    
    // Тяжелая фильтрация происходит в transition
    startTransition(() => {
      const filtered = INITIAL_PRODUCTS.filter(product => {
        const matchesFilter = product.name.toLowerCase()
          .includes(newFilter.toLowerCase());
        const matchesCategory = newCategory === 'all' || 
          product.category === newCategory;
        
        return matchesFilter && matchesCategory;
      });
      
      setProducts(filtered);
    });
  };
  
  return (
    <div>
      <div className="filters">
        <input
          value={filter}
          onChange={(e) => applyFilters(e.target.value, category)}
          placeholder="Filter products..."
        />
        
        <select 
          value={category}
          onChange={(e) => applyFilters(filter, e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="electronics">Electronics</option>
          <option value="clothing">Clothing</option>
        </select>
      </div>
      
      <div className={`product-list ${isPending ? 'updating' : ''}`}>
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
        
        {isPending && (
          <div className="overlay">
            <div>Updating results...</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### useDeferredValue Hook

useDeferredValue позволяет отложить обновление значения до тех пор, пока не завершятся более приоритетные обновления.

#### Основное использование

```javascript
import { useState, useDeferredValue, useMemo } from 'react';

function App() {
  const [query, setQuery] = useState('');
  
  // Отложенное значение обновляется с задержкой
  const deferredQuery = useDeferredValue(query);
  
  // Тяжелые вычисления используют отложенное значение
  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    
    // Симуляция тяжелых вычислений
    return performExpensiveSearch(deferredQuery);
  }, [deferredQuery]);
  
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      
      <div>
        {/* UI остается отзывчивым при вводе */}
        <SearchResults 
          query={deferredQuery} 
          results={searchResults}
          isStale={query !== deferredQuery} 
        />
      </div>
    </div>
  );
}

function SearchResults({ query, results, isStale }) {
  return (
    <div className={isStale ? 'opacity-60' : 'opacity-100'}>
      <h3>Results for: {query}</h3>
      {results.map(result => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}
```

#### Сравнение useTransition и useDeferredValue

```javascript
// useTransition - для обновлений состояния
function WithTransition() {
  const [input, setInput] = useState('');
  const [list, setList] = useState([]);
  const [isPending, startTransition] = useTransition();
  
  const handleChange = (value) => {
    setInput(value); // Немедленно
    
    startTransition(() => {
      setList(generateList(value)); // Может быть прервано
    });
  };
  
  return (
    <div>
      <input onChange={(e) => handleChange(e.target.value)} />
      {isPending && <Spinner />}
      <List items={list} />
    </div>
  );
}

// useDeferredValue - для значений
function WithDeferredValue() {
  const [input, setInput] = useState('');
  const deferredInput = useDeferredValue(input);
  
  const list = useMemo(() => {
    return generateList(deferredInput);
  }, [deferredInput]);
  
  const isStale = input !== deferredInput;
  
  return (
    <div>
      <input onChange={(e) => setInput(e.target.value)} />
      {isStale && <Spinner />}
      <List items={list} />
    </div>
  );
}
```

### Автоматическое батчинг

React 18 автоматически группирует обновления состояния в одно обновление для улучшения производительности.

#### Новое поведение

```javascript
// React 17 - батчинг только в event handlers
function React17Behavior() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);
  
  const handleClick = () => {
    setCount(c => c + 1); // Батчится
    setFlag(f => !f);     // Батчится
    // Один ре-рендер
  };
  
  const handleAsyncClick = () => {
    setTimeout(() => {
      setCount(c => c + 1); // НЕ батчится в React 17
      setFlag(f => !f);     // НЕ батчится в React 17
      // Два ре-рендера
    });
  };
  
  return (
    <div>
      <button onClick={handleClick}>Sync Update</button>
      <button onClick={handleAsyncClick}>Async Update</button>
    </div>
  );
}

// React 18 - автоматический батчинг везде
function React18Behavior() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);
  
  const handleAsyncClick = () => {
    setTimeout(() => {
      setCount(c => c + 1); // Батчится автоматически
      setFlag(f => !f);     // Батчится автоматически
      // Один ре-рендер
    });
  };
  
  const handlePromiseClick = () => {
    fetch('/api/data').then(() => {
      setCount(c => c + 1); // Батчится автоматически
      setFlag(f => !f);     // Батчится автоматически
      // Один ре-рендер
    });
  };
  
  return (
    <div>
      <button onClick={handleAsyncClick}>Async Update</button>
      <button onClick={handlePromiseClick}>Promise Update</button>
    </div>
  );
}
```

#### Отключение батчинга

```javascript
import { flushSync } from 'react-dom';

function DisableBatching() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);
  
  const handleClick = () => {
    flushSync(() => {
      setCount(c => c + 1); // Принудительный рендер
    });
    
    flushSync(() => {
      setFlag(f => !f); // Еще один принудительный рендер
    });
    
    // Итого: два рендера вместо одного
  };
  
  return <button onClick={handleClick}>Force Sync</button>;
}
```

### StrictMode в разработке

React 18 усилил StrictMode для выявления побочных эффектов в конкурентном режиме.

#### Двойной рендеринг

```javascript
function StrictModeExample() {
  const [count, setCount] = useState(0);
  
  // В dev mode с StrictMode этот эффект выполнится дважды
  useEffect(() => {
    console.log('Effect running'); // Будет напечатано дважды
    
    // Проблема: побочный эффект без cleanup
    window.globalCounter = (window.globalCounter || 0) + 1;
    
    return () => {
      console.log('Effect cleanup'); // Cleanup тоже выполнится
    };
  }, []);
  
  // Render функция должна быть чистой
  console.log('Rendering'); // Будет напечатано дважды
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}

// Правильная обработка в StrictMode
function StrictModeFixed() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      const data = await api.getData();
      
      // Проверяем, не был ли эффект отменен
      if (!cancelled) {
        setData(data);
      }
    };
    
    fetchData();
    
    return () => {
      cancelled = true; // Cleanup предотвращает состояние гонки
    };
  }, []);
  
  return <div>Count: {count}</div>;
}
```

### Race Conditions и их предотвращение

#### Проблема Race Conditions

```javascript
// ❌ Проблематичный код без защиты от race conditions
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    
    // Проблема: если userId быстро меняется,
    // ответы могут прийти в неправильном порядке
    fetchUser(userId).then(userData => {
      setUser(userData); // Может установить устаревшие данные
      setLoading(false);
    });
  }, [userId]);
  
  return loading ? <div>Loading...</div> : <div>{user?.name}</div>;
}
```

#### Решение 1: Флаг отмены

```javascript
function UserProfileFixed({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    
    setLoading(true);
    
    fetchUser(userId).then(userData => {
      if (!cancelled) {
        setUser(userData);
        setLoading(false);
      }
    }).catch(error => {
      if (!cancelled) {
        console.error('Failed to fetch user:', error);
        setLoading(false);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [userId]);
  
  return loading ? <div>Loading...</div> : <div>{user?.name}</div>;
}
```

#### Решение 2: AbortController

```javascript
function UserProfileWithAbort({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const abortController = new AbortController();
    
    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/${userId}`, {
          signal: abortController.signal
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        
        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      loadUser();
    }
    
    return () => {
      abortController.abort();
    };
  }, [userId]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{user?.name}</div>;
}
```

#### Решение 3: Custom Hook для API вызовов

```javascript
function useAsyncData(asyncFunction, dependencies) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await asyncFunction(abortController.signal);
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, dependencies);
  
  return { data, loading, error };
}

// Использование
function UserProfile({ userId }) {
  const { data: user, loading, error } = useAsyncData(
    (signal) => fetch(`/api/users/${userId}`, { signal }).then(r => r.json()),
    [userId]
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{user?.name}</div>;
}
```

### Suspense для данных

```javascript
// Интеграция с конкурентными возможностями
function App() {
  const [selectedUser, setSelectedUser] = useState('1');
  
  return (
    <div>
      <UserSelector onSelect={setSelectedUser} />
      
      <Suspense fallback={<UserProfileSkeleton />}>
        <UserProfile userId={selectedUser} />
      </Suspense>
    </div>
  );
}

function UserProfile({ userId }) {
  // Используем библиотеку для данных с Suspense
  const user = useSuspenseQuery(['user', userId], () => 
    fetchUser(userId)
  );
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Миграция на React 18

#### Обновление рендеринга

```javascript
// React 17
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// React 18
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

#### Обработка изменений в StrictMode

```javascript
// Проблемный код в React 18 StrictMode
function ProblemComponent() {
  useEffect(() => {
    // Это будет вызвано дважды в dev mode
    analytics.track('component-mounted');
    
    // Проблема: побочный эффект выполняется дважды
  }, []);
}

// Исправленный код
function FixedComponent() {
  const hasMounted = useRef(false);
  
  useEffect(() => {
    if (!hasMounted.current) {
      analytics.track('component-mounted');
      hasMounted.current = true;
    }
  }, []);
  
  // Или лучше: переместить в event handler
  const handleUserAction = () => {
    analytics.track('user-action');
  };
}
```

### Лучшие практики

#### 1. Правильное использование useTransition

```javascript
// ✅ Хорошо: для неблокирующих обновлений UI
function GoodTransitionUse() {
  const [isPending, startTransition] = useTransition();
  
  const handleFilter = (newFilter) => {
    startTransition(() => {
      // Тяжелые вычисления или большие обновления списков
      setFilteredData(applyExpensiveFilter(data, newFilter));
    });
  };
}

// ❌ Плохо: для критических обновлений
function BadTransitionUse() {
  const [isPending, startTransition] = useTransition();
  
  const handleSubmit = () => {
    startTransition(() => {
      // Не используйте для критических операций
      submitForm(); // Это должно быть немедленным
    });
  };
}
```

#### 2. Оптимальное использование useDeferredValue

```javascript
// ✅ Хорошо: для производных значений
function GoodDeferredUse({ searchQuery }) {
  const deferredQuery = useDeferredValue(searchQuery);
  
  const results = useMemo(() => {
    return expensiveSearch(deferredQuery);
  }, [deferredQuery]);
  
  return <SearchResults results={results} />;
}

// ❌ Плохо: для простых значений
function BadDeferredUse({ userName }) {
  const deferredName = useDeferredValue(userName); // Излишне
  
  return <div>Hello, {deferredName}</div>; // Простое отображение
}
```

### Debugging конкурентных возможностей

```javascript
// Профилирование с React DevTools
function ProfiledComponent() {
  const [isPending, startTransition] = useTransition();
  
  const handleUpdate = () => {
    startTransition(() => {
      // Измеряем производительность
      performance.mark('transition-start');
      
      updateLargeDataSet();
      
      performance.mark('transition-end');
      performance.measure(
        'transition-duration',
        'transition-start',
        'transition-end'
      );
    });
  };
  
  return (
    <div>
      <button onClick={handleUpdate}>
        Update {isPending && '(updating...)'}
      </button>
    </div>
  );
}
```

### Senior-советы

1. **Включайте конкурентные возможности постепенно** - начните с createRoot
2. **Используйте useTransition для тяжелых обновлений UI** - фильтры, списки
3. **useDeferredValue для производных значений** - поиск, вычисления
4. **Всегда обрабатывайте race conditions** - используйте AbortController
5. **Тестируйте в StrictMode** - это поможет найти проблемы заранее
6. **Не оборачивайте все в transitions** - только тяжелые операции
7. **Профилируйте с React DevTools** - измеряйте реальную производительность

## 🔗 Связанные темы

- [useEffect и Side Effects](use-effect.md)
- [Reconciliation и Virtual DOM](reconciliation.md)
- [Оптимизация ререндеров](rerender-optimization.md)
- [Event Loop, Microtasks и Macrotasks](../javascript/event-loop.md)
