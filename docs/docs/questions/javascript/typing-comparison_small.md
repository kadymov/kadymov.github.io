# JS vs Java Typing + TypeScript - Senior Cheat Sheet (small)

## Сравнение систем типов

| | JavaScript | Java | TypeScript |
|---|-----------|------|-----------|
| Типизация | Динамическая | Статическая | Статическая (опциональная) |
| Проверка | Runtime | Compile-time | Compile-time |
| Type Safety | Слабая | Сильная | Сильная |
| Скорость разработки | Быстрый старт | Медленный старт | Средний |

## JavaScript - динамические проблемы

```javascript
// Type coercion ловушки
"5" + 3;     // "53" 
"5" - 3;     // 2
true + 1;    // 2
null == undefined; // true

// Runtime ошибки
user.name.toUpperCase(); // TypeError если name = null

// Нет автодополнения
function process(data) {
  return data. // IDE не знает что доступно
}
```

## TypeScript для React - основы

### Компоненты
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', onClick }) => (
  <button className={`btn-${variant}`} onClick={onClick}>
    {children}
  </button>
);
```

### Хуки
```typescript
// useState с типами
const [user, setUser] = useState<User | null>(null);
const [errors, setErrors] = useState<string[]>([]);

// useReducer
type Action = 
  | { type: 'increment' }
  | { type: 'setError'; payload: string };

// Custom hook
function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  
  // ... implementation
  
  return { data, loading, refetch };
}
```

### События
```typescript
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log('clicked');
};
```

## Продвинутые типы

### Utility Types
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type PublicUser = Omit<User, 'password'>;
type UserUpdate = Partial<Pick<User, 'name' | 'email'>>;
type UserKeys = keyof User;
```

### Generics
```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
}

function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  return fetch(url).then(r => r.json());
}

// Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
```

### Context типизация
```typescript
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## TypeScript конфигурация

### Строгий режим
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Миграция стратегия

```typescript
// 1. Начни с .ts файлов (без типов)
// 2. Добавь базовые типы
let id: number;
let name: string;

// 3. Создай интерфейсы для данных
interface User {
  id: number;
  name: string;
}

// 4. Типизируй функции
function getUser(id: number): Promise<User> {
  return fetch(`/users/${id}`).then(r => r.json());
}

// 5. Включи strict режим
```

## Senior Patterns

### Conditional Types
```typescript
type NonNullable<T> = T extends null | undefined ? never : T;

type ApiResult<T> = T extends string 
  ? { message: T } 
  : { data: T };
```

### Template Literals
```typescript
type EventName<T extends string> = `on${Capitalize<T>}`;
type ClickHandler = EventName<'click'>; // 'onClick'
```

### Mapped Types  
```typescript
type Optional<T> = {
  [K in keyof T]?: T[K];
};

type ReadOnly<T> = {
  readonly [K in keyof T]: T[K];
};
```

## Anti-patterns

```typescript
// ❌ Избегай any
const data: any = response;

// ✅ Используй unknown или конкретный тип
const data: unknown = response;
const user = data as User; // С type assertion

// ❌ Не игнорируй ошибки
// @ts-ignore
const value = obj.undefinedProp;

// ✅ Исправь типы или используй optional chaining
const value = obj.undefinedProp;

// ❌ Сложные типы без документации
type ComplexType<T, U, V> = ...

// ✅ С комментариями
/**
 * Utility type that extracts only the methods from T
 */
type Methods<T> = ...
```

## Senior Rules

1. **Strict mode always** - включай все строгие проверки
2. **No any** - используй unknown для неизвестных типов  
3. **Interface > Type** для объектов, type для unions
4. **Generic constraints** - ограничивай generic параметры
5. **Utility types** вместо дублирования типов
6. **Event types** - всегда типизируй React события
7. **API types** - генерируй из OpenAPI схем
8. **Incremental adoption** - мигрируй файл за файлом

## React + TypeScript Benefits

- **Compile-time errors** вместо runtime
- **IntelliSense** и автодополнение
- **Safe refactoring** с уверенностью
- **Self-documenting code** через типы
- **Better team collaboration** с контрактами
- **Fewer bugs** в production

**Главное**: TypeScript = JavaScript + типы. Начинай с него в новых проектах!
