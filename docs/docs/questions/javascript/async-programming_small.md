# Async Programming - Senior Cheat Sheet (small)

## Promise методы

```javascript
// Promise.all - все должны завершиться успешно
const [users, posts] = await Promise.all([fetchUsers(), fetchPosts()]);

// Promise.allSettled - все завершатся (включая ошибки)
const results = await Promise.allSettled([fetch1(), fetch2()]);

// Promise.race - первый завершившийся
const result = await Promise.race([fetchData(), timeout(5000)]);

// Promise.any - первый успешный (ES2021)
const first = await Promise.any([slow(), fast(), failing()]);
```

## Async/Await паттерны

### Последовательно vs Параллельно
```javascript
// ❌ Последовательно (медленно)
const user = await fetchUser();
const posts = await fetchPosts();

// ✅ Параллельно (быстро)
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()]);

// ✅ Смешанно (реальная задача)
const user = await fetchUser(id);
const [posts, profile] = await Promise.all([
  fetchPosts(user.id),
  fetchProfile(user.id)
]);
```

## Generators

```javascript
// Базовый генератор
function* gen() {
  const a = yield 1;
  const b = yield a + 1;
  return a + b;
}

// Async генератор (пагинация)
async function* paginatedFetch(url) {
  let page = 1;
  while (true) {
    const data = await fetch(`${url}?page=${page++}`);
    const items = await data.json();
    if (items.length === 0) break;
    yield items;
  }
}

// Использование
for await (const items of paginatedFetch('/api/data')) {
  process(items);
}
```

## Сравнение подходов

| | Promises | Async/Await | Generators |
|---|----------|-------------|------------|
| Читаемость | Средняя | **Высокая** | Средняя |
| Ошибки | `.catch()` | `try/catch` | `try/catch` |
| Отмена | Сложно | Сложно | **Легко** |
| Ленивость | Нет | Нет | **Да** |

## React интеграция

### useEffect с async
```javascript
// ✅ Правильный паттерн
useEffect(() => {
  let cancelled = false;
  
  const fetchData = async () => {
    try {
      const result = await fetch('/api/data');
      if (!cancelled) setData(await result.json());
    } catch (error) {
      if (!cancelled) setError(error);
    }
  };
  
  fetchData();
  return () => { cancelled = true; };
}, []);
```

### Custom hooks

```javascript
// Универсальный async хук
function useAsyncOperation(asyncFn) {
  const [state, dispatch] = useReducer(asyncReducer, {
    data: null, loading: false, error: null
  });
  
  const execute = useCallback(async (...args) => {
    dispatch({ type: 'START' });
    try {
      const result = await asyncFn(...args);
      dispatch({ type: 'SUCCESS', payload: result });
      return result;
    } catch (error) {
      dispatch({ type: 'ERROR', error });
      throw error;
    }
  }, [asyncFn]);
  
  return { ...state, execute };
}

// AbortController интеграция
function useFetch(url) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const controller = new AbortController();
    
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(setData)
      .catch(err => err.name !== 'AbortError' && console.error(err));
    
    return () => controller.abort();
  }, [url]);
  
  return data;
}
```

### Пагинация хук
```javascript
function usePaginatedData(url, pageSize = 10) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = useCallback(async () => {
    const response = await fetch(`${url}?page=${page}&size=${pageSize}`);
    const data = await response.json();
    
    setItems(prev => [...prev, ...data.items]);
    setHasMore(data.items.length === pageSize);
  }, [url, pageSize]);
  
  return { items, hasMore, loadMore };
}
```

## Error Handling

### Retry паттерн
```javascript
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, delay * attempt)); // Exponential backoff
    }
  }
}
```

### Timeout wrapper
```javascript
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}
```

## Senior Patterns

### Cancelable operations
```javascript
class CancelableOperation {
  constructor(executor) {
    this.cancelled = false;
    this.promise = new Promise((resolve, reject) => {
      executor(
        value => this.cancelled ? reject(new Error('Cancelled')) : resolve(value),
        error => this.cancelled ? reject(new Error('Cancelled')) : reject(error)
      );
    });
  }
  
  cancel() { this.cancelled = true; }
}
```

### Queue with concurrency limit
```javascript
class AsyncQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.tryNext();
    });
  }
  
  async tryNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    
    this.running++;
    const { fn, resolve, reject } = this.queue.shift();
    
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.tryNext();
    }
  }
}
```

## Senior Rules

1. **AbortController** для всех fetch запросов
2. **Promise.all** для параллельных операций
3. **Cleanup functions** в useEffect всегда
4. **Error boundaries** для async ошибок
5. **Retry с backoff** для сетевых операций
6. **Debounce** для user input
7. **Queue** для ограничения concurrency
8. **Generators** для complex iteration/cancellation

## Anti-patterns

```javascript
// ❌ async useEffect
useEffect(async () => { ... }, []); // Неправильно

// ❌ Promise hell
fetch().then().then().then(); // Используй async/await

// ❌ Забытый cleanup
useEffect(() => {
  setInterval(fn, 1000); // Leak!
}, []);

// ❌ Последовательные независимые операции
const a = await fetchA(); // Медленно
const b = await fetchB();
```

**Главное**: Всегда думай о cleanup, cancellation и error handling!
