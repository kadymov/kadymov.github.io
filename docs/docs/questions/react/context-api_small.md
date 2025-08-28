# Context API vs Redux - Senior Cheat Sheet (small)

## Когда что использовать

### Context API ✅
- **Простое состояние** (theme, user, config)
- **UI настройки** (модальные окна, sidebar)
- **Локальное состояние** (форма, wizard)
- **Небольшие приложения** (<10 компонентов)

### Redux ✅
- **Сложное состояние** (корзина, кэш API)
- **Много взаимосвязанных обновлений**
- **История изменений** (undo/redo)
- **DevTools и отладка**
- **Большие команды**

## Context API - основы

### Простой контекст
```jsx
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook
function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

### С useReducer для сложного состояния
```jsx
const initialState = {
  user: null,
  loading: false,
  error: null
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { ...state, loading: false, user: action.payload };
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const user = await authService.login(credentials);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: error.message });
    }
  };
  
  return (
    <AppContext.Provider value={{ ...state, login }}>
      {children}
    </AppContext.Provider>
  );
}
```

## Redux Toolkit - современный подход

```jsx
import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunk
const fetchUser = createAsyncThunk(
  'user/fetchById',
  async (userId) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  }
);

// Slice
const userSlice = createSlice({
  name: 'user',
  initialState: { entity: null, loading: 'idle' },
  reducers: {
    clearUser: (state) => { state.entity = null; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = 'pending';
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = 'succeeded';
        state.entity = action.payload;
      });
  }
});

// Store
const store = configureStore({
  reducer: { user: userSlice.reducer }
});

// Component
function UserProfile({ userId }) {
  const user = useSelector(state => state.user.entity);
  const loading = useSelector(state => state.user.loading);
  const dispatch = useDispatch();
  
  useEffect(() => {
    dispatch(fetchUser(userId));
  }, [dispatch, userId]);
  
  if (loading === 'pending') return <div>Loading...</div>;
  
  return <div>{user?.name}</div>;
}
```

## Performance проблемы

### Context - проблема ререндеров
```jsx
// ❌ Все consumers рендерятся при любом изменении
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  
  // Новый объект каждый раз!
  const value = { user, setUser, theme, setTheme };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ✅ Решение 1: Разделение контекстов
function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');  
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

// ✅ Решение 2: Мемоизация
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

### Redux - селекторы
```jsx
// ❌ Плохо - подписка на весь state
const state = useSelector(state => state); // Рендер при любом изменении

// ✅ Хорошо - конкретное значение
const userName = useSelector(state => state.user.name);

// ✅ Еще лучше - мемоизированный селектор
import { createSelector } from '@reduxjs/toolkit';

const selectUserData = createSelector(
  [state => state.user],
  (user) => ({ name: user.name, email: user.email })
);
```

## Гибридный подход

```jsx
function App() {
  return (
    <Provider store={store}> {/* Redux для данных */}
      <AuthProvider>     {/* Context для auth */}
        <ThemeProvider>  {/* Context для UI */}
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </Provider>
  );
}

function ProductList() {
  // Redux для бизнес-логики  
  const products = useSelector(selectProducts);
  const dispatch = useDispatch();
  
  // Context для UI состояния
  const { theme } = useTheme();
  
  return (
    <div className={`products products--${theme}`}>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

## Тестирование

### Context
```jsx
// Test Provider
function TestProvider({ children, initialUser = null }) {
  const [user, setUser] = useState(initialUser);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

test('user context works', () => {
  render(
    <TestProvider initialUser={{ name: 'John' }}>
      <UserComponent />
    </TestProvider>
  );
  
  expect(screen.getByText('Hello John')).toBeInTheDocument();
});
```

### Redux
```jsx
// Test store
function createTestStore(initialState = {}) {
  return configureStore({
    reducer: { user: userSlice.reducer },
    preloadedState: initialState
  });
}

test('user slice works', () => {
  const store = createTestStore();
  
  render(
    <Provider store={store}>
      <UserComponent />
    </Provider>
  );
  
  // Test interactions...
});

// Test reducers separately
test('userSlice handles login', () => {
  const initialState = { user: null, loading: false };
  const action = { type: 'user/loginSuccess', payload: { name: 'John' } };
  
  const newState = userSlice.reducer(initialState, action);
  expect(newState.user.name).toBe('John');
});
```

## Архитектурные паттерны

### Множественные контексты
```jsx
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

### Redux - feature-based structure
```
src/
  features/
    auth/
      authSlice.js
      authAPI.js  
      components/
    products/
      productsSlice.js
      productsAPI.js
      components/
  app/
    store.js
    rootReducer.js
```

## Senior Rules

1. **Context для простого** - theme, auth, config
2. **Redux для сложного** - корзина, кэш, формы
3. **Не всё в один контекст** - разделяй ответственности
4. **Мемоизируй Context value** - избегай лишних рендеров
5. **Специфичные селекторы** в Redux
6. **Гибридный подход** в больших приложениях
7. **Redux Toolkit только** - не используй legacy Redux
8. **Тестируй логику отдельно** от UI

## Миграция Context → Redux

```jsx
// Было: Context + useReducer
const [state, dispatch] = useReducer(cartReducer, initialState);

// Стало: Redux Toolkit slice
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => {
      state.items.push(action.payload);
    }
  }
});
```

**Decision Tree:**
- Простое состояние + мало consumers = **Context**
- Сложное состояние + много consumers = **Redux**  
- Локальное состояние компонента = **useState/useReducer**
- Глобальное кэширование данных = **Redux + RTK Query**

**Главное**: Начни с Context, мигрируй на Redux при необходимости!
