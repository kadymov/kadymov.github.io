# React Rerender Optimization - Senior Cheat Sheet (small)

## Основы оптимизации

**Цель**: Предотвратить ненужные ререндеры, сохраняя производительность

### React.memo - мемоизация компонентов

```jsx
// Базовое использование
const UserCard = React.memo(function UserCard({ user, theme }) {
  return (
    <div className={`user-card user-card--${theme}`}>
      {user.name}
    </div>
  );
});

// Кастомное сравнение
const CustomMemo = React.memo(UserCard, (prevProps, nextProps) => {
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.theme === nextProps.theme
  );
});
```

### useMemo - мемоизация значений

```jsx
function ProductList({ products, filters, sortBy }) {
  // Тяжелые вычисления
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => matchesFilters(p, filters))
      .sort(getSortFunction(sortBy));
  }, [products, filters, sortBy]);
  
  // Мемоизация объектов для пропсов
  const tableConfig = useMemo(() => ({
    sortable: true,
    pageSize: 10
  }), []);
  
  return <ProductTable items={filteredProducts} config={tableConfig} />;
}
```

### useCallback - мемоизация функций

```jsx
function TodoList({ todos, onToggle, onDelete }) {
  const [filter, setFilter] = useState('all');
  
  // Стабильные ссылки на функции
  const handleToggle = useCallback((id) => {
    onToggle(id);
  }, [onToggle]);
  
  const handleDelete = useCallback((id) => {
    onDelete(id);
  }, [onDelete]);
  
  const filteredTodos = useMemo(() => 
    todos.filter(getFilterFunction(filter)), [todos, filter]
  );
  
  return (
    <div>
      {filteredTodos.map(todo => (
        <MemoizedTodoItem
          key={todo.id}
          todo={todo}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
```

## Правильные ключи

```jsx
// ❌ Индекс как key для динамических списков
{todos.map((todo, index) => <TodoItem key={index} todo={todo} />)}

// ✅ Стабильные уникальные ключи
{todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}

// ✅ Составные ключи
{posts.map(post => 
  post.comments.map(comment => (
    <Comment key={`${post.id}-${comment.id}`} comment={comment} />
  ))
)}
```

## Context оптимизация

### Проблема
```jsx
// ❌ Все consumers ререндерятся при любом изменении
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  
  const value = { user, setUser, theme, setTheme }; // Новый объект каждый раз
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

### Решение 1: Разделенные контексты
```jsx
// ✅ Отдельные контексты
const UserContext = createContext();
const ThemeContext = createContext();

function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// Теперь компоненты ререндерятся только при изменении нужных данных
```

### Решение 2: useSyncExternalStore
```jsx
// Селекторы для external store
function useCount() {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().count,
    () => 0 // SSR value
  );
}

function Counter() {
  const count = useCount(); // Только при изменении count
  return <div>{count}</div>;
}
```

## Virtualization больших списков

### react-window
```jsx
import { FixedSizeList as List } from 'react-window';

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index].title}
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

### Variable height
```jsx
import { VariableSizeList } from 'react-window';

function VariableList({ items }) {
  const getItemSize = (index) => items[index].height || 80;
  
  return (
    <VariableSizeList
      height={600}
      itemCount={items.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableSizeList>
  );
}
```

## DevTools Profiler

### Profiler API
```jsx
import { Profiler } from 'react';

function App() {
  const handleRender = (id, phase, actualDuration, baseDuration) => {
    if (actualDuration > 16) { // > 1 frame at 60fps
      console.warn(`Slow render: ${id} took ${actualDuration}ms`);
    }
  };
  
  return (
    <Profiler id="MainContent" onRender={handleRender}>
      <MainContent />
    </Profiler>
  );
}
```

### Custom render tracker
```jsx
function useRenderTracker(name) {
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  useEffect(() => {
    console.log(`${name} render #${renderCount.current}`);
  });
  
  return renderCount.current;
}
```

### Why did you update
```jsx
function useWhyDidYouUpdate(name, props) {
  const previous = useRef();
  
  useEffect(() => {
    if (previous.current) {
      const changedProps = Object.entries(props).reduce((result, [key, val]) => {
        if (previous.current[key] !== val) {
          result[key] = { before: previous.current[key], after: val };
        }
        return result;
      }, {});
      
      if (Object.keys(changedProps).length > 0) {
        console.log(`${name} changed props:`, changedProps);
      }
    }
    previous.current = props;
  });
}
```

## Лучшие практики

### Когда мемоизировать
```jsx
// ✅ Мемоизируй тяжелые вычисления
const expensiveResult = useMemo(() => 
  data.reduce(complexCalculation), [data]
);

// ✅ Мемоизируй объекты в props
const config = useMemo(() => ({ sortable: true }), []);

// ✅ Мемоизируй функции для memo компонентов
const handleClick = useCallback((id) => onClick(id), [onClick]);

// ❌ НЕ мемоизируй примитивные вычисления
const greeting = useMemo(() => `Hello ${name}`, [name]); // Излишне
```

### State colocation
```jsx
// ❌ Все в одном компоненте
function App() {
  const [userQuery, setUserQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  
  return (
    <div>
      <UserSearch query={userQuery} onQueryChange={setUserQuery} />
      <ProductSearch query={productQuery} onQueryChange={setProductQuery} />
    </div>
  );
}

// ✅ Локализация состояния
function UserSearch() {
  const [query, setQuery] = useState(''); // Локальное состояние
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

## Anti-patterns

### Избыточная мемоизация
```jsx
// ❌ Избыточно
function Component({ name }) {
  const greeting = useMemo(() => `Hello ${name}`, [name]);
  const handleClick = useCallback(() => console.log('click'), []);
  
  return <div onClick={handleClick}>{greeting}</div>;
}

// ✅ Простота лучше
function Component({ name }) {
  return <div onClick={() => console.log('click')}>Hello {name}</div>;
}
```

### Нестабильные зависимости
```jsx
// ❌ Новый объект каждый раз
function Component({ items, options }) {
  const filtered = useMemo(() => 
    items.filter(matchesOptions(options)), // options может быть нестабильным
    [items, options]
  );
}

// ✅ Стабильные зависимости
function Component({ items, sortBy, filterBy }) {
  const filtered = useMemo(() => 
    items.filter(item => item[filterBy]).sort((a, b) => a[sortBy] - b[sortBy]),
    [items, sortBy, filterBy]
  );
}
```

### Неправильные ключи
```jsx
// ❌ Индекс при изменении порядка
{items.map((item, i) => <Item key={i} item={item} />)}

// ❌ Случайные ключи
{items.map(item => <Item key={Math.random()} item={item} />)}

// ✅ Стабильные уникальные ключи
{items.map(item => <Item key={item.id} item={item} />)}
```

## Performance measurement

```jsx
// Benchmark компонентов
function BenchmarkWrapper({ children, name }) {
  const startTime = useRef();
  
  startTime.current = performance.now();
  
  useLayoutEffect(() => {
    const duration = performance.now() - startTime.current;
    console.log(`${name} render took: ${duration.toFixed(2)}ms`);
  });
  
  return children;
}
```

## Senior Rules

1. **Profile first** - DevTools Profiler покажет реальные проблемы
2. **React.memo для листовых компонентов** - особенно в списках
3. **useMemo для тяжелых вычислений** - не для примитивов
4. **useCallback только с memo** - иначе бесполезно
5. **Стабильные ключи всегда** - никогда индекс для динамических списков
6. **Разделяй контексты** - по ответственности и частоте изменений
7. **Виртуализация для 1000+ элементов** - react-window
8. **State colocation** - держи состояние ближе к использованию
9. **Измеряй результат** - оптимизация может навредить
10. **Don't optimize early** - простота > преждевременная оптимизация

## Debugging инструменты

- **React DevTools Profiler** - анализ производительности
- **why-did-you-render** - npm пакет для отладки
- **React.StrictMode** - дважды выполняет рендеры в dev
- **Performance API** - измерение времени выполнения

**Главное**: Профилируй реальные проблемы, не оптимизируй всё подряд!
