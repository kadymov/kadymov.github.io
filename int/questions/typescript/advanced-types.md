# Продвинутые типы TypeScript

## Описание
Вопрос касается использования продвинутых возможностей системы типов TypeScript для создания безопасного и масштабируемого кода, включая utility types, conditional types, mapped types и другие сложные конструкции.

## Детальный ответ

### Utility Types

#### 1. Основные Utility Types
```typescript
// Pick - выбирает определенные свойства из типа
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

type PublicUser = Pick<User, 'id' | 'name' | 'email'>;
// Результат: { id: string; name: string; email: string; }

// Omit - исключает определенные свойства
type CreateUser = Omit<User, 'id' | 'createdAt'>;
// Результат: { name: string; email: string; password: string; }

// Partial - делает все свойства опциональными
type UpdateUser = Partial<User>;
// Результат: { id?: string; name?: string; email?: string; ... }

// Required - делает все свойства обязательными
interface OptionalConfig {
  apiUrl?: string;
  timeout?: number;
  retries?: number;
}

type RequiredConfig = Required<OptionalConfig>;
// Результат: { apiUrl: string; timeout: number; retries: number; }

// Record - создает тип с заданными ключами и значениями
type Status = 'pending' | 'approved' | 'rejected';
type StatusMessages = Record<Status, string>;
// Результат: { pending: string; approved: string; rejected: string; }

const messages: StatusMessages = {
  pending: 'Ожидает рассмотрения',
  approved: 'Одобрено',
  rejected: 'Отклонено'
};
```

#### 2. Продвинутые Utility Types
```typescript
// Exclude - исключает типы из union
type AllColors = 'red' | 'green' | 'blue' | 'yellow';
type PrimaryColors = Exclude<AllColors, 'yellow'>;
// Результат: 'red' | 'green' | 'blue'

// Extract - извлекает типы из union
type WarmColors = Extract<AllColors, 'red' | 'yellow' | 'orange'>;
// Результат: 'red' | 'yellow'

// NonNullable - исключает null и undefined
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>;
// Результат: string

// ReturnType - получает тип возвращаемого значения функции
function getUser(): Promise<User> {
  return Promise.resolve({} as User);
}

type UserPromise = ReturnType<typeof getUser>;
// Результат: Promise<User>

// Parameters - получает типы параметров функции
function updateUser(id: string, data: Partial<User>): Promise<User> {
  return Promise.resolve({} as User);
}

type UpdateUserParams = Parameters<typeof updateUser>;
// Результат: [string, Partial<User>]

// ConstructorParameters - параметры конструктора
class ApiClient {
  constructor(baseUrl: string, apiKey: string) {}
}

type ApiClientParams = ConstructorParameters<typeof ApiClient>;
// Результат: [string, string]
```

### Conditional Types

#### 1. Базовые Conditional Types
```typescript
// Простой conditional type
type IsString<T> = T extends string ? true : false;

type Test1 = IsString<string>; // true
type Test2 = IsString<number>; // false

// Более сложный пример
type ApiResponse<T> = T extends string
  ? { message: T }
  : T extends number
  ? { code: T }
  : { data: T };

type StringResponse = ApiResponse<string>; // { message: string }
type NumberResponse = ApiResponse<number>; // { code: number }
type ObjectResponse = ApiResponse<User>; // { data: User }

// Использование с union types
type ToArray<T> = T extends any ? T[] : never;
type StringOrNumberArray = ToArray<string | number>;
// Результат: string[] | number[]
```

#### 2. Distributive Conditional Types
```typescript
// Distributive behavior с union types
type Flatten<T> = T extends (infer U)[] ? U : T;

type FlatString = Flatten<string[]>; // string
type FlatNumber = Flatten<number>; // number
type FlatUnion = Flatten<string[] | number[]>; // string | number

// Отключение distributive behavior
type StrictFlatten<T> = [T] extends [(infer U)[]] ? U : T;
type StrictResult = StrictFlatten<string[] | number[]>; // string[] | number[]

// Практический пример: получение типов событий
interface EventMap {
  click: MouseEvent;
  keydown: KeyboardEvent;
  change: Event;
}

type EventNames = keyof EventMap; // 'click' | 'keydown' | 'change'

type EventHandler<T extends EventNames> = T extends keyof EventMap
  ? (event: EventMap[T]) => void
  : never;

type ClickHandler = EventHandler<'click'>; // (event: MouseEvent) => void
```

### Mapped Types

#### 1. Базовые Mapped Types
```typescript
// Создание readonly версии типа
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type ReadonlyUser = Readonly<User>;

// Создание mutable версии (убираем readonly)
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// Добавление опциональности
type Optional<T> = {
  [P in keyof T]?: T[P];
};

// Убираем опциональность
type Required<T> = {
  [P in keyof T]-?: T[P];
};

// Изменение типов значений
type Stringify<T> = {
  [P in keyof T]: string;
};

type StringifiedUser = Stringify<User>;
// Все свойства становятся string
```

#### 2. Продвинутые Mapped Types
```typescript
// Mapped type с условиями
type NullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : never;
}[keyof T];

interface MixedData {
  id: string;
  name: string | null;
  email?: string;
  count: number | null;
}

type NullableFields = NullableKeys<MixedData>; // 'name' | 'count'

// Создание getters
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getters<Pick<User, 'name' | 'email'>>;
// { getName: () => string; getEmail: () => string; }

// Создание setters
type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// Комбинированный тип
type UserAccessors = Getters<User> & Setters<User>;
```

### Template Literal Types

#### 1. Базовое использование
```typescript
// Простые template literal types
type Greeting = `Hello ${string}`;
type ValidGreeting = Greeting; // "Hello world", "Hello TypeScript", etc.

// С union types
type Color = 'red' | 'green' | 'blue';
type Size = 'small' | 'medium' | 'large';
type Variant = `${Color}-${Size}`;
// 'red-small' | 'red-medium' | 'red-large' | 'green-small' | ...

// CSS свойства
type CSSProperty = 
  | `margin-${'top' | 'right' | 'bottom' | 'left'}`
  | `padding-${'top' | 'right' | 'bottom' | 'left'}`;
// 'margin-top' | 'margin-right' | ... | 'padding-top' | ...
```

#### 2. Продвинутые Template Literal Types
```typescript
// Создание event listeners
type EventName<T extends string> = `on${Capitalize<T>}`;

type ButtonEvents = EventName<'click' | 'hover' | 'focus'>;
// 'onClick' | 'onHover' | 'onFocus'

// Создание API endpoints
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Resource = 'users' | 'posts' | 'comments';

type APIEndpoint = `${HttpMethod} /api/${Resource}`;
// 'GET /api/users' | 'POST /api/users' | ...

// Типизация CSS классов
type BEMElement<B extends string, E extends string> = `${B}__${E}`;
type BEMModifier<B extends string, M extends string> = `${B}--${M}`;

type ButtonElement = BEMElement<'button', 'text' | 'icon'>;
// 'button__text' | 'button__icon'

type ButtonModifier = BEMModifier<'button', 'primary' | 'secondary'>;
// 'button--primary' | 'button--secondary'
```

### Infer Keyword

#### 1. Базовое использование infer
```typescript
// Получение типа элемента массива
type ArrayElement<T> = T extends (infer U)[] ? U : never;

type StringElement = ArrayElement<string[]>; // string
type NumberElement = ArrayElement<number[]>; // number

// Получение типа из Promise
type PromiseValue<T> = T extends Promise<infer U> ? U : never;

type StringPromise = PromiseValue<Promise<string>>; // string
type UserPromise = PromiseValue<Promise<User>>; // User

// Получение параметров функции
type FirstParameter<T> = T extends (first: infer U, ...args: any[]) => any ? U : never;

type GetUserFirstParam = FirstParameter<typeof updateUser>; // string
```

#### 2. Продвинутое использование infer
```typescript
// Получение возвращаемого типа из nested Promise
type DeepPromiseValue<T> = T extends Promise<infer U>
  ? U extends Promise<any>
    ? DeepPromiseValue<U>
    : U
  : T;

type NestedPromise = Promise<Promise<Promise<string>>>;
type FinalValue = DeepPromiseValue<NestedPromise>; // string

// Получение типов из функции с несколькими параметрами
type FunctionArgs<T> = T extends (...args: infer U) => any ? U : never;

function complexFunction(a: string, b: number, c: boolean): void {}
type ComplexArgs = FunctionArgs<typeof complexFunction>; // [string, number, boolean]

// Создание Tail типа (все элементы кроме первого)
type Tail<T extends readonly unknown[]> = T extends readonly [any, ...infer U] ? U : [];

type RestNumbers = Tail<[1, 2, 3, 4]>; // [2, 3, 4]
type EmptyTail = Tail<[1]>; // []
```

### Recursive Types

#### 1. Простая рекурсия
```typescript
// Nested object type
type NestedObject<T> = {
  [K in keyof T]: T[K] | NestedObject<T[K]>;
};

// JSON типы
type JSONValue = 
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;

interface JSONObject {
  [key: string]: JSONValue;
}

interface JSONArray extends Array<JSONValue> {}
```

#### 2. Продвинутая рекурсия
```typescript
// Deep Readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Deep Partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Flatten object type
type Flatten<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: Flatten<O[K]> }
    : never
  : T;

// Path string type для nested objects
type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

type JoinPaths<T extends string[]> = T extends []
  ? never
  : T extends [infer Head]
  ? Head
  : T extends [infer Head, ...infer Tail]
  ? Head extends string
    ? Tail extends string[]
      ? `${Head}.${JoinPaths<Tail>}`
      : never
    : never
  : never;

interface NestedUser {
  profile: {
    personal: {
      name: string;
      age: number;
    };
    contact: {
      email: string;
    };
  };
}

type UserPaths = JoinPaths<PathsToStringProps<NestedUser>>;
// 'profile.personal.name' | 'profile.contact.email'
```

### Брендированные типы (Branded Types)

```typescript
// Создание брендированных типов для безопасности
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { [__brand]: TBrand };

// Типы для ID разных сущностей
type UserId = Brand<string, 'UserId'>;
type PostId = Brand<string, 'PostId'>;
type SessionId = Brand<string, 'SessionId'>;

// Функции-конструкторы
function createUserId(id: string): UserId {
  return id as UserId;
}

function createPostId(id: string): PostId {
  return id as PostId;
}

// Функции, работающие с конкретными типами
function getUserById(id: UserId): Promise<User> {
  // Реализация
  return Promise.resolve({} as User);
}

function getPostById(id: PostId): Promise<Post> {
  // Реализация
  return Promise.resolve({} as Post);
}

// Безопасное использование
const userId = createUserId('user-123');
const postId = createPostId('post-456');

// Это работает
getUserById(userId);
getPostById(postId);

// Это вызовет ошибку типизации
// getUserById(postId); // Error: Argument of type 'PostId' is not assignable to parameter of type 'UserId'

// Валидационные типы
type Email = Brand<string, 'Email'>;
type URL = Brand<string, 'URL'>;

function validateEmail(email: string): Email | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? (email as Email) : null;
}

function validateURL(url: string): URL | null {
  try {
    new URL(url);
    return url as URL;
  } catch {
    return null;
  }
}
```

### Практические паттерны

#### 1. Builder Pattern с типами
```typescript
interface UserBuilder {
  name?: string;
  email?: string;
  age?: number;
}

type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

class FluentUserBuilder {
  private user: UserBuilder = {};

  setName(name: string): FluentUserBuilder & { user: RequiredFields<UserBuilder, 'name'> } {
    this.user.name = name;
    return this as any;
  }

  setEmail(email: string): FluentUserBuilder & { user: RequiredFields<UserBuilder, 'email'> } {
    this.user.email = email;
    return this as any;
  }

  setAge(age: number): FluentUserBuilder & { user: RequiredFields<UserBuilder, 'age'> } {
    this.user.age = age;
    return this as any;
  }

  build<T extends UserBuilder>(
    this: FluentUserBuilder & { user: T }
  ): T extends RequiredFields<UserBuilder, 'name' | 'email'>
    ? User
    : 'Missing required fields: name and email' {
    return this.user as any;
  }
}

// Использование
const user = new FluentUserBuilder()
  .setName('John')
  .setEmail('john@example.com')
  .setAge(30)
  .build(); // User

// Это вызовет ошибку типизации
// const invalidUser = new FluentUserBuilder()
//   .setName('John')
//   .build(); // Error: Missing required fields
```

#### 2. Type-safe event system
```typescript
interface EventMap {
  'user:created': { user: User };
  'user:updated': { user: User; changes: Partial<User> };
  'user:deleted': { userId: string };
  'post:created': { post: Post };
}

class TypedEventEmitter {
  private listeners: {
    [K in keyof EventMap]?: Array<(data: EventMap[K]) => void>;
  } = {};

  on<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }

  off<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void
  ): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
}

// Использование
const emitter = new TypedEventEmitter();

emitter.on('user:created', (data) => {
  // data типизирован как { user: User }
  console.log('User created:', data.user.name);
});

emitter.emit('user:created', { user: {} as User });

// Ошибка типизации при неправильных данных
// emitter.emit('user:created', { post: {} as Post }); // Error
```

## Best Practices

1. **Используйте строгие типы**: Включайте `strict` режим в tsconfig.json
2. **Избегайте `any`**: Используйте `unknown` или создавайте специфические типы
3. **Композиция типов**: Создавайте сложные типы из простых
4. **Брендированные типы**: Для критически важных значений (ID, email, URL)
5. **Readonly по умолчанию**: Делайте данные immutable, где это возможно
6. **Type guards**: Используйте для runtime проверок типов

## Связанные темы
- [React Context API](../react/context-api.md) - Типизация React контекста
- [State Management](../architecture/state-management.md) - Типизация состояния
- [Testing Strategies](../testing/strategies.md) - Тестирование типизированного кода

## Рекомендации для собеседования

**Senior-level ожидания**:
- Глубокое понимание системы типов TypeScript
- Опыт с conditional и mapped types
- Знание utility types и умение создавать свои
- Понимание брендированных типов и их применения
- Опыт с type-safe архитектурными паттернами

**Частые вопросы**:
- Разница между `interface` и `type`
- Как работают conditional types?
- Что такое mapped types и когда их использовать?
- Как создать type-safe API?
- Как типизировать сложные JavaScript паттерны?
