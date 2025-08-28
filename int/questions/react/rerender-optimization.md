# Оптимизация ререндеров в React

## 📋 Вопрос

Оптимизация ререндеров в React: когда и как применять React.memo, useMemo, useCallback? Как диагностировать лишние ререндеры (React DevTools Profiler), выбирать ключи, использовать селекторы контекста/useSyncExternalStore и виртуализацию списков?

## 💡 Ответ

Оптимизация ререндеров — ключевой аспект производительности React приложений. Понимание того, когда и как применять различные техники оптимизации, поможет создавать быстрые и отзывчивые пользовательские интерфейсы.

### Основы ререндеринга в React

#### Когда происходят ререндеры

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('John');
  
  console.log('Parent renders');
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
      <input 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
      />
      
      {/* Child перерендерится при любом изменении в Parent */}
      <Child />
      <ExpensiveChild data={[1, 2, 3]} />
    </div>
  );
}

function Child() {
  console.log('Child renders'); // Рендерится при каждом изменении в Parent
  return <div>I'm a child</div>;
}

function ExpensiveChild({ data }) {
  console.log('ExpensiveChild renders');
  
  // Тяжелые вычисления при каждом рендере
  const processedData = data.map(item => {
    // Сложная обработка
    return performExpensiveOperation(item);
  });
  
  return <div>{processedData.join(', ')}</div>;
}
```

### React.memo - Мемоизация компонентов

#### Базовое использование

```javascript
// Компонент без оптимизации
function UserCard({ user }) {
  console.log('UserCard renders for:', user.name);
  
  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

// Оптимизированный компонент
const MemoizedUserCard = React.memo(function UserCard({ user }) {
  console.log('MemoizedUserCard renders for:', user.name);
  
  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});

// Использование
function UserList({ users, onUserClick }) {
  const [filter, setFilter] = useState('');
  
  return (
    <div>
      <input 
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter users..."
      />
      
      {users.map(user => (
        <MemoizedUserCard
          key={user.id}
          user={user}
          onClick={onUserClick} // ⚠️ Может вызывать ререндеры
        />
      ))}
    </div>
  );
}
```

#### Кастомное сравнение

```javascript
// Компонент с кастомной логикой сравнения
const OptimizedUserCard = React.memo(function UserCard({ user, theme, onClick }) {
  return (
    <div className={`user-card user-card--${theme}`}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onClick(user.id)}>
        View Profile
      </button>
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомная логика сравнения
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.email === nextProps.user.email &&
    prevProps.theme === nextProps.theme &&
    prevProps.onClick === nextProps.onClick
  );
});

// Или более общий подход
const deepCompareUserCard = React.memo(UserCard, (prevProps, nextProps) => {
  // Глубокое сравнение только нужных полей
  const userEqual = isEqual(prevProps.user, nextProps.user);
  const themeEqual = prevProps.theme === nextProps.theme;
  const handlerEqual = prevProps.onClick === nextProps.onClick;
  
  return userEqual && themeEqual && handlerEqual;
});
```

### useMemo - Мемоизация значений

#### Дорогие вычисления

```javascript
function ProductList({ products, filters, sortBy }) {
  // ❌ Плохо: вычисления при каждом рендере
  const filteredProducts = products
    .filter(product => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return product[key].toLowerCase().includes(value.toLowerCase());
      });
    })
    .sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  
  return (
    <div>
      {filteredProducts.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// ✅ Хорошо: мемоизированные вычисления
function OptimizedProductList({ products, filters, sortBy }) {
  const filteredAndSortedProducts = useMemo(() => {
    console.log('Recalculating filtered products');
    
    return products
      .filter(product => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value) return true;
          return product[key].toLowerCase().includes(value.toLowerCase());
        });
      })
      .sort((a, b) => {
        if (sortBy === 'price') return a.price - b.price;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [products, filters, sortBy]);
  
  // Отдельная мемоизация для статистики
  const statistics = useMemo(() => {
    console.log('Recalculating statistics');
    
    return {
      total: filteredAndSortedProducts.length,
      averagePrice: filteredAndSortedProducts.reduce((sum, p) => sum + p.price, 0) / filteredAndSortedProducts.length,
      categories: [...new Set(filteredAndSortedProducts.map(p => p.category))]
    };
  }, [filteredAndSortedProducts]);
  
  return (
    <div>
      <div className="statistics">
        <p>Total: {statistics.total}</p>
        <p>Average Price: ${statistics.averagePrice.toFixed(2)}</p>
        <p>Categories: {statistics.categories.join(', ')}</p>
      </div>
      
      {filteredAndSortedProducts.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

#### Мемоизация объектов и массивов

```javascript
function ComponentWithObjects({ items, config }) {
  // ❌ Плохо: новый объект при каждом рендере
  const tableConfig = {
    sortable: true,
    filterable: true,
    pageSize: config.pageSize || 10
  };
  
  // ❌ Плохо: новый массив при каждом рендере
  const processedItems = items.map(item => ({
    ...item,
    displayName: `${item.firstName} ${item.lastName}`
  }));
  
  return <DataTable config={tableConfig} items={processedItems} />;
}

// ✅ Хорошо: мемоизированные объекты
function OptimizedComponentWithObjects({ items, config }) {
  const tableConfig = useMemo(() => ({
    sortable: true,
    filterable: true,
    pageSize: config.pageSize || 10
  }), [config.pageSize]);
  
  const processedItems = useMemo(() => 
    items.map(item => ({
      ...item,
      displayName: `${item.firstName} ${item.lastName}`
    })), 
    [items]
  );
  
  return <DataTable config={tableConfig} items={processedItems} />;
}
```

### useCallback - Мемоизация функций

#### Стабильные ссылки на функции

```javascript
function TodoList({ todos, onToggle, onDelete }) {
  const [filter, setFilter] = useState('all');
  
  // ❌ Плохо: новые функции при каждом рендере
  const handleToggle = (id) => {
    onToggle(id);
  };
  
  const handleDelete = (id) => {
    onDelete(id);
  };
  
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });
  
  return (
    <div>
      <FilterButtons current={filter} onChange={setFilter} />
      
      {filteredTodos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={handleToggle}    // Новая функция каждый раз
          onDelete={handleDelete}    // Новая функция каждый раз
        />
      ))}
    </div>
  );
}

// ✅ Хорошо: мемоизированные функции
function OptimizedTodoList({ todos, onToggle, onDelete }) {
  const [filter, setFilter] = useState('all');
  
  const handleToggle = useCallback((id) => {
    onToggle(id);
  }, [onToggle]);
  
  const handleDelete = useCallback((id) => {
    onDelete(id);
  }, [onDelete]);
  
  const filteredTodos = useMemo(() => {
    return todos.filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    });
  }, [todos, filter]);
  
  return (
    <div>
      <FilterButtons current={filter} onChange={setFilter} />
      
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

const MemoizedTodoItem = React.memo(TodoItem);
```

#### Сложные обработчики событий

```javascript
function FormComponent({ initialData, onSubmit }) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  
  // Мемоизированная функция валидации
  const validateField = useCallback((name, value) => {
    const validators = {
      email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || 'Invalid email',
      password: (val) => val.length >= 8 || 'Password must be at least 8 characters',
      confirmPassword: (val) => val === formData.password || 'Passwords do not match'
    };
    
    const validator = validators[name];
    return validator ? validator(value) === true ? null : validator(value) : null;
  }, [formData.password]);
  
  const handleFieldChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Валидация на лету
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validateField]);
  
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    // Валидация всех полей
    const newErrors = {};
    Object.entries(formData).forEach(([name, value]) => {
      const error = validateField(name, value);
      if (error) newErrors[name] = error;
    });
    
    if (Object.keys(newErrors).length === 0) {
      onSubmit(formData);
    } else {
      setErrors(newErrors);
    }
  }, [formData, validateField, onSubmit]);
  
  return (
    <form onSubmit={handleSubmit}>
      <FormField
        name="email"
        value={formData.email}
        error={errors.email}
        onChange={handleFieldChange}
      />
      <FormField
        name="password"
        type="password"
        value={formData.password}
        error={errors.password}
        onChange={handleFieldChange}
      />
      <FormField
        name="confirmPassword"
        type="password"
        value={formData.confirmPassword}
        error={errors.confirmPassword}
        onChange={handleFieldChange}
      />
      
      <button type="submit">Submit</button>
    </form>
  );
}

const FormField = React.memo(function FormField({ name, value, error, onChange, ...props }) {
  return (
    <div>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
});
```

### Диагностика с React DevTools Profiler

#### Настройка профилирования

```javascript
import { Profiler } from 'react';

function App() {
  const handleRender = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    console.log('Profiler data:', {
      id,                    // Идентификатор Profiler
      phase,                 // "mount" или "update"
      actualDuration,        // Время, потраченное на рендер
      baseDuration,          // Время без оптимизаций
      startTime,             // Когда начался рендер
      commitTime,            // Когда изменения были применены
      interactions: new Set() // Взаимодействия, вызвавшие рендер
    });
  };
  
  return (
    <div>
      <Profiler id="Navigation" onRender={handleRender}>
        <Navigation />
      </Profiler>
      
      <Profiler id="MainContent" onRender={handleRender}>
        <MainContent />
      </Profiler>
      
      <Profiler id="Sidebar" onRender={handleRender}>
        <Sidebar />
      </Profiler>
    </div>
  );
}
```

#### Создание хука для профилирования

```javascript
function useRenderTracker(componentName) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  renderCount.current += 1;
  
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    console.log(`${componentName} render #${renderCount.current}`, {
      timeSinceLastRender,
      timestamp: new Date().toISOString()
    });
    
    lastRenderTime.current = now;
  });
  
  return renderCount.current;
}

// Использование
function MyComponent({ data }) {
  const renderCount = useRenderTracker('MyComponent');
  
  return (
    <div>
      <span>Render count: {renderCount}</span>
      <div>{JSON.stringify(data)}</div>
    </div>
  );
}
```

### Правильное использование ключей

#### Проблемы с неправильными ключами

```javascript
// ❌ Плохо: индекс как ключ
function BadTodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <TodoItem
          key={index}           // Проблема при реорганизации списка
          todo={todo}
        />
      ))}
    </ul>
  );
}

// При добавлении элемента в начало списка:
// [todo1, todo2, todo3] -> [newTodo, todo1, todo2, todo3]
// React думает:
// - key=0: todo1 -> newTodo (изменился)
// - key=1: todo2 -> todo1 (изменился)  
// - key=2: todo3 -> todo2 (изменился)
// - key=3: undefined -> todo3 (новый)
// Результат: 3 обновления + 1 вставка вместо 1 вставки

// ✅ Хорошо: стабильные уникальные ключи
function GoodTodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}         // Стабильный уникальный ключ
          todo={todo}
        />
      ))}
    </ul>
  );
}
```

#### Составные ключи

```javascript
function CommentsList({ posts }) {
  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          
          {post.comments.map(comment => (
            <Comment
              key={`${post.id}-${comment.id}`} // Составной ключ
              comment={comment}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Для динамически создаваемых элементов
function DynamicForm({ fields }) {
  return (
    <form>
      {fields.map((field, index) => (
        <FormField
          key={field.id || `field-${field.type}-${index}`}
          field={field}
        />
      ))}
    </form>
  );
}
```

### Селекторы контекста

#### Проблема с Context

```javascript
// ❌ Проблема: все consumers ререндерятся
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);
  
  const value = { user, setUser, theme, setTheme, notifications, setNotifications };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

function UserDisplay() {
  const { user } = useContext(AppContext); // Ререндерится при любом изменении
  return <div>{user?.name}</div>;
}

function ThemeToggle() {
  const { theme, setTheme } = useContext(AppContext); // Ререндерится при изменении user
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Toggle</button>;
}
```

#### Решение: Разделенные контексты

```javascript
// ✅ Решение: отдельные контексты
const UserContext = createContext();
const ThemeContext = createContext();
const NotificationsContext = createContext();

function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Теперь компоненты ререндерятся только при изменении нужных данных
function UserDisplay() {
  const { user } = useContext(UserContext); // Только при изменении user
  return <div>{user?.name}</div>;
}

function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext); // Только при изменении theme
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Toggle</button>;
}
```

### useSyncExternalStore

#### Интеграция с внешними store

```javascript
// External store (например, Zustand store)
const useStore = create((set) => ({
  count: 0,
  user: null,
  increment: () => set((state) => ({ count: state.count + 1 })),
  setUser: (user) => set({ user })
}));

// Селектор для подписки только на нужные части состояния
function useCount() {
  return useSyncExternalStore(
    useStore.subscribe,
    () => useStore.getState().count,
    () => 0 // Server-side значение
  );
}

function useUser() {
  return useSyncExternalStore(
    useStore.subscribe,
    () => useStore.getState().user,
    () => null
  );
}

// Компоненты ререндерятся только при изменении своих данных
function Counter() {
  const count = useCount(); // Только при изменении count
  const increment = useStore(state => state.increment);
  
  return (
    <button onClick={increment}>
      Count: {count}
    </button>
  );
}

function UserProfile() {
  const user = useUser(); // Только при изменении user
  
  return <div>{user?.name || 'Anonymous'}</div>;
}
```

### Виртуализация списков

#### Проблема больших списков

```javascript
// ❌ Проблема: рендер всех элементов
function HugeList({ items }) {
  return (
    <div className="list">
      {items.map(item => (
        <div key={item.id} className="list-item">
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <img src={item.thumbnail} alt={item.title} />
        </div>
      ))}
    </div>
  );
}

// При 10,000 элементов - серьезные проблемы с производительностью
```

#### Решение: react-window

```javascript
import { FixedSizeList as List } from 'react-window';

// ✅ Виртуализированный список
function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style} className="list-item">
      <h3>{items[index].title}</h3>
      <p>{items[index].description}</p>
      <img src={items[index].thumbnail} alt={items[index].title} />
    </div>
  );
  
  return (
    <List
      height={600}        // Высота видимой области
      itemCount={items.length}
      itemSize={120}      // Высота каждого элемента
      width="100%"
    >
      {Row}
    </List>
  );
}

// Для элементов разной высоты
import { VariableSizeList as VariableList } from 'react-window';

function VariableHeightList({ items }) {
  const getItemSize = (index) => {
    // Вычисляем высоту на основе содержимого
    const item = items[index];
    const baseHeight = 80;
    const descriptionHeight = item.description.length > 100 ? 40 : 20;
    return baseHeight + descriptionHeight;
  };
  
  const Row = ({ index, style }) => (
    <div style={style} className="list-item">
      <h3>{items[index].title}</h3>
      <p>{items[index].description}</p>
    </div>
  );
  
  return (
    <VariableList
      height={600}
      itemCount={items.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableList>
  );
}
```

#### Кастомная виртуализация

```javascript
function useVirtualization({ itemCount, itemHeight, containerHeight }) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    itemCount - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight)
  );
  
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push(i);
  }
  
  const totalHeight = itemCount * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return {
    startIndex,
    endIndex,
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  };
}

function CustomVirtualList({ items, itemHeight = 50 }) {
  const containerRef = useRef();
  const [containerHeight, setContainerHeight] = useState(400);
  
  const {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  } = useVirtualization({
    itemCount: items.length,
    itemHeight,
    containerHeight
  });
  
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };
  
  return (
    <div
      ref={containerRef}
      className="virtual-list"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(index => (
            <div
              key={items[index].id}
              style={{ height: itemHeight }}
              className="list-item"
            >
              {items[index].title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Лучшие практики и антипаттерны

#### Когда НЕ использовать оптимизации

```javascript
// ❌ Избыточная мемоизация
function OverOptimized({ name, age }) {
  // Не нужно мемоизировать примитивные вычисления
  const greeting = useMemo(() => `Hello, ${name}!`, [name]);
  
  // Не нужно мемоизировать простые функции
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);
  
  return (
    <div onClick={handleClick}>
      {greeting} You are {age} years old.
    </div>
  );
}

// ✅ Оптимизация только где нужно
function WellOptimized({ users, onUserSelect }) {
  // Мемоизируем тяжелые вычисления
  const sortedUsers = useMemo(() => {
    return users.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [users]);
  
  // Мемоизируем функции, передаваемые в memo компоненты
  const handleUserSelect = useCallback((userId) => {
    onUserSelect(userId);
  }, [onUserSelect]);
  
  return (
    <div>
      {sortedUsers.map(user => (
        <MemoizedUserCard
          key={user.id}
          user={user}
          onSelect={handleUserSelect}
        />
      ))}
    </div>
  );
}
```

#### Измерение производительности

```javascript
function PerformanceMonitor({ children }) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  
  const onRenderCallback = useCallback((id, phase, actualDuration) => {
    renderCount.current += 1;
    const now = performance.now();
    
    console.log(`Render #${renderCount.current}:`, {
      component: id,
      phase,
      duration: actualDuration,
      timeSinceLastRender: now - lastRenderTime.current
    });
    
    lastRenderTime.current = now;
    
    // Предупреждение о медленных рендерах
    if (actualDuration > 16) { // > 1 frame at 60fps
      console.warn(`Slow render detected: ${actualDuration}ms`);
    }
  }, []);
  
  return (
    <Profiler id="PerformanceMonitor" onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
}
```

### Senior-советы

1. **Профилируйте сначала** - используйте React DevTools Profiler для выявления реальных проблем
2. **React.memo для "листовых" компонентов** - особенно в списках и таблицах
3. **useMemo для тяжелых вычислений** - фильтрация, сортировка, трансформация данных
4. **useCallback для стабильных обработчиков** - особенно передаваемых в memo компоненты
5. **Стабильные ключи критичны** - никогда не используйте индекс для динамических списков
6. **Разделяйте контексты** - по ответственности и частоте изменений
7. **Виртуализация для больших списков** - react-window или кастомное решение
8. **Измеряйте результат** - оптимизация без измерений может навредить

### Инструменты для отладки

```javascript
// Хук для отслеживания изменений props
function useWhyDidYouUpdate(name, props) {
  const previous = useRef();
