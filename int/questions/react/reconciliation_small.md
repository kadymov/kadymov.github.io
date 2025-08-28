# Reconciliation & Virtual DOM - Senior Cheat Sheet

## Основы

**Virtual DOM** = JavaScript представление реального DOM
**Reconciliation** = Процесс сравнения нового VDOM с предыдущим

### Процесс Reconciliation

1. **Render Phase** - создание нового VDOM дерева
2. **Reconciliation Phase** - diffing (сравнение)
3. **Commit Phase** - применение изменений к DOM

## Diffing Algorithm O(n)

### Правила сравнения

1. **Разные типы** = полная перестройка
```jsx
// div → span: Counter размонтируется полностью
<div><Counter /></div>  →  <span><Counter /></span>
```

2. **Одинаковые типы** = обновление props
```jsx
<div className="old" />  →  <div className="new" />
// Только className изменится
```

3. **Компоненты одного типа** = state сохраняется
```jsx
<Counter start={0} />  →  <Counter start={5} />
// state остается, только props обновляются
```

### Keys - критически важно!

```jsx
// ❌ Без ключей - плохая производительность
{todos.map(todo => <li>{todo.text}</li>)}

// ✅ С уникальными ключами
{todos.map(todo => <li key={todo.id}>{todo.text}</li>)}

// ❌ Индекс как key для динамических списков
{todos.map((todo, index) => <li key={index}>{todo.text}</li>)}
```

## Fiber Architecture (React 16+)

### Приоритеты задач
```javascript
const priorities = {
  IMMEDIATE: 1,        // Click handlers
  USER_BLOCKING: 2,    // Input, hover
  NORMAL: 3,           // Обычные обновления  
  LOW: 4,              // Фоновые операции
  IDLE: 5              // Свободное время
};
```

**Преимущество**: Fiber может прерывать низкоприоритетную работу для обработки пользовательского ввода.

## Оптимизация Reconciliation

### 1. React.memo - предотвращение рендеров

```jsx
// Базовое мемо
const ExpensiveChild = React.memo(function({ data, onClick }) {
  return <div>{/* тяжелые вычисления */}</div>;
});

// Кастомное сравнение
const SmartChild = React.memo(Child, (prevProps, nextProps) => {
  return prevProps.data.length === nextProps.data.length;
});
```

### 2. useMemo & useCallback

```jsx
function OptimizedParent({ items, filter }) {
  // Мемоизация вычислений
  const filteredItems = useMemo(() => 
    items.filter(item => item.category === filter), [items, filter]
  );
  
  // Стабильная ссылка на функцию
  const handleClick = useCallback((id) => {
    console.log('clicked', id);
  }, []);
  
  return <Child data={filteredItems} onClick={handleClick} />;
}
```

### 3. Разделение состояния

```jsx
// ❌ Одно большое состояние
const [bigState, setBigState] = useState({ count: 0, text: '', users: [] });

// ✅ Разделенное состояние
const [count, setCount] = useState(0);
const [text, setText] = useState('');
const [users, setUsers] = useState([]);
```

## Типичные проблемы

### 1. Лишние рендеры
```jsx
// ❌ ExpensiveChild рендерится при любом изменении Parent
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <ExpensiveChild data="static" /> {/* Всегда рендерится */}
    </div>
  );
}

// ✅ Разделение компонентов
function Parent() {
  return (
    <div>
      <Counter />
      <ExpensiveChild data="static" />
    </div>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### 2. Неправильные keys
```jsx
// ❌ Индекс при удалении/добавлении
todos.map((todo, index) => <TodoItem key={index} todo={todo} />)

// При удалении первого элемента все последующие перерендерятся

// ✅ Стабильные уникальные keys
todos.map(todo => <TodoItem key={todo.id} todo={todo} />)
```

## Performance Patterns

### Виртуализация для больших списков
```jsx
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ items }) => (
  <List height={600} itemCount={items.length} itemSize={50}>
    {({ index, style }) => (
      <div style={style}>{items[index].name}</div>
    )}
  </List>
);
```

### Lazy loading компонентов
```jsx
import { Suspense, lazy } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

## Debugging

### Profiler API
```jsx
function onRenderCallback(id, phase, actualDuration, baseDuration) {
  console.log({ id, phase, actualDuration, baseDuration });
}

<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>
```

### React DevTools
- **Profiler** tab - анализ производительности
- **Components** tab - props, state, рендеры
- **Highlight updates** - визуализация рендеров

## Senior Rules

1. **Keys matter!** - уникальные и стабильные для списков
2. **Split state** - мелкие независимые состояния
3. **Memo wisely** - не мемоизируй всё подряд
4. **Profile first** - измеряй перед оптимизацией
5. **Understand diffing** - тип компонента = полная перестройка
6. **Stable references** - useCallback для функций в props
7. **Component structure** - архитектура влияет на производительность

## Anti-patterns

```jsx
// ❌ Создание компонентов внутри рендера
function Parent() {
  const Child = () => <div>Child</div>; // Новый тип каждый рендер!
  return <Child />;
}

// ❌ Нестабильные объекты в props
<Child config={{ option: true }} /> // Новый объект каждый рендер

// ❌ Функции без useCallback в зависимостях
const fn = () => {}; // Новая функция каждый рендер
<Child onClick={fn} />

// ❌ Условный рендеринг меняющий позицию
{condition && <ComponentA />}
<ComponentB />
// ComponentB меняет позицию в дереве
```

**Главное**: Reconciliation = сравнение деревьев. Стабильная структура = лучшая производительность!
