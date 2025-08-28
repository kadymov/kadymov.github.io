# Оптимизация производительности frontend-приложений

## Описание
Вопрос касается различных техник и стратегий оптимизации производительности frontend-приложений, включая Core Web Vitals, оптимизацию рендеринга, загрузки ресурсов и runtime производительности.

## Детальный ответ

### Core Web Vitals

#### 1. Largest Contentful Paint (LCP)
Время загрузки самого крупного элемента на странице.

```javascript
// Измерение LCP
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      console.log('LCP:', entry.startTime);
      
      // Отправляем метрику в аналитику
      gtag('event', 'web_vitals', {
        name: 'LCP',
        value: Math.round(entry.startTime),
        event_category: 'Web Vitals'
      });
    }
  }
});

observer.observe({ type: 'largest-contentful-paint', buffered: true });

// Оптимизация LCP
// 1. Оптимизация изображений
function OptimizedImage({ src, alt, width, height, priority = false }) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: `${width} / ${height}`
      }}
    />
  );
}

// 2. Preload критических ресурсов
function CriticalResourcePreloader() {
  useEffect(() => {
    // Preload hero image
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = '/hero-image.webp';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);
  
  return null;
}

// 3. Критический CSS inline
const criticalCSS = `
  .hero {
    background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

function CriticalCSS() {
  return <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />;
}
```

#### 2. First Input Delay (FID) / Interaction to Next Paint (INP)
Время отклика на первое взаимодействие пользователя.

```javascript
// Измерение FID
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'first-input') {
      const fid = entry.processingStart - entry.startTime;
      console.log('FID:', fid);
      
      gtag('event', 'web_vitals', {
        name: 'FID',
        value: Math.round(fid),
        event_category: 'Web Vitals'
      });
    }
  }
});

observer.observe({ type: 'first-input', buffered: true });

// Оптимизация FID/INP
// 1. Debouncing и throttling
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  
  useEffect(() => {
    if (debouncedQuery) {
      // Выполняем поиск только после задержки
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);
  
  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}

// 2. Web Workers для тяжелых вычислений
// worker.js
self.onmessage = function(e) {
  const { data, operation } = e.data;
  
  switch (operation) {
    case 'processLargeDataset':
      const result = processData(data);
      self.postMessage({ result });
      break;
      
    case 'generateReport':
      const report = generateComplexReport(data);
      self.postMessage({ report });
      break;
  }
};

function processData(data) {
  // Тяжелые вычисления
  return data.map(item => ({
    ...item,
    processed: true,
    score: calculateComplexScore(item)
  }));
}

// React компонент с Web Worker
function DataProcessor() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const workerRef = useRef();
  
  useEffect(() => {
    workerRef.current = new Worker('/worker.js');
    
    workerRef.current.onmessage = (e) => {
      setResult(e.data.result);
      setLoading(false);
    };
    
    return () => {
      workerRef.current?.terminate();
    };
  }, []);
  
  const processData = (data) => {
    setLoading(true);
    workerRef.current.postMessage({
      data,
      operation: 'processLargeDataset'
    });
  };
  
  return (
    <div>
      {loading ? <div>Processing...</div> : <DataView data={result} />}
    </div>
  );
}
```

#### 3. Cumulative Layout Shift (CLS)
Стабильность визуальной компоновки страницы.

```javascript
// Измерение CLS
let clsValue = 0;

const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  }
});

observer.observe({ type: 'layout-shift', buffered: true });

// Отправляем CLS при выгрузке страницы
window.addEventListener('beforeunload', () => {
  gtag('event', 'web_vitals', {
    name: 'CLS',
    value: Math.round(clsValue * 1000),
    event_category: 'Web Vitals'
  });
});

// Оптимизация CLS
// 1. Резервирование места для изображений
function StableImage({ src, alt, width, height }) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div
      style={{
        width: '100%',
        maxWidth: width,
        aspectRatio: `${width} / ${height}`,
        backgroundColor: '#f0f0f0',
        position: 'relative'
      }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s'
        }}
      />
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#999'
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}

// 2. Стабильные размеры для динамического контента
function DynamicContent() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchContent().then(data => {
      setContent(data);
      setLoading(false);
    });
  }, []);
  
  return (
    <div
      style={{
        minHeight: '200px', // Резервируем минимальную высоту
        display: 'flex',
        alignItems: loading ? 'center' : 'flex-start',
        justifyContent: loading ? 'center' : 'flex-start'
      }}
    >
      {loading ? (
        <div>Loading content...</div>
      ) : (
        <div>{content}</div>
      )}
    </div>
  );
}

// 3. Skeleton screens
function UserCardSkeleton() {
  return (
    <div className="user-card-skeleton">
      <div className="skeleton-avatar" />
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-subtitle" />
      </div>
      <style jsx>{`
        .user-card-skeleton {
          display: flex;
          align-items: center;
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }
        
        .skeleton-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }
        
        .skeleton-content {
          margin-left: 12px;
          flex: 1;
        }
        
        .skeleton-line {
          height: 16px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
        }
        
        .skeleton-title {
          width: 60%;
          margin-bottom: 8px;
        }
        
        .skeleton-subtitle {
          width: 40%;
        }
        
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
```

### Оптимизация рендеринга

#### 1. React.memo и мемоизация
```javascript
// Мемоизация компонентов
const UserCard = React.memo(({ user, onEdit, onDelete }) => {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onEdit(user.id)}>Edit</button>
      <button onClick={() => onDelete(user.id)}>Delete</button>
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.email === nextProps.user.email
  );
});

// useMemo для тяжелых вычислений
function ExpensiveComponent({ items, filters }) {
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      return filters.every(filter => {
        switch (filter.type) {
          case 'category':
            return item.category === filter.value;
          case 'price':
            return item.price >= filter.min && item.price <= filter.max;
          case 'rating':
            return item.rating >= filter.value;
          default:
            return true;
        }
      });
    }).sort((a, b) => {
      // Сложная сортировка
      return a.relevance - b.relevance;
    });
  }, [items, filters]);
  
  const statistics = useMemo(() => {
    return {
      totalItems: filteredItems.length,
      averagePrice: filteredItems.reduce((sum, item) => sum + item.price, 0) / filteredItems.length,
      topCategory: getTopCategory(filteredItems)
    };
  }, [filteredItems]);
  
  return (
    <div>
      <div>Found {statistics.totalItems} items</div>
      <div>Average price: ${statistics.averagePrice.toFixed(2)}</div>
      <ItemList items={filteredItems} />
    </div>
  );
}

// useCallback для функций
function UserList({ users }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  const handleUserSelect = useCallback((userId, selected) => {
    setSelectedUsers(prev => {
      if (selected) {
        return [...prev, userId];
      } else {
        return prev.filter(id => id !== userId);
      }
    });
  }, []);
  
  const handleBulkAction = useCallback((action) => {
    // Выполняем действие для всех выбранных пользователей
    console.log(`Performing ${action} on users:`, selectedUsers);
  }, [selectedUsers]);
  
  return (
    <div>
      {users.map(user => (
        <UserRow
          key={user.id}
          user={user}
          onSelect={handleUserSelect}
          selected={selectedUsers.includes(user.id)}
        />
      ))}
      <BulkActions onAction={handleBulkAction} />
    </div>
  );
}
```

#### 2. Виртуализация списков
```javascript
// react-window для больших списков
import { FixedSizeList as List } from 'react-window';

function VirtualizedUserList({ users }) {
  const Row = ({ index, style }) => {
    const user = users[index];
    
    return (
      <div style={style}>
        <UserCard user={user} />
      </div>
    );
  };
  
  return (
    <List
      height={600}
      itemCount={users.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}

// Кастомная виртуализация с Intersection Observer
function useVirtualization(items, itemHeight = 80, containerHeight = 600) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const scrollElementRef = useRef();
  
  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;
    
    const handleScroll = () => {
      const scrollTop = element.scrollTop;
      const start = Math.floor(scrollTop / itemHeight);
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      const end = Math.min(start + visibleCount + 5, items.length); // +5 для буфера
      
      setVisibleRange({ start: Math.max(0, start - 5), end });
    };
    
    element.addEventListener('scroll', handleScroll);
    handleScroll(); // Инициальный расчет
    
    return () => element.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, containerHeight]);
  
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  
  return {
    scrollElementRef,
    visibleItems,
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.start * itemHeight
  };
}

function CustomVirtualizedList({ items }) {
  const { scrollElementRef, visibleItems, totalHeight, offsetY } = useVirtualization(items);
  
  return (
    <div
      ref={scrollElementRef}
      style={{
        height: '600px',
        overflow: 'auto'
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={item.id} style={{ height: '80px' }}>
              <ItemComponent item={item} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 3. Code Splitting и Lazy Loading
```javascript
// Динамические импорты
const LazyDashboard = React.lazy(() => import('./Dashboard'));
const LazyUserProfile = React.lazy(() => import('./UserProfile'));
const LazySettings = React.lazy(() => import('./Settings'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/dashboard" element={<LazyDashboard />} />
          <Route path="/profile" element={<LazyUserProfile />} />
          <Route path="/settings" element={<LazySettings />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

// Preloading на hover
function NavigationLink({ to, children }) {
  const handleMouseEnter = () => {
    // Предзагружаем компонент при hover
    switch (to) {
      case '/dashboard':
        import('./Dashboard');
        break;
      case '/profile':
        import('./UserProfile');
        break;
      case '/settings':
        import('./Settings');
        break;
    }
  };
  
  return (
    <Link
      to={to}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </Link>
  );
}

// Условная загрузка больших библиотек
function ChartComponent({ data }) {
  const [ChartLibrary, setChartLibrary] = useState(null);
  
  useEffect(() => {
    // Загружаем тяжелую библиотеку только когда нужно
    if (data && data.length > 0) {
      import('recharts').then(lib => {
        setChartLibrary(lib);
      });
    }
  }, [data]);
  
  if (!data || data.length === 0) {
    return <div>No data to display</div>;
  }
  
  if (!ChartLibrary) {
    return <div>Loading chart...</div>;
  }
  
  const { LineChart, Line, XAxis, YAxis } = ChartLibrary;
  
  return (
    <LineChart width={400} height={200} data={data}>
      <Line type="monotone" dataKey="value" stroke="#8884d8" />
      <XAxis dataKey="name" />
      <YAxis />
    </LineChart>
  );
}
```

### Оптимизация ресурсов

#### 1. Оптимизация изображений
```javascript
// Адаптивные изображения
function ResponsiveImage({ src, alt, sizes }) {
  const generateSrcSet = (baseSrc) => {
    const formats = ['webp', 'avif'];
    const sizes = [320, 640, 1024, 1920];
    
    return formats.map(format => 
      sizes.map(size => 
        `${baseSrc}?w=${size}&f=${format} ${size}w`
      ).join(', ')
    );
  };
  
  return (
    <picture>
      <source
        srcSet={generateSrcSet(src)[1]} // AVIF
        type="image/avif"
        sizes={sizes}
      />
      <source
        srcSet={generateSrcSet(src)[0]} // WebP
        type="image/webp"
        sizes={sizes}
      />
      <img
        src={`${src}?w=640`} // Fallback
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

// Прогрессивная загрузка изображений
function ProgressiveImage({ lowQualitySrc, highQualitySrc, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = highQualitySrc;
  }, [highQualitySrc]);
  
  return (
    <div className="progressive-image">
      <img
        src={lowQualitySrc}
        alt={alt}
        className={`low-quality ${loaded ? 'fade-out' : ''}`}
      />
      {loaded && (
        <img
          src={highQualitySrc}
          alt={alt}
          className="high-quality fade-in"
        />
      )}
      {error && (
        <div className="error-placeholder">
          Failed to load image
        </div>
      )}
      
      <style jsx>{`
        .progressive-image {
          position: relative;
          overflow: hidden;
        }
        
        .low-quality {
          filter: blur(5px);
          transition: opacity 0.3s;
        }
        
        .low-quality.fade-out {
          opacity: 0;
        }
        
        .high-quality {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
```

#### 2. Оптимизация шрифтов
```javascript
// Оптимизация загрузки шрифтов
function FontOptimizer() {
  useEffect(() => {
    // Preload критических шрифтов
    const criticalFonts = [
      '/fonts/inter-400.woff2',
      '/fonts/inter-600.woff2'
    ];
    
    criticalFonts.forEach(font => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = font;
      document.head.appendChild(link);
    });
    
    // Font loading API
    if ('fonts' in document) {
      Promise.all([
        document.fonts.load('400 16px Inter'),
        document.fonts.load('600 16px Inter')
      ]).then(() => {
        document.body.classList.add('fonts-loaded');
      });
    }
  }, []);
  
  return null;
}

// CSS для font-display
const fontCSS = `
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-400.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap; /* Показываем fallback шрифт сразу */
  }
  
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-600.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
  }
  
  body {
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  /* Предотвращаем layout shift */
  .fonts-loaded .heading {
    font-weight: 600;
  }
`;
```

#### 3. Service Worker для кеширования
```javascript
// sw.js - Service Worker с продвинутым кешированием
const CACHE_NAME = 'app-v1';
const PRECACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Стратегии кеширования
const strategies = {
  // Кеш сначала для статических ресурсов
  cacheFirst: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  },
  
  // Сеть сначала для API
  networkFirst: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    
    try {
      const response = await fetch(request);
      cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      throw error;
    }
  },
  
  // Stale-while-revalidate для обновляемого контента
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then(response => {
      cache.put(request, response.clone());
      return response;
    });
    
    return cached || fetchPromise;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Выбираем стратегию кеширования
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(strategies.networkFirst(request));
  } else if (url.pathname.startsWith('/static/')) {
    event.respondWith(strategies.cacheFirst(request));
  } else {
    event.respondWith(strategies.staleWhileRevalidate(request));
  }
});
```

### Bundle Optimization

#### 1. Tree Shaking и Dead Code Elimination
```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  optimization: {
    usedExports: true,
    sideEffects: false, // Или массив файлов с побочными эффектами
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                modules: false, // Сохраняем ES modules для tree shaking
                useBuiltIns: 'usage',
                corejs: 3
              }]
            ]
          }
        }
      }
    ]
  }
};

// Правильный импорт для tree shaking
// ❌ Неправильно - импортирует всю библиотеку
import _ from 'lodash';
import * as dateFns from 'date-fns';

// ✅ Правильно - импортирует только нужные функции
import { debounce, throttle } from 'lodash';
import { format, addDays } from 'date-fns';

// Или с помощью babel-plugin-import
// ❌ Так писать не нужно после настройки плагина
import { Button } from 'antd/lib/button';

// ✅ Плагин автоматически преобразует это
import { Button } from 'antd';
```

#### 2. Code Splitting стратегии
```javascript
// 1. Route-based splitting
const routes = [
  {
    path: '/dashboard',
    component: () => import('./pages/Dashboard')
  },
  {
    path: '/users',
    component: () => import('./pages/Users')
  }
];

// 2. Feature-based splitting
const FeatureToggle = ({ feature, children, fallback }) => {
  const [Component, setComponent] = useState(null);
  
  useEffect(() => {
    if (feature === 'advanced-analytics') {
      import('./features/AdvancedAnalytics').then(module => {
        setComponent(() => module.default);
      });
    } else if (feature === 'admin-panel') {
      import('./features/AdminPanel').then(module => {
        setComponent(() => module.default);
      });
    }
  }, [feature]);
  
  if (!Component) {
    return fallback || <div>Loading feature...</div>;
  }
  
  return <Component>{children}</Component>;
};

// 3. Library splitting
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true
        }
      }
    }
  }
};
```

### Monitoring и Measurement

#### 1. Performance API
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.setupObservers();
  }
  
  setupObservers() {
    // Navigation timing
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.loadEventStart);
      this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
    });
    
    // Resource timing
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) { // Медленные ресурсы
          this.recordMetric('slow_resource', {
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize
          });
        }
      }
    });
    resourceObserver.observe({ entryTypes: ['resource'] });
    
    // Long tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('long_task', {
          duration: entry.duration,
          startTime: entry.startTime
        });
      }
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  }
  
  recordMetric(name, value) {
    this.metrics.set(name, value);
    
    // Отправляем в аналитику
    if (typeof gtag !== 'undefined') {
      gtag('event', 'performance_metric', {
        metric_name: name,
        metric_value: typeof value === 'object' ? JSON.stringify(value) : value
      });
    }
  }
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

// React hook для мониторинга производительности
function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState({});
  const monitorRef = useRef();
  
  useEffect(() => {
    monitorRef.current = new PerformanceMonitor();
    
    const interval = setInterval(() => {
      setMetrics(monitorRef.current.getMetrics());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return metrics;
}
```

#### 2. React DevTools Profiler
```javascript
// Профилирование компонентов с Profiler API
function ProfiledComponent({ children, id }) {
  const onRenderCallback = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    // Логируем медленные рендеры
    if (actualDuration > 16) { // 16ms = 60fps
      console.warn(`Slow render detected in ${id}:`, {
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime
      });
    }
    
    // Отправляем в аналитику
    gtag('event', 'react_render', {
      component_id: id,
      phase,
      duration: Math.round(actualDuration),
      event_category: 'Performance'
    });
  };
  
  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
}

// Кастомный hook для измерения времени выполнения
function useExecutionTime(label) {
  const start = useRef();
  
  useEffect(() => {
    start.current = performance.now();
    
    return () => {
      const duration = performance.now() - start.current;
      console.log(`${label} took ${duration.toFixed(2)}ms`);
    };
  });
}

function ExpensiveComponent() {
  useExecutionTime('ExpensiveComponent render');
  
  // Тяжелая логика рендеринга
  return <div>Complex content</div>;
}
```

## Memory Management

#### 1. Предотвращение утечек памяти
```javascript
// Event listeners cleanup
function WindowResizeHandler() {
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized');
    };
    
    window.addEventListener('resize', handleResize);
    
    // ✅ Обязательно очищаем event listener
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return null;
}

// Очистка timers
function TimerComponent() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Timer tick');
    }, 1000);
    
    const timeout = setTimeout(() => {
      console.log('Delayed action');
    }, 5000);
    
    // ✅ Очищаем timers
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);
  
  return <div>Timer component</div>;
}

// Очистка subscriptions
function SubscriptionComponent() {
  useEffect(() => {
    const subscription = eventEmitter.subscribe('data', handleData);
    
    // ✅ Отписываемся при unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return <div>Subscription component</div>;
}

// Weak references для предотвращения циклических ссылок
class ComponentRegistry {
  constructor() {
    this.components = new WeakMap();
  }
  
  register(component, metadata) {
    this.components.set(component, metadata);
  }
  
  getMetadata(component) {
    return this.components.get(component);
  }
}
```

#### 2. Оптимизация больших объектов
```javascript
// Immutable updates с immer
import produce from 'immer';

function useOptimizedState(initialState) {
  const [state, setState] = useState(initialState);
  
  const updateState = useCallback((updater) => {
    setState(produce(updater));
  }, []);
  
  return [state, updateState];
}

// Пример использования
function LargeDataComponent() {
  const [data, updateData] = useOptimizedState({
    users: [],
    posts: [],
    comments: []
  });
  
  const addUser = useCallback((user) => {
    updateData(draft => {
      draft.users.push(user);
    });
  }, [updateData]);
  
  return <div>Large data component</div>;
}

// Object pooling для часто создаваемых объектов
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.maxSize = maxSize;
  }
  
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.createFn();
  }
  
  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
}

// Пример использования object pool
const rectanglePool = new ObjectPool(
  () => ({ x: 0, y: 0, width: 0, height: 0 }),
  (rect) => {
    rect.x = 0;
    rect.y = 0;
    rect.width = 0;
    rect.height = 0;
  }
);
```

## Network Optimization

#### 1. HTTP/2 и HTTP/3 оптимизации
```javascript
// Resource hints
function ResourceHints() {
  useEffect(() => {
    // DNS prefetch для внешних доменов
    const dnsPrefetchDomains = [
      'https://api.example.com',
      'https://cdn.example.com'
    ];
    
    dnsPrefetchDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });
    
    // Preconnect для критических ресурсов
    const preconnectUrls = [
      'https://fonts.googleapis.com',
      'https://api.example.com'
    ];
    
    preconnectUrls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);
  
  return null;
}

// HTTP/2 Server Push simulation
function CriticalResourceLoader() {
  useEffect(() => {
    // Симулируем server push с prefetch
    const criticalResources = [
      '/api/user/current',
      '/api/notifications/unread'
    ];
    
    criticalResources.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }, []);
  
  return null;
}
```

#### 2. Request optimization
```javascript
// Request batching
class RequestBatcher {
  constructor(batchSize = 10, flushInterval = 100) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.queue = [];
    this.timeoutId = null;
  }
  
  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.flushInterval);
      }
    });
  }
  
  async flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0);
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    try {
      const requests = batch.map(item => item.request);
      const responses = await this.executeBatch(requests);
      
      batch.forEach((item, index) => {
        item.resolve(responses[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }
  
  async executeBatch(requests) {
    const response = await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    
    return response.json();
  }
}

// GraphQL-style request combining
class RequestCombiner {
  constructor() {
    this.pendingRequests = new Map();
  }
  
  async request(query, variables = {}) {
    const key = this.generateKey(query, variables);
    
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    const promise = this.executeRequest(query, variables);
    this.pendingRequests.set(key, promise);
    
    // Очищаем кеш после выполнения
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
    
    return promise;
  }
  
  generateKey(query, variables) {
    return `${query}:${JSON.stringify(variables)}`;
  }
  
  async executeRequest(query, variables) {
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    
    return response.json();
  }
}
```

## Best Practices Summary

1. **Core Web Vitals**:
   - LCP < 2.5s (оптимизация изображений, критические ресурсы)
   - FID < 100ms (debouncing, Web Workers)
   - CLS < 0.1 (стабильные размеры, skeleton screens)

2. **Rendering Optimization**:
   - React.memo для предотвращения ненужных рендеров
   - useMemo/useCallback для тяжелых вычислений
   - Виртуализация для больших списков

3. **Code Splitting**:
   - Route-based splitting
   - Component-based splitting
   - Library splitting

4. **Resource Optimization**:
   - Оптимизация изображений (WebP, AVIF, lazy loading)
   - Font optimization (preload, font-display: swap)
   - Service Worker кеширование

5. **Bundle Optimization**:
   - Tree shaking
   - Dead code elimination
   - Proper imports

6. **Memory Management**:
   - Cleanup event listeners, timers, subscriptions
   - Weak references для предотвращения утечек
   - Object pooling для часто создаваемых объектов

## Tools for Performance Monitoring

- **Lighthouse** - Аудит производительности
- **Chrome DevTools** - Profiling и debugging
- **React DevTools** - React-специфичный профайлинг
- **Web Vitals** - Мониторинг Core Web Vitals
- **Bundle Analyzer** - Анализ размера бандла

## Связанные темы
- [React Optimization](../react/rerender-optimization.md) - Оптимизация React компонентов
- [Architecture](../architecture/resilient-frontend.md) - Архитектура для производительности
- [Testing Performance](../testing/strategies.md) - Тестирование производительности

## Рекомендации для собеседования

**Senior-level ожидания**:
- Глубокое понимание Core Web Vitals и способов их оптимизации
- Знание техник оптимизации рендеринга (мемоизация, виртуализация)
- Опыт с bundle optimization и code splitting
- Понимание memory management и предотвращения утечек
- Знание инструментов профилирования и мониторинга

**Частые вопросы**:
- Что такое Core Web Vitals и как их оптимизировать?
- Как оптимизировать производительность React приложений?
- Что такое tree shaking и как его настроить?
- Как предотвратить утечки памяти в JavaScript?
- Какие инструменты используете для мониторинга производительности?
