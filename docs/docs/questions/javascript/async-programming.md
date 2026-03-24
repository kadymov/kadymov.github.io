# Promises, Async/Await и Generators

## 📋 Вопрос

Разница между promises, async/await и generators в JavaScript, и как их интегрировать в React для асинхронных операций?

## 💡 Ответ

В JavaScript существует несколько подходов к работе с асинхронным кодом: Promises, async/await и generators. Каждый имеет свои особенности, преимущества и применения.

### Promises - Основа асинхронности

Promises представляют собой объекты, которые содержат состояние асинхронной операции и её результат.

#### Состояния Promise

```javascript
// Три состояния Promise:
// 1. Pending - ожидание
// 2. Fulfilled - выполнено успешно  
// 3. Rejected - отклонено с ошибкой

const promise = new Promise((resolve, reject) => {
  const success = Math.random() > 0.5;
  
  setTimeout(() => {
    if (success) {
      resolve('Операция успешна!');
    } else {
      reject(new Error('Что-то пошло не так'));
    }
  }, 1000);
});

promise
  .then(result => console.log(result))
  .catch(error => console.error(error))
  .finally(() => console.log('Операция завершена'));
```

#### Методы Promise

```javascript
// Promise.all - ждет выполнения всех промисов
const fetchUsers = fetch('/api/users').then(r => r.json());
const fetchPosts = fetch('/api/posts').then(r => r.json());
const fetchComments = fetch('/api/comments').then(r => r.json());

Promise.all([fetchUsers, fetchPosts, fetchComments])
  .then(([users, posts, comments]) => {
    console.log('Все данные загружены:', { users, posts, comments });
  })
  .catch(error => {
    console.error('Ошибка при загрузке данных:', error);
  });

// Promise.allSettled - ждет завершения всех (включая ошибки)
Promise.allSettled([fetchUsers, fetchPosts, fetchComments])
  .then(results => {
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Запрос ${index} успешен:`, result.value);
      } else {
        console.log(`Запрос ${index} неудачен:`, result.reason);
      }
    });
  });

// Promise.race - первый завершившийся промис
const timeout = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 5000)
);

Promise.race([fetchUsers, timeout])
  .then(result => console.log('Быстрый результат:', result))
  .catch(error => console.error('Ошибка или таймаут:', error));

// Promise.any - первый успешный промис (ES2021)
Promise.any([fetchUsers, fetchPosts, fetchComments])
  .then(firstSuccess => console.log('Первый успешный:', firstSuccess))
  .catch(aggregateError => console.error('Все неудачны:', aggregateError));
```

#### Цепочки промисов

```javascript
// Chaining promises
fetch('/api/user/123')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(user => {
    console.log('Пользователь:', user);
    return fetch(`/api/posts?userId=${user.id}`);
  })
  .then(response => response.json())
  .then(posts => {
    console.log('Посты пользователя:', posts);
    return posts.map(post => post.id);
  })
  .then(postIds => {
    console.log('ID постов:', postIds);
  })
  .catch(error => {
    console.error('Ошибка в цепочке:', error);
  });
```

### Async/Await - Синхронный синтаксис

Async/await - это синтаксический сахар над промисами, который делает асинхронный код похожим на синхронный.

#### Основы async/await

```javascript
// Функция с async всегда возвращает Promise
async function fetchUserData(userId) {
  try {
    const userResponse = await fetch(`/api/user/${userId}`);
    
    if (!userResponse.ok) {
      throw new Error(`HTTP error! status: ${userResponse.status}`);
    }
    
    const user = await userResponse.json();
    console.log('Пользователь:', user);
    
    const postsResponse = await fetch(`/api/posts?userId=${user.id}`);
    const posts = await postsResponse.json();
    console.log('Посты:', posts);
    
    return { user, posts };
  } catch (error) {
    console.error('Ошибка при получении данных:', error);
    throw error; // Перебрасываем ошибку
  }
}

// Использование
fetchUserData(123)
  .then(data => console.log('Данные получены:', data))
  .catch(error => console.error('Финальная ошибка:', error));
```

#### Параллельное выполнение с async/await

```javascript
// ❌ Последовательное выполнение (медленно)
async function fetchDataSequential() {
  const users = await fetch('/api/users').then(r => r.json());
  const posts = await fetch('/api/posts').then(r => r.json());
  const comments = await fetch('/api/comments').then(r => r.json());
  
  return { users, posts, comments };
}

// ✅ Параллельное выполнение (быстро)
async function fetchDataParallel() {
  const [users, posts, comments] = await Promise.all([
    fetch('/api/users').then(r => r.json()),
    fetch('/api/posts').then(r => r.json()),
    fetch('/api/comments').then(r => r.json())
  ]);
  
  return { users, posts, comments };
}

// ✅ Смешанный подход
async function fetchDataMixed() {
  // Сначала получаем пользователя
  const user = await fetch('/api/user/123').then(r => r.json());
  
  // Затем параллельно получаем связанные данные
  const [posts, profile, friends] = await Promise.all([
    fetch(`/api/posts?userId=${user.id}`).then(r => r.json()),
    fetch(`/api/profile/${user.id}`).then(r => r.json()),
    fetch(`/api/friends/${user.id}`).then(r => r.json())
  ]);
  
  return { user, posts, profile, friends };
}
```

### Generators - Ленивые итераторы

Generators позволяют приостанавливать и возобновлять выполнение функций, что полезно для итераторов и асинхронного кода.

#### Основы генераторов

```javascript
// Простой генератор
function* simpleGenerator() {
  console.log('Генератор запущен');
  yield 1;
  console.log('После первого yield');
  yield 2;
  console.log('После второго yield');
  return 3;
}

const gen = simpleGenerator();
console.log(gen.next()); // { value: 1, done: false }
console.log(gen.next()); // { value: 2, done: false }
console.log(gen.next()); // { value: 3, done: true }

// Генератор с входными параметрами
function* generatorWithInput() {
  const first = yield 'Дайте первое число';
  const second = yield 'Дайте второе число';
  return first + second;
}

const inputGen = generatorWithInput();
console.log(inputGen.next());        // { value: 'Дайте первое число', done: false }
console.log(inputGen.next(10));      // { value: 'Дайте второе число', done: false }
console.log(inputGen.next(20));      // { value: 30, done: true }
```

#### Асинхронные генераторы

```javascript
// Async generators (ES2018)
async function* asyncGenerator() {
  yield await fetch('/api/data1').then(r => r.json());
  yield await fetch('/api/data2').then(r => r.json());
  yield await fetch('/api/data3').then(r => r.json());
}

// Использование async generator
async function consumeAsyncGenerator() {
  for await (const data of asyncGenerator()) {
    console.log('Получены данные:', data);
  }
}

// Генератор для пагинации
async function* paginatedFetch(baseUrl, pageSize = 10) {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`${baseUrl}?page=${page}&size=${pageSize}`);
    const data = await response.json();
    
    hasMore = data.items.length === pageSize;
    page++;
    
    yield data.items;
  }
}

// Использование пагинированного генератора
async function loadAllData() {
  for await (const items of paginatedFetch('/api/users')) {
    console.log(`Получена страница с ${items.length} элементами`);
    // Обрабатываем каждую страницу
  }
}
```

### Сравнение подходов

| Характеристика | Promises | Async/Await | Generators |
|---------------|----------|-------------|------------|
| Читаемость | Средняя | Высокая | Средняя |
| Обработка ошибок | .catch() | try/catch | try/catch |
| Композиция | .then() chains | Последовательно | yield/next |
| Поддержка | ES6+ | ES2017+ | ES6+ |
| Отмена | Сложно | Сложно | Естественно |
| Ленивые вычисления | Нет | Нет | Да |

### Интеграция в React

#### 1. Базовое использование в React

```javascript
import React, { useState, useEffect } from 'react';

// Использование async/await в useEffect
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Нельзя сделать useEffect async напрямую
    // useEffect(async () => { ... }, []); // ❌ Неправильно
    
    let isCancelled = false;
    
    const fetchUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить пользователя');
        }
        
        const userData = await response.json();
        
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
    
    fetchUser();
    
    return () => {
      isCancelled = true;
    };
  }, [userId]);
  
  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!user) return <div>Пользователь не найден</div>;
  
  return <div>Привет, {user.name}!</div>;
}
```

#### 2. Кастомные хуки для асинхронных операций

```javascript
// Универсальный хук для fetch
function useFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchData = useCallback(async (customUrl, customOptions = {}) => {
    const controller = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(customUrl || url, {
        ...options,
        ...customOptions,
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      return result;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        throw err;
      }
    } finally {
      setLoading(false);
    }
    
    return () => controller.abort();
  }, [url, options]);
  
  useEffect(() => {
    if (url) {
      const cleanup = fetchData();
      return cleanup;
    }
  }, [fetchData, url]);
  
  return { data, loading, error, refetch: fetchData };
}

// Хук для загрузки списка с пагинацией
function usePaginatedData(url, pageSize = 10) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`${url}?page=${page}&size=${pageSize}`);
      const data = await response.json();
      
      setItems(prev => [...prev, ...data.items]);
      setHasMore(data.items.length === pageSize);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  }, [url, pageSize, page, loading, hasMore]);
  
  useEffect(() => {
    loadMore();
  }, []); // Загружаем первую страницу
  
  return { items, loading, hasMore, loadMore };
}
```

#### 3. Обработка состояния с useReducer

```javascript
// Reducer для async операций
const asyncReducer = (state, action) => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, data: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'RESET':
      return { data: null, loading: false, error: null };
    default:
      return state;
  }
};

function useAsyncOperation(asyncFunction) {
  const [state, dispatch] = useReducer(asyncReducer, {
    data: null,
    loading: false,
    error: null
  });
  
  const execute = useCallback(async (...args) => {
    dispatch({ type: 'FETCH_START' });
    
    try {
      const result = await asyncFunction(...args);
      dispatch({ type: 'FETCH_SUCCESS', payload: result });
      return result;
    } catch (error) {
      dispatch({ type: 'FETCH_ERROR', error: error.message });
      throw error;
    }
  }, [asyncFunction]);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);
  
  return { ...state, execute, reset };
}

// Использование
function UserManager() {
  const createUser = async (userData) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return response.json();
  };
  
  const { data, loading, error, execute } = useAsyncOperation(createUser);
  
  const handleSubmit = async (formData) => {
    try {
      await execute(formData);
      console.log('Пользователь создан:', data);
    } catch (error) {
      console.error('Ошибка создания:', error);
    }
  };
  
  return (
    <div>
      {loading && <div>Создание пользователя...</div>}
      {error && <div>Ошибка: {error}</div>}
      {data && <div>Пользователь создан: {data.name}</div>}
    </div>
  );
}
```

#### 4. Отмена запросов с AbortController

```javascript
function useAbortableAsync(asyncFunction) {
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null
  });
  
  const execute = useCallback(async (...args) => {
    const controller = new AbortController();
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await asyncFunction(...args, controller.signal);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      if (error.name !== 'AbortError') {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
      }
      throw error;
    }
    
    // Возвращаем функцию отмены
    return () => controller.abort();
  }, [asyncFunction]);
  
  return { ...state, execute };
}

// Использование с автоматической отменой
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  
  const searchAsync = async (searchQuery, signal) => {
    const response = await fetch(`/api/search?q=${searchQuery}`, { signal });
    return response.json();
  };
  
  const { data, loading, execute } = useAbortableAsync(searchAsync);
  
  useEffect(() => {
    if (query.length > 2) {
      const cancelSearch = execute(query);
      return cancelSearch; // Отменяем предыдущий поиск
    }
  }, [query, execute]);
  
  useEffect(() => {
    if (data) {
      setResults(data.results);
    }
  }, [data]);
  
  return (
    <div>
      <input 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск..."
      />
      {loading && <div>Поиск...</div>}
      <ul>
        {results.map(item => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Обработка ошибок

```javascript
// Глобальная обработка ошибок
class AsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Async error caught:', error, errorInfo);
    // Отправляем ошибку в систему мониторинга
  }
  
  render() {
    if (this.state.hasError) {
      return <div>Что-то пошло не так: {this.state.error.message}</div>;
    }
    
    return this.props.children;
  }
}

// Retry механизм
async function withRetry(asyncFunction, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFunction();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

// Использование retry
const fetchWithRetry = () => withRetry(
  () => fetch('/api/data').then(r => r.json()),
  3,
  1000
);
```

### Senior-советы

1. **Предпочитайте async/await** для читаемости, но понимайте промисы под капотом
2. **Используйте AbortController** для отмены запросов в React
3. **Избегайте Promise hell** - не делайте глубокие цепочки .then()
4. **Обрабатывайте ошибки** на каждом уровне, где это имеет смысл
5. **Параллелизуйте** независимые операции с Promise.all
6. **Generators** полезны для сложных итераций и отменяемых операций
7. **Мемоизируйте** async функции в React с useCallback

### Лучшие практики

```javascript
// ✅ Comprehensive async pattern
const useAsyncWithCleanup = (asyncFn, deps) => {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const mountedRef = useRef(true);
  
  useEffect(() => {
    let cancelled = false;
    
    const execute = async () => {
      if (!mountedRef.current) return;
      
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const result = await asyncFn();
        
        if (!cancelled && mountedRef.current) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled && mountedRef.current) {
          setState(prev => ({ ...prev, loading: false, error }));
        }
      }
    };
    
    execute();
    
    return () => {
      cancelled = true;
    };
  }, deps);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return state;
};
```

## 🔗 Связанные темы

- [Event Loop, Microtasks и Macrotasks](event-loop.md)
- [useEffect и Side Effects](../re/use-effect.md)
- [Конкурентный рендеринг React 18](../re/concurrent-rendering.md)
- [Архитектура состояния приложения](../architecture/state-architecture.md)
