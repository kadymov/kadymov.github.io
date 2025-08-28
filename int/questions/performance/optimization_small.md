# Оптимизация производительности Frontend

## Core Web Vitals

### LCP (Largest Contentful Paint) < 2.5s
```javascript
// Измерение и оптимизация LCP
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('LCP:', entry.startTime);
    gtag('event', 'web_vitals', { name: 'LCP', value: Math.round(entry.startTime) });
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });

// Critical resource preloading
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = '/hero-image.webp';
  document.head.appendChild(link);
}, []);

// Inline critical CSS
const criticalCSS = `.hero { height: 100vh; background: linear-gradient(45deg, #667eea, #764ba2); }`;
```

### FID (First Input Delay) < 100ms / INP
```javascript
// Debouncing для UI responsiveness
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

// Web Workers для тяжелых вычислений
// worker.js
self.onmessage = function(e) {
  const result = processLargeDataset(e.data);
  self.postMessage(result);
};

// React component
const workerRef = useRef(new Worker('/worker.js'));
workerRef.current.onmessage = (e) => setResult(e.data);
workerRef.current.postMessage(heavyData);
```

### CLS (Cumulative Layout Shift) < 0.1
```javascript
// Стабильные размеры для изображений
function StableImage({ src, alt, width, height }) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div style={{ aspectRatio: `${width} / ${height}`, backgroundColor: '#f0f0f0' }}>
      <img
        src={src}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    </div>
  );
}

// Skeleton screens
function UserCardSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-avatar" />
      <div className="skeleton-line" />
      <style jsx>{`
        .skeleton-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          animation: loading 1.5s infinite;
        }
        @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
```

## React Optimization

### Memoization
```javascript
// React.memo с custom comparison
const UserCard = React.memo(({ user, onEdit }) => (
  <div>
    <h3>{user.name}</h3>
    <button onClick={() => onEdit(user.id)}>Edit</button>
  </div>
), (prev, next) => prev.user.id === next.user.id && prev.user.name === next.user.name);

// useMemo для тяжелых вычислений
const filteredItems = useMemo(() => 
  items.filter(item => filters.every(f => applyFilter(item, f))).sort(sortFn)
, [items, filters]);

// useCallback для стабильных функций
const handleUserSelect = useCallback((userId, selected) => {
  setSelectedUsers(prev => selected ? [...prev, userId] : prev.filter(id => id !== userId));
}, []);
```

### Виртуализация
```javascript
// react-window для больших списков
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ items }) => (
  <List height={600} itemCount={items.length} itemSize={80}>
    {({ index, style }) => (
      <div style={style}>
        <ItemComponent item={items[index]} />
      </div>
    )}
  </List>
);

// Custom virtualization с Intersection Observer
function useVirtualization(items, itemHeight = 80, containerHeight = 600) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  
  const handleScroll = (scrollTop) => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    setVisibleRange({ start: Math.max(0, start - 5), end: Math.min(start + visibleCount + 5, items.length) });
  };
  
  return {
    visibleItems: items.slice(visibleRange.start, visibleRange.end),
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.start * itemHeight
  };
}
```

## Code Splitting & Lazy Loading

```javascript
// Route-based splitting
const Dashboard = React.lazy(() => import('./Dashboard'));
const UserProfile = React.lazy(() => import('./UserProfile'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<UserProfile />} />
      </Routes>
    </Suspense>
  );
}

// Preloading on hover
const NavigationLink = ({ to, children }) => {
  const handleMouseEnter = () => {
    if (to === '/dashboard') import('./Dashboard');
  };
  
  return <Link to={to} onMouseEnter={handleMouseEnter}>{children}</Link>;
};

// Conditional library loading
const ChartComponent = ({ data }) => {
  const [ChartLib, setChartLib] = useState(null);
  
  useEffect(() => {
    if (data?.length > 0) {
      import('recharts').then(setChartLib);
    }
  }, [data]);
  
  if (!ChartLib) return <div>Loading chart...</div>;
  
  const { LineChart, Line } = ChartLib;
  return <LineChart data={data}><Line dataKey="value" /></LineChart>;
};
```

## Resource Optimization

### Изображения
```javascript
// Responsive images с WebP/AVIF
function ResponsiveImage({ src, alt, sizes }) {
  return (
    <picture>
      <source srcSet={`${src}?f=avif&w=320 320w, ${src}?f=avif&w=640 640w`} type="image/avif" />
      <source srcSet={`${src}?f=webp&w=320 320w, ${src}?f=webp&w=640 640w`} type="image/webp" />
      <img src={`${src}?w=640`} alt={alt} loading="lazy" decoding="async" />
    </picture>
  );
}

// Progressive image loading
function ProgressiveImage({ lowQualitySrc, highQualitySrc, alt }) {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = highQualitySrc;
  }, [highQualitySrc]);
  
  return (
    <div>
      <img src={lowQualitySrc} className={loaded ? 'fade-out' : ''} alt={alt} />
      {loaded && <img src={highQualitySrc} className="fade-in" alt={alt} />}
    </div>
  );
}
```

### Fonts
```javascript
// Font optimization
useEffect(() => {
  // Preload critical fonts
  ['inter-400.woff2', 'inter-600.woff2'].forEach(font => {
    const link = document.createElement('link');
    Object.assign(link, {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
      href: `/fonts/${font}`
    });
    document.head.appendChild(link);
  });
  
  // Font Loading API
  Promise.all([
    document.fonts.load('400 16px Inter'),
    document.fonts.load('600 16px Inter')
  ]).then(() => document.body.classList.add('fonts-loaded'));
}, []);
```

### Service Worker Caching
```javascript
// sw.js - Advanced caching strategies
const strategies = {
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    return cached || fetch(request).then(response => {
      caches.open('v1').then(cache => cache.put(request, response.clone()));
      return response;
    });
  },
  
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      caches.open('v1').then(cache => cache.put(request, response.clone()));
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

// Strategy selection
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(strategies.networkFirst(event.request));
  } else if (url.pathname.startsWith('/static/')) {
    event.respondWith(strategies.cacheFirst(event.request));
  } else {
    event.respondWith(strategies.staleWhileRevalidate(event.request));
  }
});
```

## Bundle Optimization

```javascript
// webpack.config.js - Tree shaking & splitting
module.exports = {
  optimization: {
    usedExports: true,
    sideEffects: false,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors' },
        common: { minChunks: 2, name: 'common', enforce: true }
      }
    }
  }
};

// Правильные импорты для tree shaking
// ❌ import _ from 'lodash';
// ✅ import { debounce, throttle } from 'lodash';

// ❌ import * as dateFns from 'date-fns';
// ✅ import { format, addDays } from 'date-fns';
```

## Performance Monitoring

### Performance API
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.setupObservers();
  }
  
  setupObservers() {
    // Navigation timing
    window.addEventListener('load', () => {
      const [nav] = performance.getEntriesByType('navigation');
      this.recordMetric('page_load_time', nav.loadEventEnd - nav.loadEventStart);
    });
    
    // Long tasks (>50ms)
    new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        this.recordMetric('long_task', { duration: entry.duration, startTime: entry.startTime });
      });
    }).observe({ entryTypes: ['longtask'] });
    
    // Resource timing
    new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.duration > 1000) { // Slow resources
          this.recordMetric('slow_resource', { name: entry.name, duration: entry.duration });
        }
      });
    }).observe({ entryTypes: ['resource'] });
  }
  
  recordMetric(name, value) {
    this.metrics.set(name, value);
    gtag('event', 'performance_metric', { metric_name: name, metric_value: value });
  }
}
```

### React Profiler
```javascript
// Profiler для медленных рендеров
function ProfiledComponent({ children, id }) {
  const onRender = (id, phase, actualDuration) => {
    if (actualDuration > 16) { // Slower than 60fps
      console.warn(`Slow render in ${id}: ${actualDuration}ms`);
      gtag('event', 'react_render', { component_id: id, duration: Math.round(actualDuration) });
    }
  };
  
  return <Profiler id={id} onRender={onRender}>{children}</Profiler>;
}
```

## Memory Management

### Leak Prevention
```javascript
// Cleanup patterns
function Component() {
  useEffect(() => {
    const handleResize = () => console.log('resize');
    const interval = setInterval(() => console.log('tick'), 1000);
    const subscription = eventEmitter.subscribe('data', handleData);
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);
}

// Object pooling
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.maxSize = maxSize;
  }
  
  acquire() {
    return this.pool.length > 0 ? this.pool.pop() : this.createFn();
  }
  
  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
}

// Weak references для предотвращения циклических ссылок
const componentRegistry = new WeakMap();
```

## Network Optimization

### Resource Hints
```javascript
// DNS prefetch, preconnect, prefetch
useEffect(() => {
  const hints = [
    { rel: 'dns-prefetch', href: 'https://api.example.com' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com', crossOrigin: 'anonymous' },
    { rel: 'prefetch', href: '/api/user/current' }
  ];
  
  hints.forEach(hint => {
    const link = document.createElement('link');
    Object.assign(link, hint);
    document.head.appendChild(link);
  });
}, []);
```

### Request Batching
```javascript
class RequestBatcher {
  constructor(batchSize = 10, flushInterval = 100) {
    this.queue = [];
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
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
    const batch = this.queue.splice(0);
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    try {
      const responses = await fetch('/api/batch', {
        method: 'POST',
        body: JSON.stringify({ requests: batch.map(item => item.request) })
      }).then(r => r.json());
      
      batch.forEach((item, index) => item.resolve(responses[index]));
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }
}
```

## Performance Budget

```javascript
// Lighthouse CI configuration
module.exports = {
  ci: {
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }]
      }
    }
  }
};

// Bundle size monitoring
describe('Bundle Size', () => {
  it('keeps main bundle under 250KB gzipped', async () => {
    const size = await getPackageSize('dist/main.js');
    expect(size.gzipped).toBeLessThan(250 * 1024);
  });
});
```

## Key Metrics для Senior

**Core Web Vitals**:
- LCP < 2.5s (критические ресурсы, изображения)
- FID < 100ms (debouncing, Web Workers, code splitting)
- CLS < 0.1 (стабильные размеры, skeleton screens)

**Rendering Performance**:
- 60 FPS target (16.67ms per frame)
- Main thread blocking < 50ms
- React render time < 16ms

**Bundle Performance**:
- Initial bundle < 250KB gzipped
- Time to Interactive < 5s
- First Paint < 1.5s

**Memory Management**:
- Heap size growth monitoring
- Event listener cleanup
- Object pooling for frequent allocations

## Частые Senior вопросы

- **Как оптимизировать Core Web Vitals в production?**
- **Стратегии code splitting для больших приложений?**
- **Memory leaks - detection и prevention?**
- **Performance monitoring и alerting setup?**
- **HTTP/2+ optimization techniques?**
- **React Concurrent Features для производительности?**
- **Service Worker caching strategies?**
- **Bundle analysis и optimization workflow?**

## Performance Tools

- **Lighthouse**: Performance audit
- **Chrome DevTools**: Profiling, memory, network
- **React DevTools Profiler**: Component performance
- **Web Vitals**: Real user monitoring
- **Bundle Analyzer**: Bundle size analysis
- **SpeedCurve/GTmetrix**: Continuous monitoring
