# Domain-Driven Design (DDD) во Frontend (small)

## Архитектурные слои

```
Presentation Layer (UI/React)
    ↓
Application Layer (Use Cases)
    ↓
Domain Layer (Business Logic)
    ↓
Infrastructure Layer (Data Access)
```

## Основные паттерны

### Entities
```javascript
class User {
  constructor(id, email, profile) {
    this.id = id;
    this.email = email;
    this.profile = profile;
  }
  
  updateProfile(newProfile) {
    if (!newProfile.name?.trim()) {
      throw new Error('Name is required');
    }
    this.profile = { ...this.profile, ...newProfile };
    DomainEvents.raise(new UserProfileUpdatedEvent(this.id, this.profile));
  }
}
```

### Value Objects
```javascript
class Email {
  constructor(value) {
    if (!this.isValid(value)) throw new Error('Invalid email');
    this.value = value;
  }
  
  isValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  equals(other) {
    return other instanceof Email && this.value === other.value;
  }
}

class Money {
  constructor(amount, currency = 'USD') {
    this.amount = amount;
    this.currency = currency;
  }
  
  add(other) {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

### Aggregates
```javascript
class Order {
  constructor(id, customerId) {
    this.id = id;
    this.customerId = customerId;
    this.items = [];
    this.status = 'draft';
  }
  
  addItem(product, quantity, price) {
    if (this.status !== 'draft') {
      throw new Error('Cannot modify confirmed order');
    }
    
    const item = new OrderItem(product, quantity, price);
    this.items.push(item);
    DomainEvents.raise(new ItemAddedToOrderEvent(this.id, item));
  }
  
  confirm() {
    if (this.items.length === 0) throw new Error('Cannot confirm empty order');
    this.status = 'confirmed';
    DomainEvents.raise(new OrderConfirmedEvent(this.id));
  }
}
```

## Domain Services
```javascript
class OrderPricingService {
  constructor(discountRepository, taxService) {
    this.discountRepository = discountRepository;
    this.taxService = taxService;
  }
  
  async calculateTotal(order, customer) {
    let total = order.getSubtotal();
    
    const discounts = await this.discountRepository.findApplicable(customer, order);
    discounts.forEach(discount => total = discount.apply(total));
    
    const tax = await this.taxService.calculate(total, customer.address);
    return total.add(tax);
  }
}
```

## Domain Events
```javascript
class DomainEvents {
  static handlers = new Map();
  static events = [];
  
  static subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }
  
  static raise(event) {
    this.events.push(event);
  }
  
  static async dispatch() {
    const events = [...this.events];
    this.events.length = 0;
    
    for (const event of events) {
      const handlers = this.handlers.get(event.constructor) || [];
      for (const handler of handlers) {
        await handler(event);
      }
    }
  }
}

// Использование
DomainEvents.subscribe(OrderConfirmedEvent, async (event) => {
  await notificationService.sendConfirmation(event.orderId);
});
```

## Application Layer
```javascript
class UserApplicationService {
  constructor(userRepository, eventDispatcher) {
    this.userRepository = userRepository;
    this.eventDispatcher = eventDispatcher;
  }
  
  async updateProfile(userId, profileData) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');
    
    user.updateProfile(profileData);
    await this.userRepository.save(user);
    await DomainEvents.dispatch();
    
    return user;
  }
}
```

## Repository Pattern
```javascript
class UserRepository {
  async findById(id) { throw new Error('Must implement'); }
  async save(user) { throw new Error('Must implement'); }
}

class HttpUserRepository extends UserRepository {
  constructor(httpClient) {
    super();
    this.httpClient = httpClient;
  }
  
  async findById(id) {
    const response = await this.httpClient.get(`/api/users/${id}`);
    return this.mapToEntity(response.data);
  }
  
  async save(user) {
    const dto = this.mapToDto(user);
    if (user.id) {
      await this.httpClient.put(`/api/users/${user.id}`, dto);
    } else {
      const response = await this.httpClient.post('/api/users', dto);
      user.id = response.data.id;
    }
    return user;
  }
  
  mapToEntity(data) {
    return new User(data.id, new Email(data.email), data.profile);
  }
}
```

## React Integration

### Custom Hook с DDD
```javascript
const useUser = (userId) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userService = useService('userService');
  
  const updateProfile = useCallback(async (profileData) => {
    const updatedUser = await userService.updateProfile(userId, profileData);
    setUser(updatedUser);
    return updatedUser;
  }, [userId, userService]);
  
  useEffect(() => {
    if (!userId) return;
    userService.getUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId, userService]);
  
  return { user, loading, updateProfile };
};
```

### Dependency Injection
```javascript
class DIContainer {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
  }
  
  register(token, factory, options = {}) {
    this.dependencies.set(token, { factory, options });
  }
  
  resolve(token) {
    const dep = this.dependencies.get(token);
    if (!dep) throw new Error(`Dependency ${token} not found`);
    
    if (dep.options.singleton) {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, dep.factory(this));
      }
      return this.singletons.get(token);
    }
    return dep.factory(this);
  }
}

// Setup
const container = new DIContainer();
container.register('userRepository', (c) => new HttpUserRepository(c.resolve('httpClient')));
container.register('userService', (c) => new UserApplicationService(c.resolve('userRepository')));

// React Context
const DIContext = createContext(container);
const useService = (token) => {
  const container = useContext(DIContext);
  return useMemo(() => container.resolve(token), [container, token]);
};
```

## Bounded Contexts

```javascript
// User Context
const UserContext = {
  entities: { User },
  valueObjects: { Email, Password },
  services: { UserRegistrationService },
  repositories: { UserRepository }
};

// Order Context  
const OrderContext = {
  entities: { Order, OrderItem },
  valueObjects: { Money, OrderStatus },
  services: { OrderPricingService },
  repositories: { OrderRepository }
};

// Communication between contexts через Domain Events
DomainEvents.subscribe(UserRegisteredEvent, async (event) => {
  // Order context реагирует на событие из User context
  await orderService.createWelcomeDiscount(event.userId);
});
```

## Testing DDD

```javascript
describe('User Entity', () => {
  it('should update profile with valid data', () => {
    const user = new User('123', new Email('test@example.com'), {});
    
    user.updateProfile({ name: 'John' });
    
    expect(user.profile.name).toBe('John');
  });
  
  it('should throw error for invalid profile', () => {
    const user = new User('123', new Email('test@example.com'), {});
    
    expect(() => user.updateProfile({ name: '' })).toThrow('Name is required');
  });
});

// Application Service Testing
describe('UserApplicationService', () => {
  let userRepository;
  let userService;
  
  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    userService = new UserApplicationService(userRepository);
  });
  
  it('should update user profile', async () => {
    const user = new User('123', new Email('test@example.com'), {});
    await userRepository.save(user);
    
    await userService.updateProfile('123', { name: 'John' });
    
    const updatedUser = await userRepository.findById('123');
    expect(updatedUser.profile.name).toBe('John');
  });
});
```

## Ключевые принципы DDD

**Entity vs Value Object**:
- Entity: Имеет идентичность, может изменяться
- Value Object: Неизменяемый, определяется значением

**Aggregate Rules**:
- Один агрегат = одна транзакция
- Ссылки между агрегатами только по ID
- Агрегат - граница консистентности

**Domain Events**:
- Слабое связывание между агрегатами
- Асинхронная обработка side effects
- Audit trail и event sourcing

**Repository Pattern**:
- Абстракция доступа к данным
- Коллекция доменных объектов
- Инкапсуляция логики запросов

## Структура проекта

```
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── services/
│   └── events/
├── application/
│   ├── services/
│   └── use-cases/
├── infrastructure/
│   ├── repositories/
│   └── external-services/
└── presentation/
    ├── components/
    ├── hooks/
    └── contexts/
```

## Best Practices Senior-level

1. **Thin UI Layer**: Вся бизнес-логика в Domain слое
2. **Immutable Value Objects**: Неизменяемость для безопасности
3. **Single Aggregate Transaction**: Одна транзакция = один агрегат  
4. **Domain Events**: Связывание агрегатов через события
5. **Repository Abstraction**: Интерфейсы для тестирования
6. **Dependency Injection**: Инверсия зависимостей
7. **Bounded Context Isolation**: Четкие границы контекстов

## Частые Senior вопросы

- **Когда использовать Entity vs Value Object?**
- **Как обеспечить консистентность между агрегатами?**
- **Где размещать валидацию в DDD?**
- **Как тестировать доменную логику изолированно?**
- **Как организовать коммуникацию между Bounded Contexts?**
- **Когда DDD оправдан во frontend приложениях?**
- **Как интегрировать DDD с современными React паттернами?**
