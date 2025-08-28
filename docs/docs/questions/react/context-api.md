# Context API vs Redux

## 📋 Вопрос

Как использовать Context API в React для управления состоянием, и когда его предпочесть Redux?

## 💡 Ответ

Context API и Redux — два популярных решения для управления состоянием в React. Каждый имеет свои преимущества и лучше подходит для определенных сценариев использования.

### Context API - Встроенное решение React

Context API позволяет передавать данные через дерево компонентов без необходимости передавать props на каждом уровне.

#### Основы Context API

```javascript
import React, { createContext, useContext, useState } from 'react';

// 1. Создание контекста
const ThemeContext = createContext();

// 2. Provider компонент
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  
  const value = {
    theme,
    toggleTheme
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// 3. Custom hook для использования контекста
function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// 4. Использование в компонентах
function Header() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header className={`header header--${theme}`}>
      <h1>My App</h1>
      <button onClick={toggleTheme}>
        Switch to {theme === 'light' ? 'dark' : 'light'} theme
      </button>
    </header>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Header />
      <main>
        <Content />
      </main>
    </ThemeProvider>
  );
}
```

#### Сложное состояние с useReducer

```javascript
// Состояние с множественными значениями
const initialState = {
  user: null,
  loading: false,
  error: null,
  notifications: []
};

// Reducer для управления состоянием
function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        user: action.payload,
        error: null
      };
    case 'LOGIN_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        notifications: []
      };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(
          notif => notif.id !== action.payload
        )
      };
    default:
      return state;
  }
}

// Context с reducer
const AppContext = createContext();

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Action creators
  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const user = await response.json();
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: error.message });
    }
  };
  
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };
  
  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  };
  
  const removeNotification = (id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };
  
  const value = {
    ...state,
    login,
    logout,
    addNotification,
    removeNotification
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
```

#### Множественные контексты

```javascript
// Разделение на специализированные контексты
const AuthContext = createContext();
const UIContext = createContext();
const DataContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const login = async (credentials) => {
    setLoading(true);
    try {
      const user = await authService.login(credentials);
      setUser(user);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, login }}>
      {children}
    </AuthContext.Provider>
  );
}

function UIProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modals, setModals] = useState([]);
  
  return (
    <UIContext.Provider value={{ 
      theme, 
      setTheme, 
      sidebarOpen, 
      setSidebarOpen,
      modals,
      setModals 
    }}>
      {children}
    </UIContext.Provider>
  );
}

// Композиция провайдеров
function AppProviders({ children }) {
  return (
    <AuthProvider>
      <UIProvider>
        <DataProvider>
          {children}
        </DataProvider>
      </UIProvider>
    </AuthProvider>
  );
}
```

### Redux - Предсказуемое управление состоянием

Redux предоставляет централизованное хранилище состояния с предсказуемыми обновлениями через actions и reducers.

#### Основы Redux

```javascript
import { createStore, combineReducers } from 'redux';
import { Provider, useSelector, useDispatch } from 'react-redux';

// Actions
const INCREMENT = 'INCREMENT';
const DECREMENT = 'DECREMENT';
const SET_USER = 'SET_USER';
const SET_LOADING = 'SET_LOADING';

// Action creators
const increment = () => ({ type: INCREMENT });
const decrement = () => ({ type: DECREMENT });
const setUser = (user) => ({ type: SET_USER, payload: user });
const setLoading = (loading) => ({ type: SET_LOADING, payload: loading });

// Reducers
function counterReducer(state = { count: 0 }, action) {
  switch (action.type) {
    case INCREMENT:
      return { ...state, count: state.count + 1 };
    case DECREMENT:
      return { ...state, count: state.count - 1 };
    default:
      return state;
  }
}

function userReducer(state = { user: null, loading: false }, action) {
  switch (action.type) {
    case SET_USER:
      return { ...state, user: action.payload };
    case SET_LOADING:
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

// Root reducer
const rootReducer = combineReducers({
  counter: counterReducer,
  user: userReducer
});

// Store
const store = createStore(rootReducer);

// Component
function Counter() {
  const count = useSelector(state => state.counter.count);
  const dispatch = useDispatch();
  
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => dispatch(increment())}>+</button>
      <button onClick={() => dispatch(decrement())}>-</button>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <Counter />
    </Provider>
  );
}
```

#### Redux Toolkit (современный подход)

```javascript
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { Provider, useSelector, useDispatch } from 'react-redux';

// Slice (объединяет actions и reducer)
const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    value: 0,
    step: 1
  },
  reducers: {
    increment: (state) => {
      // Immer позволяет "мутировать" состояние
      state.value += state.step;
    },
    decrement: (state) => {
      state.value -= state.step;
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload;
    },
    setStep: (state, action) => {
      state.step = action.payload;
    }
  }
});

// Экспорт действий
export const { increment, decrement, incrementByAmount, setStep } = counterSlice.actions;

// Async thunk для асинхронных операций
import { createAsyncThunk } from '@reduxjs/toolkit';

const fetchUserById = createAsyncThunk(
  'users/fetchById',
  async (userId) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState: {
    entity: null,
    loading: 'idle' // 'idle' | 'pending' | 'succeeded' | 'failed'
  },
  reducers: {
    clearUser: (state) => {
      state.entity = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.loading = 'pending';
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = 'succeeded';
        state.entity = action.payload;
      })
      .addCase(fetchUserById.rejected, (state) => {
        state.loading = 'failed';
      });
  }
});

// Store
const store = configureStore({
  reducer: {
    counter: counterSlice.reducer,
    user: userSlice.reducer
  }
});

// Selectors
const selectCount = (state) => state.counter.value;
const selectUser = (state) => state.user.entity;
const selectUserLoading = (state) => state.user.loading;

// Component
function UserProfile({ userId }) {
  const user = useSelector(selectUser);
  const loading = useSelector(selectUserLoading);
  const dispatch = useDispatch();
  
  useEffect(() => {
    dispatch(fetchUserById(userId));
  }, [dispatch, userId]);
  
  if (loading === 'pending') return <div>Loading...</div>;
  if (loading === 'failed') return <div>Error loading user</div>;
  
  return (
    <div>
      <h1>{user?.name}</h1>
      <p>{user?.email}</p>
    </div>
  );
}
```

### Сравнение Context API и Redux

#### Когда использовать Context API

```javascript
// ✅ Хорошо для Context API:

// 1. Простое состояние
function SimpleThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 2. Компонентно-специфичное состояние
function FormProvider({ children }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  
  return (
    <FormContext.Provider value={{ formData, setFormData, errors, setErrors }}>
      {children}
    </FormContext.Provider>
  );
}

// 3. Конфигурация приложения
function ConfigProvider({ children }) {
  const [config] = useState({
    apiUrl: process.env.REACT_APP_API_URL,
    features: {
      enableAnalytics: true,
      enableChat: false
    }
  });
  
  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}
```

#### Когда использовать Redux

```javascript
// ✅ Хорошо для Redux:

// 1. Сложное состояние с множественными обновлениями
const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    total: 0,
    discount: null,
    shipping: null
  },
  reducers: {
    addItem: (state, action) => {
      const item = action.payload;
      const existingItem = state.items.find(i => i.id === item.id);
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        state.items.push(item);
      }
      
      // Пересчет total
      state.total = calculateTotal(state.items, state.discount, state.shipping);
    },
    removeItem: (state, action) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      state.total = calculateTotal(state.items, state.discount, state.shipping);
    },
    applyDiscount: (state, action) => {
      state.discount = action.payload;
      state.total = calculateTotal(state.items, state.discount, state.shipping);
    }
  }
});

// 2. Состояние, которое используется в множестве компонентов
// - Корзина товаров
// - Данные пользователя
// - Уведомления
// - Кэш API данных

// 3. Нужна история изменений и отладка
// Redux DevTools показывают все действия и изменения состояния
```

### Проблемы производительности

#### Context API - проблема ререндеров

```javascript
// ❌ Проблема: все consumers ререндерятся
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);
  
  // При изменении любого значения все consumers ререндерятся
  const value = { user, setUser, theme, setTheme, notifications, setNotifications };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// ✅ Решение 1: Разделение контекстов
function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ✅ Решение 2: Мемоизация значения
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  
  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  
  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

#### Redux - селекторы для оптимизации

```javascript
// ❌ Плохо: компонент ререндерится при любом изменении state
function UserProfile() {
  const state = useSelector(state => state); // Весь state!
  
  return <div>{state.user.name}</div>;
}

// ✅ Хорошо: селектор конкретного значения
function UserProfile() {
  const userName = useSelector(state => state.user.name);
  
  return <div>{userName}</div>;
}

// ✅ Еще лучше: мемоизированный селектор
import { createSelector } from '@reduxjs/toolkit';

const selectUser = state => state.user;
const selectUserName = createSelector(
  [selectUser],
  user => user.name
);

function UserProfile() {
  const userName = useSelector(selectUserName);
  
  return <div>{userName}</div>;
}
```

### Middleware и расширяемость

#### Redux middleware

```javascript
// Logger middleware
const loggerMiddleware = store => next => action => {
  console.log('Dispatching:', action);
  const result = next(action);
  console.log('Next state:', store.getState());
  return result;
};

// Async middleware (thunk)
const thunkMiddleware = store => next => action => {
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }
  return next(action);
};

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(loggerMiddleware)
});

// Async action с thunk
const fetchUser = (userId) => async (dispatch, getState) => {
  dispatch(setLoading(true));
  try {
    const response = await fetch(`/api/users/${userId}`);
    const user = await response.json();
    dispatch(setUser(user));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};
```

### Тестирование

#### Тестирование Context API

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock provider для тестов
function TestProvider({ children, initialTheme = 'light' }) {
  const [theme, setTheme] = useState(initialTheme);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

test('theme toggle works', async () => {
  render(
    <TestProvider>
      <ThemeToggle />
    </TestProvider>
  );
  
  const button = screen.getByRole('button');
  expect(button).toHaveTextContent('Switch to dark theme');
  
  await userEvent.click(button);
  expect(button).toHaveTextContent('Switch to light theme');
});
```

#### Тестирование Redux

```javascript
import { createStore } from 'redux';
import { Provider } from 'react-redux';

// Создание тестового store
function createTestStore(initialState = {}) {
  return createStore(rootReducer, initialState);
}

test('counter increment works', async () => {
  const store = createTestStore({ counter: { count: 0 } });
  
  render(
    <Provider store={store}>
      <Counter />
    </Provider>
  );
  
  const button = screen.getByText('+');
  await userEvent.click(button);
  
  expect(store.getState().counter.count).toBe(1);
});

// Тестирование reducers отдельно
test('counter reducer handles increment', () => {
  const initialState = { count: 0 };
  const action = { type: 'INCREMENT' };
  const newState = counterReducer(initialState, action);
  
  expect(newState.count).toBe(1);
});
```

### Практические рекомендации

#### Гибридный подход

```javascript
// Используйте оба решения в одном приложении
function App() {
  return (
    <Provider store={store}> {/* Redux для глобального состояния */}
      <AuthProvider> {/* Context для аутентификации */}
        <ThemeProvider> {/* Context для UI настроек */}
          <Router>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </Provider>
  );
}

// В компонентах используйте подходящий инструмент
function ProductList() {
  // Redux для данных продуктов
  const products = useSelector(selectProducts);
  const dispatch = useDispatch();
  
  // Context для темы
  const { theme } = useTheme();
  
  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);
  
  return (
    <div className={`product-list product-list--${theme}`}>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### Миграция между решениями

#### От Context к Redux

```javascript
// Было: Context
const AppContext = createContext();

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Стало: Redux Toolkit
const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // Те же reducers, что были в appReducer
  }
});

const store = configureStore({
  reducer: {
    app: appSlice.reducer
  }
});
```

### Senior-советы

1. **Context API** для простого состояния, настроек UI, аутентификации
2. **Redux** для сложного состояния, кэширования данных, множественных обновлений
3. **Комбинируйте** - Context для локального, Redux для глобального состояния
4. **Оптимизируйте** - разделяйте контексты, используйте селекторы в Redux
5. **Тестируйте** состояние отдельно от компонентов
6. **Не переинжинирьте** - начните с простого, усложняйте по необходимости
7. **Redux Toolkit** предпочтительнее классического Redux

## 🔗 Связанные темы

- [Архитектура состояния приложения](../architecture/state-architecture.md)
- [Оптимизация ререндеров](rerender-optimization.md)
- [useEffect и Side Effects](use-effect.md)
- [Higher-Order Components (HOC)](hoc.md)
