# Garbage Collection и оптимизация памяти

## 📋 Вопрос

Как работает garbage collection в JavaScript, и какие стратегии можно использовать для оптимизации памяти в больших React-приложениях?

## 💡 Ответ

Garbage Collection (GC) в JavaScript — это автоматический процесс освобождения памяти от неиспользуемых объектов. Современные JavaScript движки (V8, SpiderMonkey) используют сложные алгоритмы для эффективного управления памятью.

### Как работает Garbage Collection

#### Основной алгоритм: Mark-and-Sweep

```javascript
// Пример работы Mark-and-Sweep
function demonstrateGC() {
  let obj1 = { name: 'Object 1' }; // Объект создан
  let obj2 = { name: 'Object 2', ref: obj1 }; // obj2 ссылается на obj1
  
  obj1 = null; // obj1 больше не доступен напрямую
  // Но объект не будет удален, так как obj2.ref ссылается на него
  
  obj2 = null; // Теперь оба объекта недостижимы и будут удалены GC
}
```

#### Phases GC процесса

1. **Mark Phase**: Рекурсивно помечает все достижимые объекты от roots (global object, call stack)
2. **Sweep Phase**: Удаляет все непомеченные объекты
3. **Compaction Phase**: (Опционально) Перемещает объекты для дефрагментации памяти

#### Generational Garbage Collection

```javascript
// V8 использует два поколения объектов

// Young Generation (Minor GC) - быстрый, частый
function createShortLivedObjects() {
  for (let i = 0; i < 1000; i++) {
    let temp = { id: i, data: new Array(100) }; // Быстро станет мусором
    // Эти объекты обрабатываются Minor GC
  }
}

// Old Generation (Major GC) - медленный, редкий
const longLivedCache = new Map(); // Живет долго, попадает в Old Gen

function addToCache(key, value) {
  longLivedCache.set(key, value); // Major GC обрабатывает такие объекты
}
```

### Memory Leaks в JavaScript

#### 1. Глобальные переменные

```javascript
// ❌ Плохо: создает глобальную переменную
function createLeak() {
  leakedGlobal = 'This creates a global variable'; // Без var/let/const
}

// ✅ Хорошо: правильное объявление
function noLeak() {
  const localVariable = 'This stays local';
}
```

#### 2. Забытые обработчики событий

```javascript
// ❌ Плохо: не удаляем listener
function addListenerBad() {
  const button = document.getElementById('button');
  button.addEventListener('click', function() {
    console.log('Clicked');
  });
  // Listener остается даже после удаления button из DOM
}

// ✅ Хорошо: удаляем listener
function addListenerGood() {
  const button = document.getElementById('button');
  const handleClick = () => console.log('Clicked');
  
  button.addEventListener('click', handleClick);
  
  // Cleanup
  return () => {
    button.removeEventListener('click', handleClick);
  };
}
```

#### 3. Замыкания с большими объектами

```javascript
// ❌ Плохо: замыкание держит большой объект
function createClosure() {
  const hugeArray = new Array(1000000).fill('data');
  const smallData = 'small';
  
  return function() {
    return smallData; // Но замыкание держит весь hugeArray
  };
}

// ✅ Хорошо: освобождаем ссылку
function createClosureOptimized() {
  const hugeArray = new Array(1000000).fill('data');
  const smallData = 'small';
  
  // Используем данные
  processHugeArray(hugeArray);
  
  return function() {
    return smallData; // Теперь hugeArray может быть удален
  };
}
```

#### 4. Циклические ссылки

```javascript
// ❌ Плохо: циклические ссылки
function createCircularReference() {
  const obj1 = {};
  const obj2 = {};
  
  obj1.ref = obj2;
  obj2.ref = obj1; // Циклическая ссылка
  
  return obj1;
}

// ✅ Хорошо: используем WeakMap/WeakSet
const relationships = new WeakMap();

function createWeakReference(obj1, obj2) {
  relationships.set(obj1, obj2); // Слабая ссылка
  return obj1;
}
```

### Оптимизация памяти в React

#### 1. Правильное использование useEffect

```javascript
import React, { useState, useEffect } from 'react';

// ❌ Плохо: memory leak
function BadComponent() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData().then(setData);
    }, 1000);
    
    // Забыли очистить interval
  }, []);
  
  return <div>{data}</div>;
}

// ✅ Хорошо: правильная очистка
function GoodComponent() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    let isCancelled = false;
    
    const interval = setInterval(async () => {
      try {
        const result = await fetchData();
        if (!isCancelled) {
          setData(result);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(error);
        }
      }
    }, 1000);
    
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);
  
  return <div>{data}</div>;
}
```

#### 2. Мемоизация с осторожностью

```javascript
import React, { useMemo, useCallback } from 'react';

// ❌ Плохо: чрезмерная мемоизация
function OverMemoizedComponent({ users, filters }) {
  // Мемоизация примитивных значений бессмысленна
  const count = useMemo(() => users.length, [users]);
  
  // Слишком много зависимостей
  const expensiveValue = useMemo(() => {
    return users.filter(/* complex logic */);
  }, [users, filters, /* many other deps */]);
  
  return <div>{expensiveValue.length}</div>;
}

// ✅ Хорошо: разумная мемоизация
function OptimizedComponent({ users, filters }) {
  // Мемоизируем только тяжелые вычисления
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Сложная логика фильтрации
      return filters.every(filter => filter.test(user));
    });
  }, [users, filters]);
  
  const handleUserClick = useCallback((userId) => {
    // Обработка клика
  }, []); // Стабильная ссылка
  
  return (
    <div>
      {filteredUsers.map(user => (
        <UserCard 
          key={user.id} 
          user={user} 
          onClick={handleUserClick}
        />
      ))}
    </div>
  );
}
```

#### 3. Виртуализация больших списков

```javascript
import { FixedSizeList as List } from 'react-window';

// ❌ Плохо: рендерим весь список
function HugeListBad({ items }) {
  return (
    <div>
      {items.map((item, index) => (
        <div key={index} style={{ height: 50 }}>
          {item.name}
        </div>
      ))}
    </div>
  );
}

// ✅ Хорошо: виртуализированный список
function HugeListGood({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index].name}
    </div>
  );
  
  return (
    <List
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

#### 4. Оптимизация изображений и медиа

```javascript
import React, { useState, useRef, useEffect } from 'react';

// Lazy loading изображений
function LazyImage({ src, alt, ...props }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={imgRef} {...props}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          style={{ 
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s'
          }}
        />
      )}
    </div>
  );
}
```

### Инструменты для мониторинга памяти

#### 1. Chrome DevTools

```javascript
// Маркировка для профилирования
function markPerformance(name, fn) {
  performance.mark(`${name}-start`);
  const result = fn();
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);
  return result;
}

// Использование
const result = markPerformance('heavy-computation', () => {
  return heavyComputation(data);
});
```

#### 2. Memory API

```javascript
// Мониторинг использования памяти
function monitorMemory() {
  if ('memory' in performance) {
    const memory = performance.memory;
    console.log({
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    });
  }
}

// Проверка каждые 5 секунд
setInterval(monitorMemory, 5000);
```

### Стратегии оптимизации для больших приложений

#### 1. Code Splitting и Lazy Loading

```javascript
import React, { Suspense, lazy } from 'react';

// Динамический импорт компонентов
const HeavyComponent = lazy(() => import('./HeavyComponent'));
const AnotherComponent = lazy(() => 
  import('./AnotherComponent').then(module => ({
    default: module.AnotherComponent
  }))
);

function App() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <HeavyComponent />
      </Suspense>
    </div>
  );
}
```

#### 2. Объектные пулы

```javascript
// Pool для переиспользования объектов
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    
    // Предварительно создаем объекты
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  acquire() {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj) {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}

// Использование
const vectorPool = new ObjectPool(
  () => ({ x: 0, y: 0 }),
  (obj) => { obj.x = 0; obj.y = 0; }
);

function useVector() {
  const vector = vectorPool.acquire();
  // Используем vector
  vectorPool.release(vector);
}
```

#### 3. WeakMap и WeakSet для кэширования

```javascript
// Weak кэширование DOM элементов
const elementCache = new WeakMap();

function cacheElementData(element, data) {
  elementCache.set(element, data);
}

function getElementData(element) {
  return elementCache.get(element);
}

// Когда element удаляется из DOM, данные автоматически очищаются из кэша
```

#### 4. Debounce и Throttle

```javascript
// Debounce для предотвращения лишних вычислений
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// Throttle для ограничения частоты вызовов
function useThrottle(callback, delay) {
  const lastCall = useRef(0);
  
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]);
}
```

### Senior-советы

1. **Профилируйте перед оптимизацией**: Используйте Chrome DevTools для выявления реальных проблем
2. **Мониторьте memory leaks**: Регулярно проверяйте heap snapshots в production
3. **Осторожно с мемоизацией**: Не мемоизируйте все подряд - это может увеличить потребление памяти
4. **Используйте weak references**: WeakMap и WeakSet для временных связей
5. **Clean up subscriptions**: Всегда отписывайтесь от event listeners, intervals, subscriptions
6. **Оптимизируйте изображения**: Используйте WebP, lazy loading, responsive images
7. **Виртуализация**: Для больших списков используйте react-window или react-virtualized

### Лучшие практики

```javascript
// ✅ Comprehensive cleanup pattern
function useDataFetching(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(url, {
          signal: controller.signal
        });
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        
        const result = await response.json();
        
        if (!isCancelled) {
          setData(result);
        }
      } catch (err) {
        if (!isCancelled && err.name !== 'AbortError') {
          setError(err);
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
      controller.abort();
    };
  }, [url]);
  
  return { data, loading, error };
}
```

## 🔗 Связанные темы

- [Event Loop, Microtasks и Macrotasks](event-loop.md)
- [Let, Const, Var: Scope и Hoisting](scope-hoisting.md)
- [Оптимизация ререндеров](../react/rerender-optimization.md)
- [Веб-производительность и Core Web Vitals](../performance/web-performance.md)
