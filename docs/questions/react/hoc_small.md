# Higher-Order Components - Senior Cheat Sheet

## Основная концепция

**HOC** = функция, принимающая компонент и возвращающая новый компонент с дополнительной функциональностью

```jsx
function withEnhancement(WrappedComponent) {
  return function EnhancedComponent(props) {
    // Дополнительная логика
    return <WrappedComponent {...props} additionalProp="value" />;
  };
}
```

## Основные паттерны

### 1. Authentication
```jsx
function withAuth(WrappedComponent) {
  return function AuthComponent(props) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    
    useEffect(() => {
      const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }
        
        const user = await fetchUser(token);
        if (!user) navigate('/login');
        else setUser(user);
        setLoading(false);
      };
      
      checkAuth();
    }, []);
    
    if (loading) return <div>Loading...</div>;
    if (!user) return null;
    
    return <WrappedComponent {...props} user={user} />;
  };
}

// Использование
const ProtectedDashboard = withAuth(Dashboard);
```

### 2. Data Fetching
```jsx
function withDataFetching(url) {
  return function(WrappedComponent) {
    return function DataComponent(props) {
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      
      useEffect(() => {
        let mounted = true;
        
        fetch(url)
          .then(r => r.json())
          .then(data => mounted && setData(data))
          .catch(err => mounted && setError(err))
          .finally(() => mounted && setLoading(false));
        
        return () => { mounted = false; };
      }, []);
      
      if (loading) return <div>Loading...</div>;
      if (error) return <div>Error: {error.message}</div>;
      
      return <WrappedComponent {...props} data={data} />;
    };
  };
}

const UsersWithData = withDataFetching('/api/users')(UserList);
```

### 3. Error Boundary
```jsx
function withErrorBoundary(WrappedComponent) {
  class ErrorBoundary extends Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
      console.error('HOC Error:', error, errorInfo);
    }
    
    render() {
      if (this.state.hasError) {
        return (
          <div>
            <h2>Something went wrong</h2>
            <button onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        );
      }
      
      return <WrappedComponent {...this.props} />;
    }
  }
  
  return ErrorBoundary;
}
```

### 4. Конфигурируемый HOC
```jsx
function withRetry(config = {}) {
  const { maxRetries = 3, delay = 1000 } = config;
  
  return function(WrappedComponent) {
    return function RetryComponent(props) {
      const [retryCount, setRetryCount] = useState(0);
      const [error, setError] = useState(null);
      
      const retry = () => {
        if (retryCount < maxRetries) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setError(null);
          }, delay);
        }
      };
      
      return <WrappedComponent {...props} onError={setError} retry={retry} />;
    };
  };
}

const ReliableComponent = withRetry({ maxRetries: 5 })(MyComponent);
```

## Композиция HOC

```jsx
// Функция композиции
function compose(...hocs) {
  return (WrappedComponent) => 
    hocs.reduceRight((acc, hoc) => hoc(acc), WrappedComponent);
}

// Использование
const EnhancedComponent = compose(
  withAuth,
  withErrorBoundary,
  withDataFetching('/api/data')
)(BaseComponent);

// Альтернативно
const Enhanced = withAuth(withErrorBoundary(withDataFetching(Base, '/api/data')));
```

## Performance оптимизация

### Мемоизация
```jsx
function withMemo(WrappedComponent) {
  const MemoComponent = React.memo(WrappedComponent);
  
  return function MemoizedHOC(props) {
    const enhancedProps = useMemo(() => ({
      ...props,
      timestamp: Date.now()
    }), [props]);
    
    return <MemoComponent {...enhancedProps} />;
  };
}
```

### Forward Refs
```jsx
function withForwardRef(WrappedComponent) {
  const WithRefComponent = forwardRef((props, ref) => {
    return <WrappedComponent {...props} forwardedRef={ref} />;
  });
  
  WithRefComponent.displayName = `withForwardRef(${WrappedComponent.name})`;
  return WithRefComponent;
}
```

## TypeScript типизация

```tsx
interface WithLoadingProps {
  loading?: boolean;
}

function withLoading<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P & WithLoadingProps> {
  return function WithLoadingComponent(props: P & WithLoadingProps) {
    const { loading, ...restProps } = props;
    
    if (loading) return <div>Loading...</div>;
    
    return <WrappedComponent {...(restProps as P)} />;
  };
}

// Использование
interface ButtonProps {
  text: string;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ text, onClick }) => (
  <button onClick={onClick}>{text}</button>
);

const LoadableButton = withLoading(Button);
```

## Современные альтернативы

### Custom Hooks (предпочтительно)
```jsx
// Вместо withAuth HOC
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkAuth().then(setUser).finally(() => setLoading(false));
  }, []);
  
  return { user, loading, isAuthenticated: !!user };
}

// В компоненте
function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <div>Welcome {user.name}</div>;
}
```

### Render Props
```jsx
function DataFetcher({ url, children }) {
  const [data, loading, error] = useFetch(url);
  return children({ data, loading, error });
}

// Использование
<DataFetcher url="/api/users">
  {({ data, loading, error }) => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;
    return <UserList users={data} />;
  }}
</DataFetcher>
```

## Лучшие практики

### DisplayName и статические методы
```jsx
function withLogger(WrappedComponent) {
  function LoggerComponent(props) {
    // логика
    return <WrappedComponent {...props} />;
  }
  
  // Для React DevTools
  LoggerComponent.displayName = 
    `withLogger(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  // Копирование статических методов
  return hoistNonReactStatics(LoggerComponent, WrappedComponent);
}
```

## Тестирование

```jsx
describe('withAuth', () => {
  it('redirects when not authenticated', () => {
    const TestComponent = () => <div>Protected</div>;
    const Protected = withAuth(TestComponent);
    
    // Mock no token
    localStorage.getItem = jest.fn(() => null);
    const mockNavigate = jest.fn();
    
    render(<Protected />);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
```

## Когда использовать

### ✅ Хорошо для HOC
- **Legacy class components** интеграция
- **Cross-cutting concerns** (логирование, аналитика)
- **Библиотеки** с переиспользуемой логикой
- **Сложная композиция** нескольких функций

### ❌ Лучше hooks
- **Простая логика** состояния
- **Новые проекты** на функциональных компонентах
- **Одноразовое использование**
- **React 16.8+** приложения

## Senior Rules

1. **Hooks > HOC** в новых проектах
2. **displayName always** - для debugging  
3. **hoistNonReactStatics** для статических методов
4. **Forward refs** когда нужно
5. **Compose pattern** для множественных HOC
6. **Тестируй отдельно** от wrapped компонента
7. **TypeScript generics** для типизации
8. **Максимум 2-3 HOC** в композиции

## Anti-patterns

```jsx
// ❌ Создание HOC внутри render
function Parent() {
  const EnhancedChild = withLoading(Child); // Новый тип каждый рендер!
  return <EnhancedChild />;
}

// ❌ Мутация оригинального компонента
function badHOC(WrappedComponent) {
  WrappedComponent.prototype.componentDidMount = function() {}; // Мутация!
  return WrappedComponent;
}

// ❌ Не проброс props
function withoutProps(WrappedComponent) {
  return (props) => <WrappedComponent />; // props потеряны!
}
```

**Главное**: HOC - legacy pattern. Используй hooks для новой логики, HOC для интеграции и cross-cutting concerns!
