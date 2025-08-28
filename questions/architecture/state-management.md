# Архитектура управления состоянием

## Описание
Вопрос касается различных подходов к организации и управлению состоянием в масштабных frontend-приложениях, включая выбор между Redux, Context API, Zustand и другими решениями.

## Детальный ответ

### Сравнение подходов управления состоянием

#### Redux
**Преимущества**:
- Предсказуемые изменения состояния
- Отличные DevTools
- Middleware система
- Time travel debugging
- Строгая архитектура

**Недостатки**:
- Много boilerplate кода
- Кривая обучения
- Overkill для простых приложений

```javascript
// Redux Toolkit - современный подход
import { createSlice, configureStore } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {
    profile: null,
    loading: false,
    error: null,
  },
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setUser: (state, action) => {
      state.profile = action.payload;
      state.loading = false;
      state.error = null;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

// Async thunk для API вызовов
export const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.getUser(userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});
```

#### Context API + useReducer
**Преимущества**:
- Встроен в React
- Нет дополнительных зависимостей
- Простота для локального состояния

**Недостатки**:
- Проблемы с производительностью при частых обновлениях
- Нет встроенных DevTools
- Сложность отладки в больших приложениях

```javascript
// Архитектура с Context API
const UserContext = createContext();
const UserDispatchContext = createContext();

function userReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        profile: action.payload,
        loading: false,
        error: null,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, {
    profile: null,
    loading: false,
    error: null,
  });

  return (
    <UserContext.Provider value={state}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserContext.Provider>
  );
}

// Кастомные хуки для удобства использования
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export function useUserDispatch() {
  const context = useContext(UserDispatchContext);
  if (context === undefined) {
    throw new Error('useUserDispatch must be used within a UserProvider');
  }
  return context;
}
```

#### Zustand
**Преимущества**:
- Минимальный boilerplate
- TypeScript поддержка из коробки
- Хорошая производительность
- Простота тестирования

```javascript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useUserStore = create(
  devtools(
    persist(
      (set, get) => ({
        profile: null,
        loading: false,
        error: null,
        
        setLoading: (loading) => set({ loading }),
        
        setUser: (profile) => set({
          profile,
          loading: false,
          error: null,
        }),
        
        setError: (error) => set({
          error,
          loading: false,
        }),
        
        fetchUser: async (userId) => {
          set({ loading: true });
          try {
            const user = await api.getUser(userId);
            get().setUser(user);
          } catch (error) {
            get().setError(error.message);
          }
        },
        
        reset: () => set({
          profile: null,
          loading: false,
          error: null,
        }),
      }),
      {
        name: 'user-storage',
        partialize: (state) => ({ profile: state.profile }),
      }
    )
  )
);
```

### Архитектурные паттерны

#### Flux Architecture
```javascript
// Однонаправленный поток данных
// Action -> Dispatcher -> Store -> View -> Action

// Actions
const UserActions = {
  FETCH_USER_REQUEST: 'FETCH_USER_REQUEST',
  FETCH_USER_SUCCESS: 'FETCH_USER_SUCCESS',
  FETCH_USER_FAILURE: 'FETCH_USER_FAILURE',
};

// Action Creators
const fetchUser = (userId) => async (dispatch) => {
  dispatch({ type: UserActions.FETCH_USER_REQUEST });
  
  try {
    const user = await api.getUser(userId);
    dispatch({
      type: UserActions.FETCH_USER_SUCCESS,
      payload: user,
    });
  } catch (error) {
    dispatch({
      type: UserActions.FETCH_USER_FAILURE,
      payload: error.message,
    });
  }
};
```

#### CQRS (Command Query Responsibility Segregation)
```javascript
// Разделение команд и запросов
class UserCommands {
  constructor(store) {
    this.store = store;
  }
  
  async updateProfile(userId, data) {
    this.store.dispatch({ type: 'UPDATE_PROFILE_START' });
    
    try {
      await api.updateUser(userId, data);
      this.store.dispatch({
        type: 'UPDATE_PROFILE_SUCCESS',
        payload: { userId, data },
      });
    } catch (error) {
      this.store.dispatch({
        type: 'UPDATE_PROFILE_ERROR',
        payload: error.message,
      });
    }
  }
}

class UserQueries {
  constructor(store) {
    this.store = store;
  }
  
  getUser(userId) {
    return this.store.getState().users.entities[userId];
  }
  
  getUsersList() {
    return Object.values(this.store.getState().users.entities);
  }
  
  isUserLoading(userId) {
    return this.store.getState().users.loading[userId] || false;
  }
}
```

### Нормализация данных

```javascript
// Нормализованная структура состояния
const normalizedState = {
  users: {
    byId: {
      '1': { id: '1', name: 'John', posts: ['1', '2'] },
      '2': { id: '2', name: 'Jane', posts: ['3'] },
    },
    allIds: ['1', '2'],
  },
  posts: {
    byId: {
      '1': { id: '1', title: 'Post 1', authorId: '1' },
      '2': { id: '2', title: 'Post 2', authorId: '1' },
      '3': { id: '3', title: 'Post 3', authorId: '2' },
    },
    allIds: ['1', '2', '3'],
  },
};

// Селекторы для денормализации
const selectUserWithPosts = createSelector(
  [selectUserById, selectAllPosts],
  (user, posts) => ({
    ...user,
    posts: user.posts.map(postId => posts[postId]),
  })
);
```

### Оптимизация производительности

#### Мемоизация селекторов
```javascript
import { createSelector } from '@reduxjs/toolkit';

// Базовые селекторы
const selectUsers = (state) => state.users.byId;
const selectUserIds = (state) => state.users.allIds;
const selectFilter = (state) => state.ui.userFilter;

// Мемоизированные селекторы
const selectFilteredUsers = createSelector(
  [selectUsers, selectUserIds, selectFilter],
  (users, userIds, filter) => {
    if (!filter) return userIds.map(id => users[id]);
    
    return userIds
      .map(id => users[id])
      .filter(user => 
        user.name.toLowerCase().includes(filter.toLowerCase())
      );
  }
);
```

#### Subscription паттерн
```javascript
// Паттерн подписки для оптимизации Context API
function createSubscription() {
  const listeners = new Set();
  
  return {
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    
    notify: (data) => {
      listeners.forEach(callback => callback(data));
    },
  };
}

// Контекст с подпиской
const StateContext = createContext();

function StateProvider({ children }) {
  const [state, setState] = useState(initialState);
  const subscription = useMemo(() => createSubscription(), []);
  
  const updateState = useCallback((newState) => {
    setState(newState);
    subscription.notify(newState);
  }, [subscription]);
  
  return (
    <StateContext.Provider value={{ state, updateState, subscription }}>
      {children}
    </StateContext.Provider>
  );
}
```

### Middleware и побочные эффекты

#### Redux Saga
```javascript
import { call, put, takeEvery, takeLatest } from 'redux-saga/effects';

function* fetchUserSaga(action) {
  try {
    yield put({ type: 'FETCH_USER_REQUEST' });
    const user = yield call(api.getUser, action.payload.userId);
    yield put({ type: 'FETCH_USER_SUCCESS', payload: user });
  } catch (error) {
    yield put({ type: 'FETCH_USER_FAILURE', payload: error.message });
  }
}

function* watchFetchUser() {
  yield takeLatest('FETCH_USER', fetchUserSaga);
}

function* rootSaga() {
  yield all([
    watchFetchUser(),
    // другие watchers...
  ]);
}
```

#### Custom Middleware
```javascript
const apiMiddleware = (store) => (next) => (action) => {
  if (action.type?.endsWith('_REQUEST')) {
    // Логирование API запросов
    console.log('API Request:', action);
  }
  
  return next(action);
};

const errorMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  
  if (action.error) {
    // Централизованная обработка ошибок
    console.error('Error occurred:', action.payload);
    // Показать toast notification
  }
  
  return result;
};
```

## Рекомендации по выбору

### Критерии выбора решения

1. **Размер приложения**:
   - Малые: useState + Context API
   - Средние: Zustand или Context API + useReducer
   - Большие: Redux Toolkit

2. **Команда**:
   - Джуниоры: Context API
   - Миксованная: Zustand
   - Опытная: Redux

3. **Требования**:
   - DevTools: Redux
   - Простота: Zustand
   - TypeScript: Zustand или Redux Toolkit
   - SSR: любое с правильной гидратацией

### Best Practices

1. **Держите состояние локальным**: Поднимайте состояние только когда необходимо
2. **Нормализуйте данные**: Избегайте дублирования и вложенности
3. **Используйте селекторы**: Мемоизируйте вычисления
4. **Разделяйте UI и бизнес-логику**: Состояние UI отдельно от данных
5. **Тестируйте логику**: Делайте reducers и actions тестируемыми

## Связанные темы
- [Performance Optimization](../performance/optimization.md) - Оптимизация производительности
- [React Context API](../react/context-api.md) - Context API в деталях
- [Testing Strategies](../testing/strategies.md) - Тестирование состояния

## Рекомендации для собеседования

**Senior-level ожидания**:
- Понимание trade-offs разных решений
- Опыт работы с несколькими state management решениями
- Знание паттернов нормализации данных
- Понимание проблем производительности
- Опыт с middleware и асинхронными операциями

**Частые вопросы**:
- Когда использовать Redux vs Context API?
- Как решать проблемы производительности Context API?
- Как тестировать state management логику?
- Как организовать состояние в больших приложениях?
