# Currying - Шпаргалка (small)

## Базовая реализация
```javascript
const curry = fn => (...args) => 
  args.length >= fn.length 
    ? fn(...args) 
    : (...nextArgs) => curry(fn)(...args, ...nextArgs);
```

## React применение

### Event handlers (оптимизация)
```javascript
const handleToggle = curry((onToggle, id, event) => {
  event.preventDefault();
  onToggle(id);
});

// В компоненте - стабильная ссылка
const toggleHandler = handleToggle(onToggle);
return <button onClick={toggleHandler(todo.id)}>Toggle</button>;
```

### HOC
```javascript
const withLogger = curry((logLevel, component) => {
  return function LoggerHOC(props) {
    console.log(`[${logLevel}]`, component.name, props);
    return React.createElement(component, props);
  };
});

const withDebug = withLogger('DEBUG');
```

### Валидация
```javascript
const validate = curry((validator, errorMessage, value) => 
  validator(value) ? null : errorMessage
);

const required = validate(value => !!value, 'Required');
const minLength = curry((min, value) => 
  validate(v => v.length >= min, `Min ${min} chars`, value)
);

// Композиция
const validateName = composeValidators(required, minLength(2));
```

### API
```javascript
const apiRequest = curry((baseURL, method, endpoint, options = {}) =>
  fetch(`${baseURL}${endpoint}`, { method, ...options })
);

const api = apiRequest('https://api.example.com');
const get = api('GET');
const post = api('POST');
```

## Производительность

### Мемоизация
```javascript
const memoizedCurry = (fn) => {
  const cache = new Map();
  return function curried(...args) {
    const key = args.join(',');
    if (cache.has(key)) return cache.get(key);
    
    const result = args.length >= fn.length 
      ? fn(...args) 
      : (...nextArgs) => curried(...args, ...nextArgs);
    
    cache.set(key, result);
    return result;
  };
};
```

## Senior-советы
- Используйте с `React.memo` для оптимизации
- Комбинируйте с `useCallback` для стабильных ссылок
- Мемоизируйте результаты в production
- Рассмотрите `lodash.curry` или `ramda`
- Осторожно с глубоким nesting - сложно отлаживать

## Redux интеграция
```javascript
const createAction = curry((type, payload) => ({ type, payload }));
const setUser = createAction('SET_USER');
dispatch(setUser({ id: 1, name: 'John' }));
