# Let, Const, Var: Scope и Hoisting

## 📋 Вопрос

Разница между let, const и var в JavaScript, и как это влияет на scope и hoisting?

## 💡 Ответ

В JavaScript существует три способа объявления переменных: `var`, `let` и `const`. Каждый имеет свои особенности в отношении области видимости (scope) и поднятия (hoisting).

### Основные различия

| Характеристика | var | let | const |
|---------------|-----|-----|-------|
| Scope | Function/Global | Block | Block |
| Hoisting | Да (с undefined) | Да (в TDZ) | Да (в TDZ) |
| Переобъявление | Разрешено | Запрещено | Запрещено |
| Переприсваивание | Разрешено | Разрешено | Запрещено |
| Temporal Dead Zone | Нет | Да | Да |

### var - Function Scoped

```javascript
function varExample() {
  console.log(x); // undefined (не ошибка!)
  
  if (true) {
    var x = 1;
    console.log(x); // 1
  }
  
  console.log(x); // 1 (переменная "вытекает" из блока)
}

// Hoisting с var
console.log(hoistedVar); // undefined
var hoistedVar = 'Hello';

// Эквивалентно:
// var hoistedVar;
// console.log(hoistedVar); // undefined
// hoistedVar = 'Hello';
```

### let - Block Scoped

```javascript
function letExample() {
  // console.log(y); // ReferenceError: Cannot access 'y' before initialization
  
  if (true) {
    let y = 1;
    console.log(y); // 1
  }
  
  // console.log(y); // ReferenceError: y is not defined
}

// Temporal Dead Zone (TDZ)
function tdgExample() {
  console.log(typeof z); // ReferenceError (в TDZ)
  let z = 'Hello';
}

// Переобъявление запрещено
let name = 'John';
// let name = 'Jane'; // SyntaxError: Identifier 'name' has already been declared
```

### const - Block Scoped и Immutable Binding

```javascript
function constExample() {
  const PI = 3.14159;
  // PI = 3.14; // TypeError: Assignment to constant variable
  
  if (true) {
    const LOCAL_CONST = 'local';
    console.log(LOCAL_CONST); // 'local'
  }
  
  // console.log(LOCAL_CONST); // ReferenceError: LOCAL_CONST is not defined
}

// Объекты и массивы можно мутировать
const user = { name: 'John', age: 30 };
user.age = 31; // ✅ Разрешено
user.city = 'New York'; // ✅ Разрешено

const numbers = [1, 2, 3];
numbers.push(4); // ✅ Разрешено
numbers[0] = 10; // ✅ Разрешено

// Но нельзя переприсвоить
// user = {}; // ❌ TypeError
// numbers = []; // ❌ TypeError
```

### Hoisting в деталях

```javascript
// var hoisting
console.log(a); // undefined
var a = 1;
console.log(a); // 1

// let/const hoisting с TDZ
console.log(typeof b); // ReferenceError
console.log(typeof c); // ReferenceError

let b = 2;
const c = 3;

// Function hoisting
console.log(myFunc()); // 'Hello from function'

function myFunc() {
  return 'Hello from function';
}

// Function expression не поднимается
console.log(myVar); // undefined
console.log(myVar()); // TypeError: myVar is not a function

var myVar = function() {
  return 'Hello from expression';
};
```

### Проблемы с var в циклах

```javascript
// Классическая проблема с var
for (var i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i); // 3, 3, 3 (не 0, 1, 2!)
  }, 100);
}

// Решение с let
for (let i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i); // 0, 1, 2
  }, 100);
}

// Почему так происходит с var
var funcs = [];
for (var i = 0; i < 3; i++) {
  funcs[i] = function() {
    return i; // Замыкание захватывает одну и ту же переменную i
  };
}

console.log(funcs[0]()); // 3
console.log(funcs[1]()); // 3
console.log(funcs[2]()); // 3

// С let каждая итерация создает новую привязку
var funcs2 = [];
for (let i = 0; i < 3; i++) {
  funcs2[i] = function() {
    return i; // Каждое замыкание захватывает свою копию i
  };
}

console.log(funcs2[0]()); // 0
console.log(funcs2[1]()); // 1
console.log(funcs2[2]()); // 2
```

### Temporal Dead Zone (TDZ)

```javascript
function demonstrateTDZ() {
  console.log('Start of function');
  
  // TDZ для 'letVar' начинается здесь
  console.log(typeof letVar); // ReferenceError
  
  let letVar = 'Hello'; // TDZ заканчивается здесь
  console.log(letVar); // 'Hello'
}

// TDZ в параметрах по умолчанию
function defaultParamTDZ(a = b, b = 2) {
  // ReferenceError: Cannot access 'b' before initialization
}

// Правильный порядок
function defaultParamOK(a = 1, b = a) {
  return [a, b]; // [1, 1]
}
```

### Применение в React

```javascript
import React, { useState, useEffect } from 'react';

function ReactExample() {
  // ✅ Используйте const для hooks
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);
  
  // ✅ Используйте const для стабильных значений
  const API_URL = 'https://api.example.com';
  
  useEffect(() => {
    // ✅ let для переменных, которые могут измениться
    let isCancelled = false;
    
    async function fetchUser() {
      try {
        const response = await fetch(`${API_URL}/user`);
        const userData = await response.json();
        
        if (!isCancelled) {
          setUser(userData);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to fetch user:', error);
        }
      }
    }
    
    fetchUser();
    
    return () => {
      isCancelled = true; // Cleanup
    };
  }, []);
  
  // ❌ Избегайте var в современном React
  // var handleClick = function() { ... };
  
  // ✅ Используйте const для функций
  const handleClick = () => {
    setCount(prevCount => prevCount + 1);
  };
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleClick}>Increment</button>
      {user && <p>User: {user.name}</p>}
    </div>
  );
}
```

### Block Scope в условиях

```javascript
function conditionalScope() {
  if (true) {
    var varInIf = 'var value';
    let letInIf = 'let value';
    const constInIf = 'const value';
  }
  
  console.log(varInIf); // 'var value' ✅
  // console.log(letInIf); // ReferenceError ❌
  // console.log(constInIf); // ReferenceError ❌
}

// Switch statements
function switchScope(value) {
  switch (value) {
    case 1:
      let x = 'case 1';
      break;
    case 2:
      // let x = 'case 2'; // SyntaxError: Identifier 'x' has already been declared
      break;
    default:
      // Нужно использовать блоки для изоляции
  }
}

// Правильный подход
function switchScopeCorrect(value) {
  switch (value) {
    case 1: {
      let x = 'case 1';
      console.log(x);
      break;
    }
    case 2: {
      let x = 'case 2'; // ✅ Теперь это работает
      console.log(x);
      break;
    }
  }
}
```

### Глобальные переменные

```javascript
// В браузере
var globalVar = 'I am global';
let globalLet = 'I am also global, but...';
const globalConst = 'I am global too, but...';

console.log(window.globalVar); // 'I am global'
console.log(window.globalLet); // undefined
console.log(window.globalConst); // undefined

// var создает свойство глобального объекта
// let и const - нет
```

### Лучшие практики

```javascript
// ✅ Рекомендуемый порядок предпочтений
// 1. const - по умолчанию
const API_ENDPOINT = '/api/users';
const users = [];

// 2. let - когда нужно переприсваивание
let currentUser = null;
let isLoading = false;

// 3. var - избегайте в современном коде
// var legacyVariable; // ❌

// ✅ В циклах
for (const user of users) {
  console.log(user); // const, если не меняем
}

for (let i = 0; i < users.length; i++) {
  // let, если нужен счетчик
}

// ✅ В функциях
function processData(data) {
  const result = []; // const для массивов/объектов
  let processed = 0; // let для счетчиков
  
  for (const item of data) {
    if (item.isValid) {
      result.push(process(item));
      processed++;
    }
  }
  
  return { result, processed };
}
```

### ESLint правила

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-var': 'error', // Запрещает var
    'prefer-const': 'error', // Предпочитает const
    'no-undef': 'error', // Запрещает неопределенные переменные
    'block-scoped-var': 'error', // Требует блочной области видимости для var
  }
};
```

### Влияние на производительность

```javascript
// var может создавать неожиданные замыкания
function createFunctions() {
  var functions = [];
  
  // ❌ Медленно - все функции захватывают одну переменную
  for (var i = 0; i < 1000; i++) {
    functions.push(function() { return i; });
  }
  
  return functions;
}

// ✅ Быстрее - каждая функция имеет свою область
function createFunctionsOptimized() {
  const functions = [];
  
  for (let i = 0; i < 1000; i++) {
    functions.push(() => i);
  }
  
  return functions;
}
```

### Senior-советы

1. **Всегда используйте const по умолчанию**, переходите к let только при необходимости
2. **Избегайте var** в современном коде - используйте ESLint для контроля
3. **Понимайте TDZ** - это поможет в отладке ошибок инициализации
4. **В React** отдавайте предпочтение const для hooks и обработчиков
5. **Используйте block scope** для создания изолированных областей видимости
6. **Помните о производительности** - let/const создают новые привязки в циклах

## 🔗 Связанные темы

- [Event Loop, Microtasks и Macrotasks](event-loop.md)
- [Garbage Collection и оптимизация памяти](garbage-collection.md)
- [TypeScript в React проектах](../typescript/typescript-react.md)
