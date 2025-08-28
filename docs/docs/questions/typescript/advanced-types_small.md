# Продвинутые типы TypeScript (small)

## Utility Types

```typescript
// Основные Utility Types
type PublicUser = Pick<User, 'id' | 'name' | 'email'>;
type CreateUser = Omit<User, 'id' | 'createdAt'>;
type UpdateUser = Partial<User>;
type RequiredConfig = Required<OptionalConfig>;
type StatusMessages = Record<Status, string>;

// Продвинутые
type PrimaryColors = Exclude<AllColors, 'yellow'>;
type WarmColors = Extract<AllColors, 'red' | 'yellow'>;
type DefiniteString = NonNullable<MaybeString>;
type UserPromise = ReturnType<typeof getUser>;
type UpdateUserParams = Parameters<typeof updateUser>;
type ApiClientParams = ConstructorParameters<typeof ApiClient>;
```

## Conditional Types

```typescript
// Базовые
type IsString<T> = T extends string ? true : false;
type ApiResponse<T> = T extends string
  ? { message: T }
  : T extends number
  ? { code: T }
  : { data: T };

// Distributive behavior
type Flatten<T> = T extends (infer U)[] ? U : T;
type FlatUnion = Flatten<string[] | number[]>; // string | number

// Отключение distributive
type StrictFlatten<T> = [T] extends [(infer U)[]] ? U : T;

// Event system типизация
type EventHandler<T extends EventNames> = T extends keyof EventMap
  ? (event: EventMap[T]) => void
  : never;
```

## Mapped Types

```typescript
// Модификаторы
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Mutable<T> = { -readonly [P in keyof T]: T[P] };
type Optional<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };

// Преобразования ключей
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// Условные mapped types
type NullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : never;
}[keyof T];
```

## Template Literal Types

```typescript
// Базовые
type Greeting = `Hello ${string}`;
type Variant = `${Color}-${Size}`;
type CSSProperty = `margin-${'top' | 'right' | 'bottom' | 'left'}`;

// Продвинутые
type EventName<T extends string> = `on${Capitalize<T>}`;
type APIEndpoint = `${HttpMethod} /api/${Resource}`;
type BEMElement<B extends string, E extends string> = `${B}__${E}`;

// Динамическая генерация
type ButtonEvents = EventName<'click' | 'hover' | 'focus'>;
// 'onClick' | 'onHover' | 'onFocus'
```

## Infer Keyword

```typescript
// Базовое извлечение типов
type ArrayElement<T> = T extends (infer U)[] ? U : never;
type PromiseValue<T> = T extends Promise<infer U> ? U : never;
type FirstParameter<T> = T extends (first: infer U, ...args: any[]) => any ? U : never;

// Сложное извлечение
type DeepPromiseValue<T> = T extends Promise<infer U>
  ? U extends Promise<any>
    ? DeepPromiseValue<U>
    : U
  : T;

type FunctionArgs<T> = T extends (...args: infer U) => any ? U : never;
type Tail<T extends readonly unknown[]> = T extends readonly [any, ...infer U] ? U : [];
```

## Recursive Types

```typescript
// Deep операции
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Path генерация для nested объектов
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

type UserPaths = JoinPaths<PathsToStringProps<NestedUser>>;
// 'profile.personal.name' | 'profile.contact.email'
```

## Брендированные типы

```typescript
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { [__brand]: TBrand };

type UserId = Brand<string, 'UserId'>;
type Email = Brand<string, 'Email'>;
type URL = Brand<string, 'URL'>;

function createUserId(id: string): UserId {
  return id as UserId;
}

function validateEmail(email: string): Email | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (email as Email) : null;
}

// Безопасность на уровне типов
function getUserById(id: UserId): Promise<User> { /* ... */ }
// getUserById(postId); // Error: PostId не assignable к UserId
```

## Продвинутые паттерны

### Type-safe Builder Pattern
```typescript
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

class FluentBuilder {
  setName(name: string): FluentBuilder & { user: RequiredFields<UserBuilder, 'name'> } {
    return this as any;
  }
  
  build<T extends UserBuilder>(
    this: FluentBuilder & { user: T }
  ): T extends RequiredFields<UserBuilder, 'name' | 'email'>
    ? User
    : 'Missing required fields' {
    return this.user as any;
  }
}

const user = new FluentBuilder()
  .setName('John')
  .setEmail('john@example.com')
  .build(); // User

// const invalid = new FluentBuilder().build(); // Error
```

### Type-safe Event System
```typescript
interface EventMap {
  'user:created': { user: User };
  'user:updated': { user: User; changes: Partial<User> };
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
    (this.listeners[event] ??= []).push(listener);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners[event]?.forEach(listener => listener(data));
  }
}

// Полная типобезопасность
emitter.on('user:created', (data) => {
  console.log(data.user.name); // data типизирован
});
```

### Advanced Utility Types
```typescript
// Deep Pick
type DeepPick<T, K extends string> = K extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? { [P in Key]: DeepPick<T[P], Rest> }
    : never
  : K extends keyof T
  ? Pick<T, K>
  : never;

// Функциональные утилиты
type Pipe<T extends readonly unknown[], R> = T extends readonly [
  (...args: any[]) => infer U,
  ...infer Rest
]
  ? Rest extends readonly [(...args: any[]) => any, ...any[]]
    ? Pipe<Rest, U>
    : R
  : R;

// Type-level арифметика
type Length<T extends readonly any[]> = T['length'];
type Add<A extends number, B extends number> = Length<
  [...Array<A>, ...Array<B>]
>;
```

## JSON Schema типизация

```typescript
// Runtime to compile-time типизация
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['id', 'name']
} as const;

type FromSchema<T> = T extends {
  type: 'object';
  properties: infer P;
  required?: infer R;
}
  ? {
      [K in keyof P]: P[K] extends { type: 'string' }
        ? string
        : P[K] extends { type: 'number' }
        ? number
        : unknown;
    } & {
      [K in R extends readonly (keyof P)[] ? R[number] : never]-?: K extends keyof P
        ? P[K] extends { type: 'string' }
          ? string
          : P[K] extends { type: 'number' }
          ? number
          : unknown
        : never;
    }
  : unknown;

type UserFromSchema = FromSchema<typeof userSchema>;
// { id: string; name: string; age?: number; }
```

## Performance и ограничения

```typescript
// Оптимизация больших union types
type OptimizedUnion<T> = T extends any ? T : never;

// Tail recursion optimization
type TailRecursiveLength<T extends readonly unknown[], Acc extends readonly unknown[] = []> = 
  T extends readonly [any, ...infer Rest]
    ? TailRecursiveLength<Rest, [...Acc, any]>
    : Acc['length'];

// Type-level кеширование для сложных вычислений
type MemoizedComputation<T> = T extends infer U ? ComputeResult<U> : never;
```

## Ключевые принципы Senior-level

**Type Safety**:
- Используйте брендированные типы для критических значений
- Предпочитайте composition over inheritance в типах
- Создавайте impossible states impossible

**Performance**:
- Избегайте глубокой рекурсии в типах (лимит ~45 уровней)
- Используйте conditional types вместо overloads где возможно
- Кешируйте сложные type-level вычисления

**Maintainability**:
- Документируйте сложные типы с примерами
- Создавайте helper types для переиспользования
- Используйте meaningful names для generic параметров

## Частые Senior вопросы

- **Как работает distributive conditional types?**
- **Разница между `interface` и `type` в edge cases?**
- **Как создать type-safe API client?**
- **Template literal types vs string enums?**
- **Оптимизация performance сложных типов?**
- **Как типизировать HOF и function composition?**
- **Limitations системы типов TS и workarounds?**
- **Variance в TypeScript (covariance/contravariance)?**

## Must-know для Senior

```typescript
// Variance понимание
type Covariant<T> = T[]; // T[] is covariant in T
type Contravariant<T> = (arg: T) => void; // Functions contravariant in parameters
type Invariant<T> = { value: T; setValue: (value: T) => void };

// Higher-kinded types simulation
interface HKT {
  readonly _URI: string;
  readonly _A: unknown;
}

interface URItoKind<A> {
  Maybe: Maybe<A>;
  Array: Array<A>;
}

// Type-level programming patterns
type If<C extends boolean, T, F> = C extends true ? T : F;
type Not<C extends boolean> = If<C, false, true>;
type And<A extends boolean, B extends boolean> = If<A, B, false>;
