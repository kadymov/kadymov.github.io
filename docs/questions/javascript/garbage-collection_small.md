# Garbage Collection - Senior Cheat Sheet

## GC Алгоритмы

**Mark-and-Sweep**: Помечает достижимые объекты → удаляет непомеченные
**Generational**: Young Gen (Minor GC, частый) + Old Gen (Major GC, редкий)

```javascript
// V8: объекты начинают в Young, выжившие переходят в Old
const cache = new Map(); // Долгоживущий → Old Gen
const temp = { data: [] }; // Короткоживущий → Young Gen
```

## Memory Leaks - Топ проблем

### 1. Глобальные переменные
```javascript
// ❌ Создает глобальную
leaked = 'data'; // Без var/let/const

// ✅ Локальная
const local = 'data';
```

### 2. Event Listeners
```javascript
// ✅ Правильная очистка
useEffect(() => {
  const handler = () => {};
  element.addEventListener('click', handler);
  return () => element.removeEventListener('click', handler);
}, []);
```

### 3. Замыкания с большими объектами
```javascript
// ❌ Замыкание держит весь массив
function bad() {
  const huge = new Array(1e6);
  return () => 'small'; // Держит huge
}

// ✅ Освобождаем ссылку
function good() {
  let huge = new Array(1e6);
  process(huge);
  huge = null; // Освобождаем
  return () => 'small';
}
```

### 4. Циклические ссылки
```javascript
// ✅ Используем WeakMap/WeakSet
const relations = new WeakMap();
relations.set(obj1, obj2); // Слабая ссылка
```

## React Оптимизации

### useEffect Cleanup
```javascript
useEffect(() => {
  let cancelled = false;
  const interval = setInterval(() => {
    if (!cancelled) updateData();
  }, 1000);
  
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, []);
```

### Мемоизация - только тяжелые вычисления
```javascript
// ✅ Тяжелые вычисления
const filtered = useMemo(() => 
  items.filter(expensive), [items]
);

// ❌ Примитивы
const count = useMemo(() => items.length, [items]); // Бесполезно
```

### Виртуализация больших списков
```javascript
import { FixedSizeList } from 'react-window';
// Рендерим только видимые элементы
```

## Инструменты мониторинга

### Chrome DevTools
- Memory tab → Heap snapshots
- Performance → Memory timeline
- `performance.memory` API

### Маркировка производительности
```javascript
performance.mark('start');
heavyOperation();
performance.mark('end');
performance.measure('operation', 'start', 'end');
```

## Оптимизация стратегии

### 1. Объектные пулы
```javascript
class Pool {
  constructor(create, reset) {
    this.create = create;
    this.reset = reset;
    this.pool = [];
  }
  acquire() { return this.pool.pop() || this.create(); }
  release(obj) { this.reset(obj); this.pool.push(obj); }
}
```

### 2. Debounce/Throttle
```javascript
const debounced = useDebounce(value, 300);
const throttled = useThrottle(callback, 100);
```

### 3. WeakMap кэширование
```javascript
const cache = new WeakMap();
cache.set(element, data); // Автоочистка при удалении element
```

## Senior Rules

1. **Профилируй сначала** - DevTools Memory tab
2. **Weak references** для временных связей
3. **Cleanup subscriptions** - всегда отписывайся
4. **Lazy loading** для изображений/компонентов
5. **Object pools** для частых аллокаций
6. **Virtualization** для больших списков (1000+ items)
7. **Monitor production** - регулярные heap snapshots

## Критические паттерны

```javascript
// ✅ Comprehensive cleanup
function useResource() {
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    
    fetchData({ signal: controller.signal })
      .then(data => mounted && setData(data));
    
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);
}
```

**Главное**: Memory leaks накапливаются, следи за heap size в production!
