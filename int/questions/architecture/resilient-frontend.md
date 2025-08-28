# Устойчивая frontend архитектура

## Описание
Вопрос касается создания отказоустойчивых frontend-приложений, способных работать в условиях нестабильного соединения, высоких нагрузок и различных видов сбоев.

## Детальный ответ

### Принципы устойчивой архитектуры

#### 1. Graceful Degradation
Приложение должно продолжать работать даже при отказе части функциональности.

```javascript
// Компонент с graceful degradation
function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Weather service unavailable');
        
        const data = await response.json();
        setWeather(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        // Fallback к кешированным данным
        const cachedWeather = localStorage.getItem('weather');
        if (cachedWeather) {
          setWeather(JSON.parse(cachedWeather));
        }
      }
    };
    
    if (isOnline) {
      fetchWeather();
    }
  }, [isOnline]);
  
  // Graceful degradation в рендеринге
  if (!isOnline) {
    return (
      <div className="weather-widget offline">
        <p>📱 Нет подключения к интернету</p>
        {weather && (
          <div>
            <p>Последние данные о погоде:</p>
            <p>{weather.temperature}°C (кешированные данные)</p>
          </div>
        )}
      </div>
    );
  }
  
  if (error && !weather) {
    return (
      <div className="weather-widget error">
        <p>⚠️ Сервис погоды недоступен</p>
        <p>Попробуйте позже</p>
      </div>
    );
  }
  
  return (
    <div className="weather-widget">
      {weather ? (
        <div>
          <p>{weather.temperature}°C</p>
          <p>{weather.condition}</p>
        </div>
      ) : (
        <p>Загрузка погоды...</p>
      )}
      {error && (
        <small className="warning">
          Показаны кешированные данные
        </small>
      )}
    </div>
  );
}
```

#### 2. Circuit Breaker Pattern
Предотвращение каскадных отказов при проблемах с внешними сервисами.

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 3) {
          this.reset();
        }
      } else {
        this.reset();
      }
      
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
    this.lastFailureTime = null;
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Использование Circuit Breaker
const apiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000
});

class APIService {
  async fetchUserData(userId) {
    return apiCircuitBreaker.execute(async () => {
      const response = await fetch(`/api/users/${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    });
  }
}

// React hook для Circuit Breaker
const useCircuitBreaker = (operation, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [circuitState, setCircuitState] = useState('CLOSED');
  
  const circuitBreakerRef = useRef(new CircuitBreaker());
  
  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await circuitBreakerRef.current.execute(operation);
      setData(result);
      setCircuitState(circuitBreakerRef.current.getState().state);
    } catch (err) {
      setError(err.message);
      setCircuitState(circuitBreakerRef.current.getState().state);
    } finally {
      setLoading(false);
    }
  }, dependencies);
  
  return { data, loading, error, circuitState, execute };
};
```

#### 3. Retry Logic с Exponential Backoff
```javascript
class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.factor = options.factor || 2;
    this.jitter = options.jitter || true;
  }
  
  async execute(operation, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Не повторяем для определенных ошибок
        if (this.shouldNotRetry(error)) {
          throw error;
        }
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        const delay = this.calculateDelay(attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  shouldNotRetry(error) {
    // Не повторяем для клиентских ошибок (4xx)
    if (error.status >= 400 && error.status < 500) {
      return true;
    }
    
    // Не повторяем для специфических ошибок
    const nonRetryableErrors = [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError'
    ];
    
    return nonRetryableErrors.includes(error.name);
  }
  
  calculateDelay(attempt) {
    let delay = this.baseDelay * Math.pow(this.factor, attempt);
    delay = Math.min(delay, this.maxDelay);
    
    if (this.jitter) {
      // Добавляем случайность для избежания thundering herd
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// HTTP Client с retry logic
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

// React hook для resilient API calls
const useResilientAPI = () => {
  const clientRef = useRef(new ResilientHttpClient({
    retry: { maxRetries: 3, baseDelay: 1000 },
    circuitBreaker: { failureThreshold: 5 },
    timeout: 15000
  }));
  
  const request = useCallback(async (url, options) => {
    return clientRef.current.request(url, options);
  }, []);
  
  return { request };
};
```

### Кеширование и оффлайн поддержка

#### Service Worker для кеширования
```javascript
// sw.js - Service Worker
const CACHE_NAME = 'app-cache-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/offline.html'
];

// Стратегии кеширования
const cacheStrategies = {
  // Сначала кеш, потом сеть
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    } catch (error) {
      // Fallback для оффлайн
      if (request.destination === 'document') {
        return caches.match('/offline.html');
      }
      throw error;
    }
  },
  
  // Сначала сеть, потом кеш
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  },
  
  // Stale-while-revalidate
  staleWhileRevalidate: async (request) => {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request).then(response => {
      const cache = caches.open(CACHE_NAME);
      cache.then(c => c.put(request, response.clone()));
      return response;
    });
    
    return cached || fetchPromise;
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE_URLS))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Выбираем стратегию кеширования
  if (url.pathname.startsWith('/api/')) {
    // API - network first
    event.respondWith(cacheStrategies.networkFirst(request));
  } else if (url.pathname.startsWith('/static/')) {
    // Статические ресурсы - cache first
    event.respondWith(cacheStrategies.cacheFirst(request));
  } else {
    // HTML страницы - stale while revalidate
    event.respondWith(cacheStrategies.staleWhileRevalidate(request));
  }
});

// Обработка фоновой синхронизации
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Отправка отложенных запросов
  const requests = await getPendingRequests();
  
  for (const request of requests) {
    try {
      await fetch(request.url, request.options);
      await removePendingRequest(request.id);
    } catch (error) {
      console.log('Background sync failed:', error);
    }
  }
}
```

#### Offline Queue Management
```javascript
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
    this.loadPersistedQueue();
  }
  
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  async add(request) {
    const queueItem = {
      id: crypto.randomUUID(),
      ...request,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.queue.push(queueItem);
    await this.persistQueue();
    
    if (this.isOnline) {
      this.processQueue();
    }
    
    return queueItem.id;
  }
  
  async processQueue() {
    if (!this.isOnline || this.queue.length === 0) return;
    
    const processedIds = [];
    
    for (const item of this.queue) {
      try {
        await this.executeRequest(item);
        processedIds.push(item.id);
      } catch (error) {
        item.retryCount++;
        
        if (item.retryCount >= 3) {
          console.error('Request failed after 3 retries:', item);
          processedIds.push(item.id);
        }
      }
    }
    
    // Удаляем обработанные элементы
    this.queue = this.queue.filter(item => !processedIds.includes(item.id));
    await this.persistQueue();
  }
  
  async executeRequest(item) {
    const response = await fetch(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response;
  }
  
  async persistQueue() {
    try {
      localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to persist offline queue:', error);
    }
  }
  
  async loadPersistedQueue() {
    try {
      const stored = localStorage.getItem('offlineQueue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }
  
  getQueueStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      pendingItems: this.queue.map(item => ({
        id: item.id,
        url: item.url,
        method: item.method,
        timestamp: item.timestamp,
        retryCount: item.retryCount
      }))
    };
  }
}

// React hook для offline queue
const useOfflineQueue = () => {
  const queueRef = useRef(new OfflineQueue());
  const [queueStatus, setQueueStatus] = useState(
    queueRef.current.getQueueStatus()
  );
  
  useEffect(() => {
    const updateStatus = () => {
      setQueueStatus(queueRef.current.getQueueStatus());
    };
    
    const interval = setInterval(updateStatus, 1000);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);
  
  const addToQueue = useCallback((request) => {
    return queueRef.current.add(request);
  }, []);
  
  return { queueStatus, addToQueue };
};
```

### Error Boundaries и Error Handling

#### Advanced Error Boundary
```javascript
class ResilientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
      retryCount: this.state.retryCount + 1
    });
    
    // Логирование ошибки
    this.logError(error, errorInfo);
    
    // Автоматическое восстановление для определенных ошибок
    if (this.shouldAutoRecover(error)) {
      setTimeout(() => {
        this.handleRetry();
      }, 2000);
    }
  }
  
  shouldAutoRecover(error) {
    // Автоматическое восстановление для network ошибок
    return error.name === 'ChunkLoadError' || 
           error.message.includes('Loading chunk');
  }
  
  logError(error, errorInfo) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.props.userId
    };
    
    // Отправка в систему мониторинга
    if (window.errorReporting) {
      window.errorReporting.captureException(error, { extra: errorReport });
    }
    
    // Локальное логирование для оффлайн
    const errors = JSON.parse(localStorage.getItem('errorLog') || '[]');
    errors.push(errorReport);
    
    // Оставляем только последние 50 ошибок
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
    
    localStorage.setItem('errorLog', JSON.stringify(errors));
  }
  
  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };
  
  render() {
    if (this.state.hasError) {
      const { error, retryCount } = this.state;
      const { fallback: FallbackComponent } = this.props;
      
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            retryCount={retryCount}
            onRetry={this.handleRetry}
          />
        );
      }
      
      return (
        <div className="error-boundary">
          <h2>Что-то пошло не так</h2>
          <details>
            <summary>Подробности ошибки</summary>
            <pre>{error?.message}</pre>
          </details>
          
          {retryCount < 3 && (
            <button onClick={this.handleRetry}>
              Попробовать снова ({retryCount}/3)
            </button>
          )}
          
          {retryCount >= 3 && (
            <div>
              <p>Попробуйте перезагрузить страницу</p>
              <button onClick={() => window.location.reload()}>
                Перезагрузить
              </button>
            </div>
          )}
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Компонент fallback для ошибок
function ErrorFallback({ error, retryCount, onRetry }) {
  const isNetworkError = error?.name === 'ChunkLoadError' || 
                         error?.message?.includes('fetch');
  
  return (
    <div className="error-fallback">
      {isNetworkError ? (
        <div>
          <h3>Проблемы с подключением</h3>
          <p>Проверьте интернет-соединение и попробуйте снова</p>
        </div>
      ) : (
        <div>
          <h3>Произошла ошибка</h3>
          <p>Мы уже работаем над исправлением</p>
        </div>
      )}
      
      <button onClick={onRetry} disabled={retryCount >= 3}>
        Попробовать снова
      </button>
    </div>
  );
}
```

### Мониторинг и наблюдаемость

#### Performance и Error Monitoring
```javascript
class FrontendMonitoring {
  constructor(options = {}) {
    this.config = options;
    this.metrics = new Map();
    this.errors = [];
    this.setupPerformanceObserver();
    this.setupErrorHandling();
  }
  
  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      // Мониторинг Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(entry.name, entry.value);
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    }
    
    // Мониторинг навигации
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      this.recordMetric('page-load-time', navigation.loadEventEnd - navigation.loadEventStart);
      this.recordMetric('dom-content-loaded', navigation.domContentLoadedEventEnd);
    });
  }
  
  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      this.recordError({
        type: 'javascript-error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        type: 'unhandled-promise-rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      });
    });
  }
  
  recordMetric(name, value) {
    const timestamp = Date.now();
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push({ value, timestamp });
    
    // Отправляем критические метрики сразу
    if (this.isCriticalMetric(name)) {
      this.sendMetric(name, value);
    }
  }
  
  recordError(error) {
    const errorData = {
      ...error,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    this.errors.push(errorData);
    
    // Отправляем ошибки сразу
    this.sendError(errorData);
  }
  
  isCriticalMetric(name) {
    const criticalMetrics = [
      'largest-contentful-paint',
      'first-input-delay',
      'cumulative-layout-shift'
    ];
    return criticalMetrics.includes(name);
  }
  
  async sendMetric(name, value) {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'metric',
          name,
          value,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Failed to send metric:', error);
    }
  }
  
  async sendError(error) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (err) {
      // Сохраняем в локальном хранилище если не можем отправить
      const storedErrors = JSON.parse(localStorage.getItem('pendingErrors') || '[]');
      storedErrors.push(error);
      localStorage.setItem('pendingErrors', JSON.stringify(storedErrors));
    }
  }
  
  getHealthStatus() {
    const recentErrors = this.errors.filter(
      error => Date.now() - error.timestamp < 300000 // последние 5 минут
    );
    
    return {
      status: recentErrors.length > 10 ? 'unhealthy' : 'healthy',
      errorRate: recentErrors.length,
      lastError: recentErrors[recentErrors.length - 1],
      metrics: Object.fromEntries(this.metrics)
    };
  }
}

// React hook для мониторинга
const useAppHealth = () => {
  const [healthStatus, setHealthStatus] = useState({ status: 'healthy' });
  const monitoringRef = useRef(new FrontendMonitoring());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthStatus(monitoringRef.current.getHealthStatus());
    }, 30000); // обновляем каждые 30 секунд
    
    return () => clearInterval(interval);
  }, []);
  
  return healthStatus;
};
```

## Best Practices для устойчивой архитектуры

1. **Fail Fast, Recover Gracefully**: Быстро обнаруживайте проблемы и изящно восстанавливайтесь
2. **Defensive Programming**: Предполагайте, что что-то пойдет не так
3. **Progressive Enhancement**: Базовая функциональность работает всегда
4. **Bulkhead Pattern**: Изолируйте критические компоненты
5. **Health Checks**: Регулярно проверяйте состояние системы
6. **Graceful Timeouts**: Устанавливайте разумные таймауты
7. **User Feedback**: Информируйте пользователя о состоянии системы

## Связанные темы
- [Performance Optimization](../performance/optimization.md) - Оптимизация производительности
- [WebSockets](./websockets-realtime.md) - Устойчивые real-time соединения
- [State Management](./state-management.md) - Устойчивое управление состоянием

## Рекомендации для собеседования

**Senior-level ожидания**:
- Понимание принципов отказоустойчивости
- Опыт с паттернами Circuit Breaker, Retry, Bulkhead
- Знание стратегий кеширования и offline поддержки
- Понимание мониторинга и наблюдаемости
- Опыт с Service Workers и PWA

**Частые вопросы**:
- Как обеспечить работу приложения при нестабильном соединении?
- Какие паттерны помогают предотвратить каскадные отказы?
- Как реализовать graceful degradation?
- Как мониторить здоровье frontend-приложения?
- Как балансировать производительность и отказоустойчивость?
