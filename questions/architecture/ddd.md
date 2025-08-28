# Domain-Driven Design (DDD) во Frontend

## Описание
Вопрос касается применения принципов Domain-Driven Design в frontend-разработке для создания масштабируемых и поддерживаемых приложений с четким разделением бизнес-логики.

## Детальный ответ

### Основы DDD во Frontend

**Domain-Driven Design** - это подход к разработке программного обеспечения, который ставит в центр бизнес-домен и бизнес-логику.

**Ключевые концепции**:
- **Domain** - предметная область бизнеса
- **Bounded Context** - границы контекста
- **Entities** - сущности с уникальной идентичностью
- **Value Objects** - объекты-значения
- **Aggregates** - агрегаты для управления консистентностью
- **Domain Services** - доменные сервисы
- **Repositories** - репозитории для доступа к данным

### Архитектурные слои

#### 1. Domain Layer (Доменный слой)
```javascript
// Entities - сущности с уникальной идентичностью
class User {
  constructor(id, email, profile) {
    this.id = id;
    this.email = email;
    this.profile = profile;
    this.createdAt = new Date();
  }
  
  updateProfile(newProfile) {
    if (!newProfile.name || newProfile.name.trim() === '') {
      throw new Error('Name is required');
    }
    
    this.profile = { ...this.profile, ...newProfile };
    this.updatedAt = new Date();
    
    // Domain events
    DomainEvents.raise(new UserProfileUpdatedEvent(this.id, this.profile));
  }
  
  changeEmail(newEmail) {
    if (!this.isValidEmail(newEmail)) {
      throw new Error('Invalid email format');
    }
    
    this.email = newEmail;
    DomainEvents.raise(new UserEmailChangedEvent(this.id, newEmail));
  }
  
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// Value Objects - объекты-значения
class Email {
  constructor(value) {
    if (!this.isValid(value)) {
      throw new Error('Invalid email format');
    }
    this.value = value;
  }
  
  isValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  equals(other) {
    return other instanceof Email && this.value === other.value;
  }
  
  toString() {
    return this.value;
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
  
  multiply(factor) {
    return new Money(this.amount * factor, this.currency);
  }
  
  equals(other) {
    return other instanceof Money && 
           this.amount === other.amount && 
           this.currency === other.currency;
  }
}

// Aggregates - агрегаты
class Order {
  constructor(id, customerId) {
    this.id = id;
    this.customerId = customerId;
    this.items = [];
    this.status = 'draft';
    this.total = new Money(0);
  }
  
  addItem(product, quantity, price) {
    if (this.status !== 'draft') {
      throw new Error('Cannot modify confirmed order');
    }
    
    const item = new OrderItem(product, quantity, price);
    this.items.push(item);
    this.recalculateTotal();
    
    DomainEvents.raise(new ItemAddedToOrderEvent(this.id, item));
  }
  
  removeItem(productId) {
    if (this.status !== 'draft') {
      throw new Error('Cannot modify confirmed order');
    }
    
    this.items = this.items.filter(item => item.productId !== productId);
    this.recalculateTotal();
  }
  
  confirm() {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    
    this.status = 'confirmed';
    DomainEvents.raise(new OrderConfirmedEvent(this.id, this.total));
  }
  
  recalculateTotal() {
    this.total = this.items.reduce(
      (sum, item) => sum.add(item.getSubtotal()),
      new Money(0)
    );
  }
}

class OrderItem {
  constructor(product, quantity, price) {
    this.productId = product.id;
    this.productName = product.name;
    this.quantity = quantity;
    this.price = price;
  }
  
  getSubtotal() {
    return this.price.multiply(this.quantity);
  }
}
```

#### 2. Domain Services
```javascript
// Domain Services для сложной бизнес-логики
class OrderPricingService {
  constructor(discountRepository, taxService) {
    this.discountRepository = discountRepository;
    this.taxService = taxService;
  }
  
  async calculateOrderTotal(order, customer) {
    let total = order.getSubtotal();
    
    // Применение скидок
    const discounts = await this.discountRepository.findApplicableDiscounts(
      customer, 
      order
    );
    
    for (const discount of discounts) {
      total = discount.apply(total);
    }
    
    // Расчет налогов
    const tax = await this.taxService.calculateTax(total, customer.address);
    total = total.add(tax);
    
    return total;
  }
}

class UserRegistrationService {
  constructor(userRepository, emailService) {
    this.userRepository = userRepository;
    this.emailService = emailService;
  }
  
  async registerUser(email, password, profile) {
    // Проверка уникальности email
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Создание пользователя
    const user = new User(
      generateId(),
      new Email(email),
      profile
    );
    
    await this.userRepository.save(user);
    
    // Отправка welcome email
    await this.emailService.sendWelcomeEmail(user);
    
    return user;
  }
}
```

#### 3. Domain Events
```javascript
// Система доменных событий
class DomainEvent {
  constructor() {
    this.occurredOn = new Date();
    this.id = crypto.randomUUID();
  }
}

class UserProfileUpdatedEvent extends DomainEvent {
  constructor(userId, profile) {
    super();
    this.userId = userId;
    this.profile = profile;
  }
}

class OrderConfirmedEvent extends DomainEvent {
  constructor(orderId, total) {
    super();
    this.orderId = orderId;
    this.total = total;
  }
}

// Event dispatcher
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
        try {
          await handler(event);
        } catch (error) {
          console.error('Error handling domain event:', error);
        }
      }
    }
  }
}

// Event handlers
DomainEvents.subscribe(UserProfileUpdatedEvent, async (event) => {
  // Обновление индекса поиска
  await searchIndexService.updateUserIndex(event.userId, event.profile);
});

DomainEvents.subscribe(OrderConfirmedEvent, async (event) => {
  // Отправка уведомления
  await notificationService.sendOrderConfirmation(event.orderId);
  
  // Обновление аналитики
  await analyticsService.trackOrderConfirmed(event);
});
```

### Application Layer (Слой приложения)

#### Application Services
```javascript
// Application Services координируют работу доменных объектов
class UserApplicationService {
  constructor(userRepository, emailService, eventDispatcher) {
    this.userRepository = userRepository;
    this.emailService = emailService;
    this.eventDispatcher = eventDispatcher;
  }
  
  async updateUserProfile(userId, profileData) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Доменная логика
    user.updateProfile(profileData);
    
    // Сохранение
    await this.userRepository.save(user);
    
    // Обработка событий
    await DomainEvents.dispatch();
    
    return user;
  }
  
  async changeUserEmail(userId, newEmail) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Проверка уникальности нового email
    const existingUser = await this.userRepository.findByEmail(newEmail);
    if (existingUser && existingUser.id !== userId) {
      throw new Error('Email already in use');
    }
    
    // Доменная логика
    user.changeEmail(newEmail);
    
    await this.userRepository.save(user);
    await DomainEvents.dispatch();
    
    return user;
  }
}

class OrderApplicationService {
  constructor(orderRepository, productRepository, pricingService) {
    this.orderRepository = orderRepository;
    this.productRepository = productRepository;
    this.pricingService = pricingService;
  }
  
  async addItemToOrder(orderId, productId, quantity) {
    const [order, product] = await Promise.all([
      this.orderRepository.findById(orderId),
      this.productRepository.findById(productId)
    ]);
    
    if (!order) throw new Error('Order not found');
    if (!product) throw new Error('Product not found');
    
    // Доменная логика
    order.addItem(product, quantity, product.price);
    
    await this.orderRepository.save(order);
    await DomainEvents.dispatch();
    
    return order;
  }
  
  async confirmOrder(orderId, customerId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found');
    
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    
    // Расчет финальной стоимости
    const finalTotal = await this.pricingService.calculateOrderTotal(order, customer);
    order.updateTotal(finalTotal);
    
    // Подтверждение заказа
    order.confirm();
    
    await this.orderRepository.save(order);
    await DomainEvents.dispatch();
    
    return order;
  }
}
```

### Infrastructure Layer (Слой инфраструктуры)

#### Repositories
```javascript
// Интерфейсы репозиториев (в реальном проекте могут быть TypeScript интерфейсы)
class UserRepository {
  async findById(id) {
    throw new Error('Method must be implemented');
  }
  
  async findByEmail(email) {
    throw new Error('Method must be implemented');
  }
  
  async save(user) {
    throw new Error('Method must be implemented');
  }
}

// Конкретная реализация
class HttpUserRepository extends UserRepository {
  constructor(httpClient) {
    super();
    this.httpClient = httpClient;
  }
  
  async findById(id) {
    const response = await this.httpClient.get(`/api/users/${id}`);
    return this.mapToEntity(response.data);
  }
  
  async findByEmail(email) {
    const response = await this.httpClient.get(`/api/users?email=${email}`);
    return response.data ? this.mapToEntity(response.data) : null;
  }
  
  async save(user) {
    if (user.id) {
      await this.httpClient.put(`/api/users/${user.id}`, this.mapToDto(user));
    } else {
      const response = await this.httpClient.post('/api/users', this.mapToDto(user));
      user.id = response.data.id;
    }
    return user;
  }
  
  mapToEntity(data) {
    return new User(
      data.id,
      new Email(data.email),
      data.profile
    );
  }
  
  mapToDto(user) {
    return {
      id: user.id,
      email: user.email.toString(),
      profile: user.profile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

// In-memory repository для тестирования
class InMemoryUserRepository extends UserRepository {
  constructor() {
    super();
    this.users = new Map();
  }
  
  async findById(id) {
    return this.users.get(id) || null;
  }
  
  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email.equals(new Email(email))) {
        return user;
      }
    }
    return null;
  }
  
  async save(user) {
    if (!user.id) {
      user.id = crypto.randomUUID();
    }
    this.users.set(user.id, user);
    return user;
  }
}
```

### React Integration с DDD

#### Presentation Layer
```javascript
// Custom hooks для работы с доменом
const useUser = (userId) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const userService = useContext(UserServiceContext);
  
  useEffect(() => {
    if (!userId) return;
    
    const loadUser = async () => {
      try {
        setLoading(true);
        const userData = await userService.getUser(userId);
        setUser(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, [userId, userService]);
  
  const updateProfile = useCallback(async (profileData) => {
    try {
      const updatedUser = await userService.updateProfile(userId, profileData);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId, userService]);
  
  return { user, loading, error, updateProfile };
};

// Компонент с использованием доменной логики
function UserProfileForm({ userId }) {
  const { user, loading, error, updateProfile } = useUser(userId);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (user) {
      setFormData(user.profile);
    }
  }, [user]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      await updateProfile(formData);
      // Успешное обновление
    } catch (error) {
      // Обработка ошибки (она уже в состоянии)
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Name"
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

#### Dependency Injection
```javascript
// Контейнер зависимостей
class DIContainer {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
  }
  
  register(token, factory, options = {}) {
    this.dependencies.set(token, { factory, options });
  }
  
  resolve(token) {
    const dependency = this.dependencies.get(token);
    if (!dependency) {
      throw new Error(`Dependency ${token} not found`);
    }
    
    if (dependency.options.singleton) {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, dependency.factory(this));
      }
      return this.singletons.get(token);
    }
    
    return dependency.factory(this);
  }
}

// Настройка контейнера
const container = new DIContainer();

container.register('httpClient', () => new HttpClient(), { singleton: true });
container.register('userRepository', (c) => new HttpUserRepository(c.resolve('httpClient')));
container.register('emailService', () => new EmailService(), { singleton: true });
container.register('userService', (c) => new UserApplicationService(
  c.resolve('userRepository'),
  c.resolve('emailService')
));

// React Context для DI
const DIContext = createContext(container);

function App() {
  return (
    <DIContext.Provider value={container}>
      <UserProfileForm userId="123" />
    </DIContext.Provider>
  );
}

// Hook для получения сервисов
const useService = (token) => {
  const container = useContext(DIContext);
  return useMemo(() => container.resolve(token), [container, token]);
};
```

### Bounded Contexts

```javascript
// Контекст пользователей
const UserContext = {
  entities: {
    User,
    UserProfile
  },
  valueObjects: {
    Email,
    Password
  },
  services: {
    UserRegistrationService,
    UserApplicationService
  },
  repositories: {
    UserRepository
  }
};

// Контекст заказов
const OrderContext = {
  entities: {
    Order,
    OrderItem
  },
  valueObjects: {
    Money,
    OrderStatus
  },
  services: {
    OrderPricingService,
    OrderApplicationService
  },
  repositories: {
    OrderRepository
  }
};

// Контекст каталога
const CatalogContext = {
  entities: {
    Product,
    Category
  },
  valueObjects: {
    Price,
    ProductCode
  },
  services: {
    ProductSearchService,
    CatalogApplicationService
  },
  repositories: {
    ProductRepository
  }
};
```

### Testing в DDD

```javascript
// Тестирование доменных объектов
describe('User Entity', () => {
  it('should update profile with valid data', () => {
    const user = new User('123', new Email('test@example.com'), {});
    
    user.updateProfile({ name: 'John Doe', age: 30 });
    
    expect(user.profile.name).toBe('John Doe');
    expect(user.profile.age).toBe(30);
    expect(user.updatedAt).toBeDefined();
  });
  
  it('should throw error for invalid profile', () => {
    const user = new User('123', new Email('test@example.com'), {});
    
    expect(() => {
      user.updateProfile({ name: '' });
    }).toThrow('Name is required');
  });
});

// Тестирование application services
describe('UserApplicationService', () => {
  let userRepository;
  let emailService;
  let userService;
  
  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    emailService = new MockEmailService();
    userService = new UserApplicationService(userRepository, emailService);
  });
  
  it('should update user profile', async () => {
    const user = new User('123', new Email('test@example.com'), {});
    await userRepository.save(user);
    
    const updatedUser = await userService.updateUserProfile('123', {
      name: 'John Doe'
    });
    
    expect(updatedUser.profile.name).toBe('John Doe');
  });
});
```

## Преимущества DDD во Frontend

1. **Четкое разделение ответственности**: Бизнес-логика отделена от UI
2. **Масштабируемость**: Легко добавлять новую функциональность
3. **Тестируемость**: Доменная логика легко тестируется изолированно
4. **Поддерживаемость**: Понятная структура кода
5. **Переиспользование**: Доменная логика может использоваться в разных UI

## Best Practices

1. **Держите UI тонким**: Вся бизнес-логика в доменном слое
2. **Используйте Value Objects**: Для примитивных типов с валидацией
3. **Агрегаты как границы консистентности**: Одна транзакция = один агрегат
4. **Domain Events**: Для слабого связывания между агрегатами
5. **Repository паттерн**: Абстракция доступа к данным
6. **Dependency Injection**: Для управления зависимостями

## Связанные темы
- [State Management](./state-management.md) - Управление состоянием в DDD
- [Testing Strategies](../testing/strategies.md) - Тестирование доменной логики
- [TypeScript](../typescript/advanced-types.md) - Типизация в DDD

## Рекомендации для собеседования

**Senior-level ожидания**:
- Понимание принципов DDD и их применения во frontend
- Опыт с разделением на доменные слои
- Знание паттернов Repository, Domain Events, Value Objects
- Понимание Bounded Contexts
- Опыт с dependency injection

**Частые вопросы**:
- Как организовать структуру проекта по DDD?
- В чем разница между Entity и Value Object?
- Как тестировать доменную логику?
- Когда использовать Domain Events?
- Как интегрировать DDD с React?
