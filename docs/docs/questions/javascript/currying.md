# Currying в JavaScript

## 📋 Вопрос

Что такое currying в JavaScript, и как его можно применить в React-компонентах?

## 💡 Ответ

Currying — это техника функционального программирования, где функция с несколькими аргументами преобразуется в последовательность функций, каждая из которых принимает один аргумент. Это позволяет частичное применение (partial application) и улучшает композицию функций.

### Базовая реализация

```javascript
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs) => curried(...args, ...nextArgs);
  };
}

// Пример использования
const add = curry((a, b, c) => a + b + c);

console.log(add(1)(2)(3)); // 6
console.log(add(1, 2)(3)); // 6
console.log(add(1)(2, 3)); // 6

// Частичное применение
const add1 = add(1);
console.log(add1(2, 3)); // 6

const add1and2 = add(1, 2);
console.log(add1and2(3)); // 6
```

### Более продвинутая реализация

```javascript
function advancedCurry(fn, arity = fn.length) {
  return function curried(...args) {
    if (args.length >= arity) {
      return fn.apply(this, args);
    }
    
    return function(...nextArgs) {
      return curried.apply(this, [...args, ...nextArgs]);
    };
  };
}

// Поддержка placeholder
const _ = Symbol('placeholder');

function curryWithPlaceholder(fn) {
  return function curried(...args) {
    if (args.length >= fn.length && !args.includes(_)) {
      return fn(...args);
    }
    
    return (...nextArgs) => {
      const mergedArgs = [];
      let nextIndex = 0;
      
      for (let i = 0; i < args.length; i++) {
        if (args[i] === _) {
          mergedArgs[i] = nextArgs[nextIndex++];
        } else {
          mergedArgs[i] = args[i];
        }
      }
      
      while (nextIndex < nextArgs.length) {
        mergedArgs.push(nextArgs[nextIndex++]);
      }
      
      return curried(...mergedArgs);
    };
  };
}

// Использование с placeholder
const multiply = curryWithPlaceholder((a, b, c) => a * b * c);
const multiplyBy2 = multiply(_, 2, _);
console.log(multiplyBy2(3, 4)); // 24
```

### Применение в React компонентах

#### 1. Обработчики событий

```javascript
import React from 'react';

// Обычный подход - создание новой функции на каждом рендере
function TodoListBad({ todos, onToggle, onDelete }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <span>{todo.text}</span>
          <button onClick={() => onToggle(todo.id)}>Toggle</button>
          <button onClick={() => onDelete(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}

// Curried подход - стабильные ссылки на функции
const curry = fn => (...args) => 
  args.length >= fn.length 
    ? fn(...args) 
    : (...nextArgs) => curry(fn)(...args, ...nextArgs);

const handleToggle = curry((onToggle, id, event) => {
  event.preventDefault();
  onToggle(id);
});

const handleDelete = curry((onDelete, id, event) => {
  event.preventDefault();
  onDelete(id);
});

function TodoListGood({ todos, onToggle, onDelete }) {
  const toggleHandler = handleToggle(onToggle);
  const deleteHandler = handleDelete(onDelete);
  
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <span>{todo.text}</span>
          <button onClick={toggleHandler(todo.id)}>Toggle</button>
          <button onClick={deleteHandler(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

#### 2. Компоненты высшего порядка (HOC)

```javascript
// Curried HOC для логирования
const withLogger = curry((logLevel, component) => {
  return function LoggerHOC(props) {
    console.log(`[${logLevel}] Rendering component:`, component.name);
    console.log('Props:', props);
    
    return React.createElement(component, props);
  };
});

// Использование
const withDebugLog = withLogger('DEBUG');
const withErrorLog = withLogger('ERROR');

const Button = ({ text, onClick }) => (
  <button onClick={onClick}>{text}</button>
);

const DebugButton = withDebugLog(Button);
const ErrorButton = withErrorLog(Button);
```

#### 3. Валидация форм

```javascript
// Curried валидаторы
const validate = curry((validator, errorMessage, value) => {
  return validator(value) ? null : errorMessage;
});

const required = validate(value => !!value, 'Field is required');
const minLength = curry((min, value) => 
  validate(v => v.length >= min, `Minimum length is ${min}`, value)
);
const email = validate(
  value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  'Invalid email format'
);

// Композиция валидаторов
const composeValidators = (...validators) => value => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};

// Использование в форме
function UserForm() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});
  
  const validateName = composeValidators(required, minLength(2));
  const validateEmail = composeValidators(required, email);
  
  const handleChange = curry((field, event) => {
    const value = event.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Валидация на лету
    const validator = field === 'name' ? validateName : validateEmail;
    const error = validator(value);
    setErrors(prev => ({ ...prev, [field]: error }));
  });
  
  return (
    <form>
      <input
        value={form.name}
        onChange={handleChange('name')}
        placeholder="Name"
      />
      {errors.name && <span>{errors.name}</span>}
      
      <input
        value={form.email}
        onChange={handleChange('email')}
        placeholder="Email"
      />
      {errors.email && <span>{errors.email}</span>}
    </form>
  );
}
```

#### 4. API запросы

```javascript
// Curried функция для API запросов
const apiRequest = curry((baseURL, method, endpoint, options = {}) => {
  return fetch(`${baseURL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }).then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });
});

// Создание специализированных функций
const api = apiRequest('https://api.example.com');
const get = api('GET');
const post = api('POST');
const put = api('PUT');
const del = api('DELETE');

// Использование в компоненте
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    get(`/users/${userId}`)
      .then(setUser)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);
  
  const updateUser = useCallback(
    (updates) => put(`/users/${userId}`, { body: JSON.stringify(updates) }),
    [userId]
  );
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;
  
  return <div>{user.name}</div>;
}
```

### Производительность и оптимизация

```javascript
// Мемоизация curried функций
const memoizedCurry = (fn) => {
  const cache = new Map();
  
  return function curried(...args) {
    const key = args.join(',');
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    if (args.length >= fn.length) {
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }
    
    const partial = (...nextArgs) => curried(...args, ...nextArgs);
    cache.set(key, partial);
    return partial;
  };
};

// Использование с React.memo для оптимизации
const MemoizedComponent = React.memo(({ onAction, data }) => {
  return (
    <div>
      {data.map(item => (
        <button key={item.id} onClick={onAction(item.id)}>
          {item.name}
        </button>
      ))}
    </div>
  );
});
```

### Преимущества и недостатки

#### Преимущества
- **Переиспользование кода**: Создание специализированных функций
- **Композиция**: Легкое объединение функций
- **Читаемость**: Декларативный стиль программирования
- **Тестируемость**: Изолированное тестирование частично примененных функций

#### Недостатки
- **Производительность**: Создание промежуточных функций
- **Отладка**: Сложнее отслеживать стек вызовов
- **Понимание**: Требует знания функционального программирования

### Senior-советы

1. **Используйте currying осторожно**: Не применяйте везде, только где это действительно улучшает код
2. **Мемоизация**: Кэшируйте результаты для производительности
3. **TypeScript**: Используйте для типизации curried функций
4. **Библиотеки**: Рассмотрите lodash.curry или ramda для production
5. **React.useCallback**: Комбинируйте с хуками для оптимизации

### Интеграция с Redux/Zustand

```javascript
// Curried actions для Redux
const createAction = curry((type, payload) => ({ type, payload }));

const setUser = createAction('SET_USER');
const setLoading = createAction('SET_LOADING');
const setError = createAction('SET_ERROR');

// Использование
dispatch(setUser({ id: 1, name: 'John' }));
dispatch(setLoading(true));
```

## 🔗 Связанные темы

- [Higher-Order Components (HOC)](../re/hoc.md)
- [useEffect и Side Effects](../re/use-effect.md)
- [TypeScript в React проектах](../typescript/typescript-react.md)
