# Let, Const, Var - Шпаргалка (small)

## Основные различия

| Характеристика | var | let | const |
|---------------|-----|-----|-------|
| Scope | Function/Global | Block | Block |
| Hoisting | Да (undefined) | Да (TDZ) | Да (TDZ) |
| Переобъявление | ✅ | ❌ | ❌ |
| Переприсваивание | ✅ | ✅ | ❌ |
| TDZ | Нет | Да | Да |

## Ключевые концепции

### Temporal Dead Zone (TDZ)
```javascript
console.log(x); // undefined (var)
console.log(y); // ReferenceError (let в TDZ)

var x = 1;
let y = 2;
```

### Block Scope
```javascript
if (true) {
  var a = 1; // function scoped
  let b = 2; // block scoped
  const c = 3; // block scoped
}
console.log(a); // 1
console.log(b); // ReferenceError
```

## Классическая проблема с циклами
```javascript
// ❌ var - все функции возвращают 3
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100); // 3, 3, 3
}

// ✅ let - каждая итерация создает новую привязку
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100); // 0, 1, 2
}
```

## React best practices
```javascript
function Component() {
  // ✅ const для hooks и стабильных значений
  const [state, setState] = useState(0);
  const API_URL = '/api';
  
  // ✅ let для переменных в useEffect
  useEffect(() => {
    let isCancelled = false;
    fetchData().then(data => {
      if (!isCancelled) setState(data);
    });
    return () => { isCancelled = true; };
  }, []);
  
  // ✅ const для функций
  const handleClick = () => setState(prev => prev + 1);
}
```

## Switch scope
```javascript
switch (value) {
  case 1: {  // ✅ Блок для изоляции
    let x = 'case 1';
    break;
  }
  case 2: {
    let x = 'case 2'; // ✅ Работает
    break;
  }
}
```

## Мутация объектов
```javascript
const obj = { a: 1 };
obj.a = 2; // ✅ Разрешено
obj.b = 3; // ✅ Разрешено
// obj = {}; // ❌ TypeError

const arr = [1, 2];
arr.push(3); // ✅ Разрешено
// arr = []; // ❌ TypeError
```

## Senior правила
1. **const по умолчанию** → let при необходимости → никогда var
2. **TDZ помогает** - ловит ошибки инициализации
3. **Block scope** - создавайте изолированные области `{ }`
4. **React**: const для hooks/handlers, let для cleanup flags
5. **Циклы**: const для итерации по массивам, let для счетчиков
