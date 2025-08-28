# Устойчивая Frontend Архитектура (small)

## Основные паттерны отказоустойчивости

### Circuit Breaker Pattern
```javascript
class CircuitBreaker {
  constructor({ failureThreshold = 5, resetTimeout = 60000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
  }
}
```

### Retry с Exponential Backoff
```javascript
class RetryManager {
  constructor({ maxRetries = 3, baseDelay = 1000, factor = 2 } = {}) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.factor = factor;
  }
  
  async execute(operation) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.shouldNotRetry(error) || attempt === this.maxRetries) {
          break;
        }
        
        const delay = this.baseDelay * Math.pow(this.factor, attempt);
        await this.sleep(delay + Math.random() * 1000); // jitter
      }
    }
    
    throw lastError;
  }
  
  shouldNotRetry(error) {
    return error.status >= 400 && error.status < 500; // Client errors
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Resilient HTTP Client
```javascript
class ResilientHttpClient {
  constructor(options = {}) {
    this.retryManager = new RetryManager(options.retry);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.timeout = options.timeout || 10000;
  }
  
  async request(url, options = {}) {
    return this.circuitBreaker.execute(async () => {
      return this.retryManager.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            throw error;
          }
          
          return response.json();
        } finally {
          clearTimeout(timeoutId);
        }
      });
    });
  }
}
```

## Graceful Degradation

### Progressive Enhancement Component
```javascript
function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOnline);
    };
  }, []);
  
  // Offline state
  if (!isOnline) {
    const cached = JSON.parse(localStorage.getItem('weather') || 'null');
    return (
      <div className="weather-offline">
        📱 Offline mode
        {cached && <div>{cached.temp}°C (cached)</div>}
      </div>
    );
  }
  
  // Error state with fallback
  if (error && !weather) {
    return (
      <div className="weather-error">
        ⚠️ Service unavailable
        <button onClick={() => setError(null)}>Retry</button>
      </div>
    );
  }
  
  return weather ? <div>{weather.temp}°C</div> : <div>Loading...</div>;
}
```

## Offline Support

### Service Worker Caching Strategies
```javascript
// sw.js
const cacheStrategies = {
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      const cache = await caches.open('v1');
      cache.put(request, response.clone());
      return response;
    } catch {
      return caches.match('/offline.html');
    }
  },
  
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      const cache = await caches.open('v1');
      cache.put(request, response.clone());
      return response;
    } catch {
      return caches.match(request);
    }
  },
  
  staleWhileRevalidate: async (request) => {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request).then(response => {
      caches.open('v1').then(cache => cache.put(request, response.clone()));
      return response;
    });
    
    return cached || fetchPromise;
  }
};

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(cacheStrategies.networkFirst(event.request));
  } else if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheStrategies.cacheFirst(event.request));
  } else {
    event.respondWith(cacheStrategies.staleWhileRevalidate(event.request));
  }
});
```

### Offline Queue
```javascript
class OfflineQueue {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => this.isOnline = false);
  }
  
  add(request) {
    const item = {
      id: crypto.randomUUID(),
      ...request,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.queue.push(item);
    this.persist();
    
    if (this.isOnline) this.processQueue();
    return item.id;
  }
  
  async processQueue() {
    if (!this.isOnline) return;
    
    const processed = [];
    
    for (const item of this.queue) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        });
        processed.push(item.id);
      } catch (error) {
        if (++item.retryCount >= 3) {
          processed.push(item.id);
        }
      }
    }
    
    this.queue = this.queue.filter(item => !processed.includes(item.id));
    this.persist();
  }
  
  persist() {
    localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
  }
}
```

## Error Boundaries

### Advanced Error Boundary
```javascript
class ResilientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    this.setState(prev => ({ retryCount: prev.retryCount + 1 }));
    
    // Log error
    this.logError(error, errorInfo);
    
    // Auto-recovery for chunk load errors
    if (error.name === 'ChunkLoadError') {
      setTimeout(() => this.handleRetry(), 2000);
    }
  }
  
  logError(error, errorInfo) {
    const report = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
      url: location.href
    };
    
    // Send to monitoring service
    fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify(report)
    }).catch(() => {
      // Fallback to localStorage
      const errors = JSON.parse(localStorage.getItem('errors') || '[]');
      errors.push(report);
      localStorage.setItem('errors', JSON.stringify(errors.slice(-50)));
    });
  }
  
  handleRetry = () => {
    this.setState({ hasError: false });
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          {this.state.retryCount < 3 ? (
            <button onClick={this.handleRetry}>
              Retry ({this.state.retryCount}/3)
            </button>
          ) : (
            <button onClick={() => location.reload()}>
              Reload Page
            </button>
          )}
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Мониторинг и наблюдаемость

### Performance & Error Monitoring
```javascript
class FrontendMonitoring {
  constructor() {
    this.metrics = new Map();
    this.errors = [];
    this.setupObservers();
  }
  
  setupObservers() {
    // Core Web Vitals
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric(entry.name, entry.value);
      }
    }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    
    // Error handling
    window.addEventListener('error', (e) => {
      this.recordError({
        type: 'js-error',
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        stack: e.error?.stack
      });
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      this.recordError({
        type: 'promise-rejection',
        message: e.reason?.message || String(e.reason),
        stack: e.reason?.stack
      });
    });
  }
  
  recordMetric(name, value) {
    if (!this.metrics.has(name)) this.metrics.set(name, []);
    this.metrics.get(name).push({ value, timestamp: Date.now() });
    
    // Send critical metrics immediately
    if (['largest-contentful-paint', 'first-input-delay'].includes(name)) {
      this.sendMetric(name, value);
    }
  }
  
  recordError(error) {
    const enrichedError = {
      ...error,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent
    };
    
    this.errors.push(enrichedError);
    this.sendError(enrichedError);
  }
  
  async sendMetric(name, value) {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        body: JSON.stringify({ name, value, timestamp: Date.now() })
      });
    } catch (e) {
      console.warn('Failed to send metric:', e);
    }
  }
  
  async sendError(error) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        body: JSON.stringify(error)
      });
    } catch (e) {
      // Store in localStorage as fallback
      const stored = JSON.parse(localStorage.getItem('pendingErrors') || '[]');
      stored.push(error);
      localStorage.setItem('pendingErrors', JSON.stringify(stored));
    }
  }
  
  getHealthStatus() {
    const recentErrors = this.errors.filter(
      e => Date.now() - e.timestamp < 300000
    );
    
    return {
      status: recentErrors.length > 10 ? 'unhealthy' : 'healthy',
      errorRate: recentErrors.length,
      lastError: recentErrors[recentErrors.length - 1]
    };
  }
}

// React hook
const useAppHealth = () => {
  const [health, setHealth] = useState({ status: 'healthy' });
  const monitor = useRef(new FrontendMonitoring());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHealth(monitor.current.getHealthStatus());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return health;
};
```

## Resilient React Hooks

### Resilient API Hook
```javascript
const useResilientAPI = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const client = useRef(new ResilientHttpClient({
    retry: { maxRetries: 3, baseDelay: 1000 },
    circuitBreaker: { failureThreshold: 5 },
    timeout: 15000
  }));
  
  const request = useCallback(async (method = 'GET', body = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.current.request(url, { method, body });
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url]);
  
  useEffect(() => {
    if (options.autoFetch !== false) {
      request();
    }
  }, [request, options.autoFetch]);
  
  return { data, loading, error, request };
};
```

## Ключевые принципы устойчивости

**Fail Fast, Recover Gracefully**:
- Быстро обнаруживайте проблемы
- Изящно восстанавливайтесь от ошибок
- Предоставляйте fallback функциональность

**Bulkhead Pattern**:
- Изолируйте критические компоненты
- Предотвращайте каскадные отказы
- Ограничивайте blast radius проблем

**Progressive Enhancement**:
- Базовая функциональность всегда работает
- Дополнительные возможности при наличии ресурсов
- Graceful degradation при проблемах

**Circuit Breaker Benefits**:
- Предотвращает перегрузку upstream сервисов
- Быстрое реагирование на проблемы
- Автоматическое восстановление

## Стратегии кеширования

| Стратегия | Use Case | Плюсы | Минусы |
|-----------|----------|-------|--------|
| Cache First | Статические ресурсы | Быстрая загрузка | Устаревшие данные |
| Network First | API данные | Свежие данные | Медленнее при offline |
| Stale While Revalidate | Полустатические данные | Баланс скорости и свежести | Сложность реализации |

## Error Recovery Strategies

**Automatic Recovery**:
```javascript
const autoRecoveryErrors = [
  'ChunkLoadError',
  'NetworkError',
  'TimeoutError'
];

const shouldAutoRecover = (error) => 
  autoRecoveryErrors.some(type => error.name.includes(type));
```

**User-Initiated Recovery**:
```javascript
const userRecoveryStrategies = {
  reload: () => window.location.reload(),
  retry: (operation) => operation(),
  skipFeature: () => ({ disabled: true })
};
```

## Best Practices Senior-level

1. **Defense in Depth**: Множественные уровни защиты
2. **Graceful Timeouts**: Разумные таймауты для всех операций
3. **Health Checks**: Регулярный мониторинг состояния
4. **Progressive Loading**: Критический контент загружается первым
5. **Error Budgets**: Допустимый процент ошибок
6. **Observability**: Метрики, логи, трейсинг
7. **Chaos Engineering**: Тестирование отказоустойчивости

## Частые Senior вопросы

- **Как реализовать Circuit Breaker для frontend API?**
- **Стратегии кеширования для разных типов данных?**
- **Как обеспечить работу приложения при нестабильной сети?**
- **Мониторинг и алертинг для frontend приложений?**
- **Балансировка производительности и отказоустойчивости?**
- **Тестирование resilience patterns?**
- **Error boundaries vs global error handling?**
