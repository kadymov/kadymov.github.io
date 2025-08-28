# State Management Architecture - Senior Cheat Sheet

## Сравнение решений

| | Redux | Context API | Zustand |
|---|-------|-------------|---------|
| **Boilerplate** | Много | Средне | **Минимум** |
| **DevTools** | ✅ Отличные | ❌ | ✅ |
| **Performance** | ✅ | ❌ (re-renders) | ✅ |
| **Learning Curve** | Высокая | Низкая | **Низкая** |
| **TypeScript** | Хорошо | Средне | **Отлично** |
| **Тестирование** | ✅ | Сложно | ✅ |

## Redux Toolkit - современный подход

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunk
const fetchUser = createAsyncThunk(
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

// Slice
const userSlice = createSlice({
  name: 'user',
  initialState: { profile: null, loading: false, error: null },
  reducers: {
    setUser: (state, action) => {
      state.profile = action.payload;
    },
    clearUser: (state) => {
      state.profile = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});
```

## Context API + useReducer

```javascript
// Разделение состояния и dispatch
const UserContext = createContext();
const UserDispatchContext = createContext();

function userReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, profile: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, {
    profile: null,
    loading: false,
    error: null
  });

  // Мемоизация для performance
  const value = useMemo(() => state, [state]);
  const dispatchValue = useMemo(() => dispatch, [dispatch]);

  return (
    <UserContext.Provider value={value}>
      <UserDispatchContext.Provider value={dispatchValue}>
        {children}
      </UserDispatchContext.Provider>
    </UserContext.Provider>
  );
}

// Custom hooks
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
```

## Zustand - минималистичный подход

```javascript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useUserStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        profile: null,
        loading: false,
        error: null,
        
        // Actions
        setUser: (profile) => set({ profile, loading: false, error: null }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error, loading: false }),
        
        // Async actions
        fetchUser: async (userId) => {
          set({ loading: true });
          try {
            const user = await api.getUser(userId);
            get().setUser(user);
          } catch (error) {
            get().setError(error.message);
          }
        },
        
        reset: () => set({ profile: null, loading: false, error: null })
      }),
      {
        name: 'user-storage',
        partialize: (state) => ({ profile: state.profile })
      }
    )
  )
);

// Использование
function UserProfile() {
  const { profile, loading, fetchUser } = useUserStore();
  
  useEffect(() => {
    fetchUser(userId);
  }, [fetchUser, userId]);
  
  return loading ? <Spinner /> : <div>{profile?.name}</div>;
}
```

## Архитектурные паттерны

### Flux Architecture
```javascript
// Однонаправленный поток: Action -> Dispatcher -> Store -> View

const UserActions = {
  FETCH_USER: 'FETCH_USER',
  SET_USER: 'SET_USER'
};

// Action creators
const fetchUser = (userId) => async (dispatch) => {
  dispatch({ type: 'FETCH_USER_REQUEST' });
  try {
    const user = await api.getUser(userId);
    dispatch({ type: 'FETCH_USER_SUCCESS', payload: user });
  } catch (error) {
    dispatch({ type: 'FETCH_USER_ERROR', payload: error.message });
  }
};
```

### CQRS паттерн
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
      this.store.dispatch({ type: 'UPDATE_PROFILE_SUCCESS', payload: data });
    } catch (error) {
      this.store.dispatch({ type: 'UPDATE_PROFILE_ERROR', payload: error });
    }
  }
}

class UserQueries {
  constructor(store) {
    this.store = store;
  }
  
  getUser(userId) {
    return this.store.getState().users.byId[userId];
  }
  
  getAllUsers() {
    return Object.values(this.store.getState().users.byId);
  }
}
```

## Нормализация данных

```javascript
// ❌ Плохо - nested структура
const badState = {
  posts: [
    {
      id: 1,
      title: 'Post 1',
      author: { id: 1, name: 'John' },
      comments: [{ id: 1, text: 'Comment 1', author: { id: 1, name: 'John' } }]
    }
  ]
};

// ✅ Хорошо - нормализованная структура
const normalizedState = {
  users: {
    byId: { '1': { id: '1', name: 'John' } },
    allIds: ['1']
  },
  posts: {
    byId: { '1': { id: '1', title: 'Post 1', authorId: '1' } },
    allIds: ['1']
  },
  comments: {
    byId: { '1': { id: '1', text: 'Comment 1', postId: '1', authorId: '1' } },
    allIds: ['1']
  }
};
```

## Performance оптимизация

### Мемоизированные селекторы
```javascript
import { createSelector } from '@reduxjs/toolkit';

const selectUsers = (state) => state.users.byId;
const selectFilter = (state) => state.ui.filter;

const selectFilteredUsers = createSelector(
  [selectUsers, selectFilter],
  (users, filter) => {
    if (!filter) return Object.values(users);
    return Object.values(users).filter(user => 
      user.name.toLowerCase().includes(filter.toLowerCase())
    );
  }
);
```

### Context оптимизация
```javascript
// Разделение контекстов по частоте изменений
const UserDataContext = createContext(); // Редко меняется
const UserUIContext = createContext();   // Часто меняется

// Subscription паттерн для Context
function createContextSubscription() {
  const subscribers = new Set();
  
  return {
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    notify: (data) => subscribers.forEach(cb => cb(data))
  };
}
```

## Middleware для побочных эффектов

### Custom middleware
```javascript
const apiMiddleware = (store) => (next) => (action) => {
  if (action.meta?.api) {
    // Обработка API вызовов
    handleApiCall(action, store.dispatch);
  }
  return next(action);
};

const loggerMiddleware = (store) => (next) => (action) => {
  console.group(`Action: ${action.type}`);
  console.log('Previous State:', store.getState());
  const result = next(action);
  console.log('Next State:', store.getState());
  console.groupEnd();
  return result;
};
```

## Когда что использовать

### Redux - подходит для:
- **Большие приложения** с сложной логикой
- **Команды разработчиков** - строгие правила
- **Time travel debugging** нужен
- **Middleware** требуется для side effects
- **DevTools** критичны

### Context API - подходит для:
- **Простые приложения** с базовым состоянием
- **Темизация** и UI настройки
- **Аутентификация** состояние
- **Нет частых обновлений**

### Zustand - подходит для:
- **Средние приложения** без сложной архитектуры
- **TypeScript проекты** - отличная поддержка
- **Быстрое прототипирование**
- **Минимум boilerplate**

## Senior Rules

1. **Держи состояние локальным** - поднимай только при необходимости
2. **Нормализуй данные** - избегай nested структур
3. **Разделяй UI и бизнес-состояние** - разные stores/contexts
4. **Используй селекторы** - мемоизируй вычисления
5. **Тестируй логику отдельно** - reducers должны быть чистыми
6. **Оптимизируй подписки** - избегай лишних ре-рендеров
7. **DevTools обязательны** - для debugging в продакшене
8. **TypeScript везде** - типизируй state и actions

## Критерии выбора

**Размер проекта**:
- Малый → useState + Context API
- Средний → Zustand 
- Большой → Redux Toolkit

**Команда**:
- Junior → Context API
- Mixed → Zustand
- Senior → Redux

**Требования**:
- DevTools → Redux
- Простота → Zustand  
- TypeScript → Zustand/Redux
- Performance → Redux/Zustand

**Главное**: Не переинжинирь! Начинай с простого, усложняй по мере роста приложения.
