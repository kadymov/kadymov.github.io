# Higher-Order Components (HOC)

## 📋 Вопрос

Что такое higher-order components (HOC) в React, и приведите пример их реализации?

## 💡 Ответ

Higher-Order Component (HOC) — это функция, которая принимает компонент и возвращает новый компонент с дополнительной функциональностью. Это паттерн композиции для переиспользования логики между компонентами.

### Основная концепция

```javascript
// Базовая структура HOC
function withEnhancement(WrappedComponent) {
  return function EnhancedComponent(props) {
    // Дополнительная логика
    const enhancedProps = {
      ...props,
      additionalProp: 'some value'
    };
    
    return <WrappedComponent {...enhancedProps} />;
  };
}

// Использование
const Button = ({ text, additionalProp }) => (
  <button>{text} - {additionalProp}</button>
);

const EnhancedButton = withEnhancement(Button);

// Рендер
<EnhancedButton text="Click me" />
```

### Практические примеры HOC

#### 1. Аутентификация

```javascript
import React from 'react';
import { useNavigate } from 'react-router-dom';

// HOC для проверки аутентификации
function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      const checkAuth = async () => {
        try {
          const token = localStorage.getItem('authToken');
          if (!token) {
            navigate('/login');
            return;
          }
          
          const response = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!response.ok) {
            navigate('/login');
            return;
          }
          
          const userData = await response.json();
          setUser(userData);
        } catch (error) {
          console.error('Auth check failed:', error);
          navigate('/login');
        } finally {
          setLoading(false);
        }
      };
      
      checkAuth();
    }, [navigate]);
    
    if (loading) {
      return <div>Checking authentication...</div>;
    }
    
    if (!user) {
      return null; // Будет перенаправлен
    }
    
    return <WrappedComponent {...props} user={user} />;
  };
}

// Использование
function Dashboard({ user }) {
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>This is your dashboard</p>
    </div>
  );
}

const AuthenticatedDashboard = withAuth(Dashboard);

// В роутере
function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<AuthenticatedDashboard />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
```

#### 2. Логирование и аналитика

```javascript
// HOC для логирования действий пользователя
function withLogger(WrappedComponent, componentName) {
  return function LoggedComponent(props) {
    useEffect(() => {
      console.log(`Component ${componentName} mounted`);
      
      // Отправка аналитики
      analytics.track('component_view', {
        component: componentName,
        timestamp: new Date().toISOString(),
        props: Object.keys(props)
      });
      
      return () => {
        console.log(`Component ${componentName} unmounted`);
      };
    }, []);
    
    // Логирование изменений props
    useEffect(() => {
      console.log(`${componentName} props updated:`, props);
    }, [props]);
    
    return <WrappedComponent {...props} />;
  };
}

// Использование
const ProductCard = ({ product }) => (
  <div>
    <h3>{product.name}</h3>
    <p>${product.price}</p>
  </div>
);

const LoggedProductCard = withLogger(ProductCard, 'ProductCard');
```

#### 3. Загрузка данных

```javascript
// HOC для загрузки данных
function withDataFetching(WrappedComponent, dataSource) {
  return function DataFetchingComponent(props) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
      let isMounted = true;
      
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const response = await fetch(dataSource);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (isMounted) {
            setData(result);
          }
        } catch (err) {
          if (isMounted) {
            setError(err.message);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      
      fetchData();
      
      return () => {
        isMounted = false;
      };
    }, []);
    
    if (loading) {
      return <div>Loading...</div>;
    }
    
    if (error) {
      return <div>Error: {error}</div>;
    }
    
    return <WrappedComponent {...props} data={data} />;
  };
}

// Использование
function UserList({ data }) {
  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

const UserListWithData = withDataFetching(UserList, '/api/users');
```

#### 4. Обработка ошибок

```javascript
// HOC для обработки ошибок
function withErrorBoundary(WrappedComponent) {
  class ErrorBoundaryHOC extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
      console.error('Error caught by HOC:', error, errorInfo);
      
      // Отправка ошибки в систему мониторинга
      if (typeof window !== 'undefined' && window.Sentry) {
        window.Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack
            }
          }
        });
      }
    }
    
    render() {
      if (this.state.hasError) {
        return (
          <div className="error-fallback">
            <h2>Something went wrong</h2>
            <details>
              {this.state.error && this.state.error.toString()}
            </details>
            <button onClick={() => window.location.reload()}>
              Reload Page
            </button>
          </div>
        );
      }
      
      return <WrappedComponent {...this.props} />;
    }
  }
  
  // Сохраняем displayName для отладки
  ErrorBoundaryHOC.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  return ErrorBoundaryHOC;
}

// Использование
const RiskyComponent = () => {
  const [shouldError, setShouldError] = useState(false);
  
  if (shouldError) {
    throw new Error('This is a test error');
  }
  
  return (
    <div>
      <p>This component might throw an error</p>
      <button onClick={() => setShouldError(true)}>
        Trigger Error
      </button>
    </div>
  );
};

const SafeRiskyComponent = withErrorBoundary(RiskyComponent);
```

### Продвинутые паттерны HOC

#### 1. Конфигурируемые HOC

```javascript
// HOC с конфигурацией
function withRetry(config = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true
  } = config;
  
  return function(WrappedComponent) {
    return function RetryComponent(props) {
      const [retryCount, setRetryCount] = useState(0);
      const [error, setError] = useState(null);
      
      const handleError = useCallback((error) => {
        if (retryCount < maxRetries) {
          const delay = exponentialBackoff 
            ? retryDelay * Math.pow(2, retryCount)
            : retryDelay;
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setError(null);
          }, delay);
        } else {
          setError(error);
        }
      }, [retryCount]);
      
      const retryProps = {
        ...props,
        onError: handleError,
        retryCount,
        isRetrying: retryCount > 0 && !error
      };
      
      if (error && retryCount >= maxRetries) {
        return (
          <div>
            <p>Failed after {maxRetries} retries</p>
            <button onClick={() => {
              setRetryCount(0);
              setError(null);
            }}>
              Try Again
            </button>
          </div>
        );
      }
      
      return <WrappedComponent {...retryProps} />;
    };
  };
}

// Использование с конфигурацией
const withAggressiveRetry = withRetry({
  maxRetries: 5,
  retryDelay: 500,
  exponentialBackoff: true
});

const ReliableComponent = withAggressiveRetry(MyComponent);
```

#### 2. Композиция HOC

```javascript
// Функция для композиции нескольких HOC
function compose(...hocs) {
  return function(WrappedComponent) {
    return hocs.reduceRight((acc, hoc) => hoc(acc), WrappedComponent);
  };
}

// Или используя библиотеку
import { compose } from 'redux';

// Применение нескольких HOC
const EnhancedComponent = compose(
  withAuth,
  withLogger,
  withErrorBoundary,
  withDataFetching('/api/data')
)(BaseComponent);

// Альтернативный синтаксис
const EnhancedComponent = withAuth(
  withLogger(
    withErrorBoundary(
      withDataFetching(BaseComponent, '/api/data')
    )
  )
);
```

#### 3. HOC с рендер-пропсами

```javascript
// Гибридный подход: HOC + render props
function withMousePosition(WrappedComponent) {
  return function MouseTrackingComponent(props) {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    
    useEffect(() => {
      const handleMouseMove = (event) => {
        setMousePosition({
          x: event.clientX,
          y: event.clientY
        });
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }, []);
    
    return (
      <WrappedComponent 
        {...props} 
        mousePosition={mousePosition}
        renderMouseInfo={({ x, y }) => (
          <div>Mouse: ({x}, {y})</div>
        )}
      />
    );
  };
}
```

### Производительность и оптимизация

#### Мемоизация HOC

```javascript
// Мемоизированный HOC для предотвращения лишних рендеров
function withMemoization(WrappedComponent) {
  const MemoizedComponent = React.memo(WrappedComponent);
  
  return function MemoizedHOCComponent(props) {
    // Дополнительная логика HOC
    const enhancedProps = useMemo(() => ({
      ...props,
      timestamp: Date.now()
    }), [props]);
    
    return <MemoizedComponent {...enhancedProps} />;
  };
}

// HOC с кастомным сравнением
function withCustomMemo(areEqual) {
  return function(WrappedComponent) {
    const MemoizedComponent = React.memo(WrappedComponent, areEqual);
    
    return function CustomMemoHOC(props) {
      return <MemoizedComponent {...props} />;
    };
  };
}

// Использование
const withShallowMemo = withCustomMemo((prevProps, nextProps) => {
  return Object.keys(prevProps).every(key => 
    prevProps[key] === nextProps[key]
  );
});
```

### Альтернативы HOC в современном React

#### Custom Hooks (предпочтительный подход)

```javascript
// Вместо HOC используйте custom hooks
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    const checkAuth = async () => {
      // Логика аутентификации
      setLoading(false);
    };
    
    checkAuth();
  }, []);
  
  return { user, loading, isAuthenticated: !!user };
}

// Использование в компоненте
function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <div>Welcome, {user.name}!</div>;
}
```

#### Render Props

```javascript
// Альтернатива HOC через render props
function DataFetcher({ url, children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Логика загрузки данных
  }, [url]);
  
  return children({ data, loading, error });
}

// Использование
function UserList() {
  return (
    <DataFetcher url="/api/users">
      {({ data, loading, error }) => {
        if (loading) return <div>Loading...</div>;
        if (error) return <div>Error: {error}</div>;
        return (
          <ul>
            {data.map(user => <li key={user.id}>{user.name}</li>)}
          </ul>
        );
      }}
    </DataFetcher>
  );
}
```

### Лучшие практики

#### 1. Соглашения об именовании

```javascript
// ✅ Хорошо: четкое именование
function withAuthentication(WrappedComponent) {
  const WithAuthenticationComponent = (props) => {
    // логика
    return <WrappedComponent {...props} />;
  };
  
  // Установка displayName для отладки
  WithAuthenticationComponent.displayName = 
    `withAuthentication(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  // Копирование статических методов
  return hoistNonReactStatics(WithAuthenticationComponent, WrappedComponent);
}
```

#### 2. Проброс refs

```javascript
import { forwardRef } from 'react';

function withForwardedRef(WrappedComponent) {
  const WithRefComponent = forwardRef((props, ref) => {
    return <WrappedComponent {...props} forwardedRef={ref} />;
  });
  
  WithRefComponent.displayName = 
    `withForwardedRef(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithRefComponent;
}

// Использование
const EnhancedInput = withForwardedRef(Input);

function Parent() {
  const inputRef = useRef();
  
  return <EnhancedInput ref={inputRef} />;
}
```

#### 3. Типизация с TypeScript

```typescript
// Типизированный HOC
interface WithLoadingProps {
  loading?: boolean;
}

function withLoading<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P & WithLoadingProps> {
  return function WithLoadingComponent(props: P & WithLoadingProps) {
    const { loading, ...restProps } = props;
    
    if (loading) {
      return <div>Loading...</div>;
    }
    
    return <WrappedComponent {...(restProps as P)} />;
  };
}

// Использование с типами
interface ButtonProps {
  text: string;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ text, onClick }) => (
  <button onClick={onClick}>{text}</button>
);

const LoadableButton = withLoading(Button);

// Типизированное использование
<LoadableButton 
  text="Click me" 
  onClick={() => {}} 
  loading={false} 
/>
```

### Тестирование HOC

```javascript
import { render, screen } from '@testing-library/react';

describe('withAuth HOC', () => {
  it('redirects to login when user is not authenticated', () => {
    const TestComponent = () => <div>Protected Content</div>;
    const AuthenticatedComponent = withAuth(TestComponent);
    
    // Mock localStorage to return no token
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    
    const mockNavigate = jest.fn();
    jest.mock('react-router-dom', () => ({
      useNavigate: () => mockNavigate
    }));
    
    render(<AuthenticatedComponent />);
    
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
  
  it('renders component when user is authenticated', async () => {
    const TestComponent = ({ user }) => <div>Hello, {user.name}</div>;
    const AuthenticatedComponent = withAuth(TestComponent);
    
    // Mock successful auth
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'John' })
    });
    
    render(<AuthenticatedComponent />);
    
    expect(await screen.findByText('Hello, John')).toBeInTheDocument();
  });
});
```

### Когда использовать HOC

#### ✅ Хорошие случаи для HOC:

1. **Legacy code** - интеграция с существующими class components
2. **Cross-cutting concerns** - логирование, аналитика, ошибки
3. **Библиотеки** - создание переиспользуемых компонентов
4. **Миграция** - постепенный переход от class к hooks

#### ❌ Избегайте HOC когда:

1. **Простая логика** - лучше использовать custom hooks
2. **Одноразовое использование** - логика нужна только в одном месте
3. **Сложная композиция** - много вложенных HOC создают "wrapper hell"

### Senior-советы

1. **Предпочитайте custom hooks** для новых проектов
2. **Используйте HOC для cross-cutting concerns** и интеграции с legacy
3. **Правильно именуйте** и устанавливайте displayName
4. **Копируйте статические методы** с помощью hoist-non-react-statics
5. **Тестируйте HOC отдельно** от wrapped компонентов
6. **Избегайте глубокой композиции** - максимум 2-3 HOC
7. **Документируйте props** которые добавляет HOC

## 🔗 Связанные темы

- [Context API vs Redux](context-api.md)
- [useEffect и Side Effects](use-effect.md)
- [Currying в JavaScript](../javascript/currying.md)
- [Сравнение типизации JS и Java](../javascript/typing-comparison.md)
