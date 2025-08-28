# Offline-First Архитектура

## Принципы Offline-First

**Локальное хранение как источник истины**:
- IndexedDB для основных данных
- localStorage для метаданных
- Service Worker для кеширования ресурсов
- Синхронизация в фоновом режиме

## IndexedDB для Offline Storage

```javascript
class OfflineDatabase {
  constructor(dbName, version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createStores(db);
      };
    });
  }
  
  createStores(db) {
    // Основные данные
    const dataStore = db.createObjectStore('posts', { keyPath: 'id' });
    dataStore.createIndex('timestamp', 'timestamp');
    
    // Очередь синхронизации
    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
    syncStore.createIndex('operation', 'operation');
  }
  
  async get(storeName, id) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async put(storeName, data) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

## Offline-First Data Service

```javascript
class OfflineDataService {
  constructor(database, syncService) {
    this.db = database;
    this.syncService = syncService;
  }
  
  // Локальные операции с отложенной синхронизацией
  async create(data) {
    const item = {
      id: this.generateOfflineId(),
      ...data,
      timestamp: Date.now(),
      status: 'pending',
      version: 1
    };
    
    await this.db.put('posts', item);
    await this.syncService.addToQueue('CREATE', item);
    return item;
  }
  
  async update(id, updates) {
    const existing = await this.db.get('posts', id);
    const updated = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      lastModified: Date.now(),
      status: 'pending'
    };
    
    await this.db.put('posts', updated);
    await this.syncService.addToQueue('UPDATE', updated);
    return updated;
  }
  
  async delete(id) {
    const item = await this.db.get('posts', id);
    
    if (item.status === 'pending') {
      // Локальное удаление
      await this.db.delete('posts', id);
      await this.syncService.removeFromQueue('CREATE', { id });
    } else {
      // Помечаем для синхронизации
      await this.db.put('posts', { ...item, isDeleted: true, deletedAt: Date.now() });
      await this.syncService.addToQueue('DELETE', { id });
    }
  }
  
  generateOfflineId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Синхронизация данных

```javascript
class SyncService {
  constructor(database, apiClient) {
    this.db = database;
    this.api = apiClient;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.startSync();
    });
  }
  
  async addToQueue(operation, data) {
    const queueItem = {
      operation,
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    
    await this.db.put('syncQueue', queueItem);
    
    if (this.isOnline) this.startSync();
  }
  
  async startSync() {
    if (!this.isOnline || this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      await this.downloadChanges();
      await this.uploadChanges();
    } finally {
      this.isSyncing = false;
    }
  }
  
  async downloadChanges() {
    const lastSync = await this.getLastSyncTime();
    const changes = await this.api.getChanges({ since: lastSync });
    
    for (const change of changes) {
      await this.applyRemoteChange(change);
    }
  }
  
  async uploadChanges() {
    const queue = await this.db.getAll('syncQueue');
    
    for (const item of queue) {
      try {
        await this.processQueueItem(item);
        await this.db.delete('syncQueue', item.id);
      } catch (error) {
        if (++item.attempts >= 3) {
          await this.db.delete('syncQueue', item.id);
        }
      }
    }
  }
  
  async processQueueItem(item) {
    switch (item.operation) {
      case 'CREATE':
        const serverItem = await this.api.create(item.data);
        await this.updateLocalWithServerData(item.data.id, serverItem);
        break;
      case 'UPDATE':
        const updated = await this.api.update(item.data.id, item.data);
        await this.updateLocalWithServerData(item.data.id, updated);
        break;
      case 'DELETE':
        await this.api.delete(item.data.id);
        await this.db.delete('posts', item.data.id);
        break;
    }
  }
}
```

## Разрешение конфликтов

```javascript
class ConflictResolver {
  resolve(localData, remoteData) {
    const strategy = this.selectStrategy(localData, remoteData);
    
    switch (strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(localData, remoteData);
      case 'merge-fields':
        return this.mergeFields(localData, remoteData);
      case 'user-choice':
        return this.requestUserChoice(localData, remoteData);
    }
  }
  
  selectStrategy(localData, remoteData) {
    const criticalFields = ['title', 'content'];
    const hasConflict = criticalFields.some(field => 
      localData[field] !== remoteData[field]
    );
    
    return hasConflict ? 'user-choice' : 'merge-fields';
  }
  
  lastWriteWins(localData, remoteData) {
    const localTime = localData.lastModified || localData.timestamp;
    const remoteTime = remoteData.lastModified || remoteData.timestamp;
    return localTime > remoteTime ? localData : remoteData;
  }
  
  mergeFields(localData, remoteData) {
    return {
      ...remoteData,
      ...localData,
      tags: [...new Set([...(localData.tags || []), ...(remoteData.tags || [])])],
      lastModified: Math.max(
        localData.lastModified || 0,
        remoteData.lastModified || 0
      )
    };
  }
  
  async requestUserChoice(localData, remoteData) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('conflict-resolution', {
        detail: { local: localData, remote: remoteData, resolve }
      }));
    });
  }
}
```

## React Hooks для Offline-First

```javascript
const useOfflineData = (storeName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const dbRef = useRef(null);
  const serviceRef = useRef(null);
  
  useEffect(() => {
    const initOffline = async () => {
      dbRef.current = new OfflineDatabase('AppDB');
      await dbRef.current.init();
      
      serviceRef.current = new OfflineDataService(
        dbRef.current,
        new SyncService(dbRef.current, new APIClient())
      );
      
      await loadData();
      setLoading(false);
    };
    
    initOffline();
  }, []);
  
  const loadData = async () => {
    const items = await dbRef.current.getAll(storeName);
    setData(items.filter(item => !item.isDeleted));
  };
  
  const create = useCallback(async (itemData) => {
    const item = await serviceRef.current.create(itemData);
    await loadData();
    return item;
  }, []);
  
  const update = useCallback(async (id, updates) => {
    const item = await serviceRef.current.update(id, updates);
    await loadData();
    return item;
  }, []);
  
  const remove = useCallback(async (id) => {
    await serviceRef.current.delete(id);
    await loadData();
  }, []);
  
  return { data, loading, isOnline, create, update, remove };
};

// Sync status hook
const useSyncStatus = () => {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingCount: 0,
    lastSync: null
  });
  
  useEffect(() => {
    const updateStatus = async () => {
      // Получаем статус от sync service
      if (window.syncService) {
        const newStatus = await window.syncService.getStatus();
        setStatus(newStatus);
      }
    };
    
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return status;
};
```

## Service Worker для Offline-First

```javascript
// sw.js - Offline-first caching strategy
const CACHE_NAME = 'offline-first-v1';
const APP_SHELL = ['/', '/static/js/bundle.js', '/static/css/main.css'];

// Offline-first для API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (request.url.includes('/api/')) {
    event.respondWith(
      // Сначала кеш, потом сеть
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          
          return fetch(request)
            .then(response => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            })
            .catch(() => {
              return new Response(JSON.stringify({
                error: 'Network unavailable',
                offline: true
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Обработка отложенных операций
  const db = await openDatabase();
  const queue = await getAllFromStore(db, 'syncQueue');
  
  for (const item of queue) {
    try {
      await syncItem(item);
      await deleteFromStore(db, 'syncQueue', item.id);
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
}
```

## Оптимизация для мобильных устройств

```javascript
class OfflineOptimizer {
  constructor() {
    this.batteryOptimized = false;
    this.connectionQuality = 'good';
    this.setupMonitoring();
  }
  
  async setupMonitoring() {
    // Battery API
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      this.batteryOptimized = battery.level < 0.2;
    }
    
    // Network Information API
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.connectionQuality = this.getConnectionQuality(connection.effectiveType);
    }
  }
  
  getConnectionQuality(effectiveType) {
    const qualityMap = {
      'slow-2g': 'poor',
      '2g': 'poor',
      '3g': 'moderate',
      '4g': 'good'
    };
    return qualityMap[effectiveType] || 'good';
  }
  
  getSyncInterval() {
    if (this.batteryOptimized) return 300000; // 5 min
    
    switch (this.connectionQuality) {
      case 'poor': return 120000; // 2 min
      case 'moderate': return 60000; // 1 min
      default: return 30000; // 30 sec
    }
  }
  
  shouldOptimizeSync() {
    return this.batteryOptimized || this.connectionQuality === 'poor';
  }
}
```

## Sync Status Component

```javascript
function SyncStatusIndicator() {
  const { isSyncing, pendingCount, lastSync } = useSyncStatus();
  const isOnline = navigator.onLine;
  
  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (pendingCount > 0) return `Pending: ${pendingCount}`;
    return 'Synced';
  };
  
  const getStatusColor = () => {
    if (!isOnline) return 'orange';
    if (isSyncing) return 'blue';
    if (pendingCount > 0) return 'yellow';
    return 'green';
  };
  
  return (
    <div className={`sync-status ${getStatusColor()}`}>
      <div className="indicator" />
      <span>{getStatusText()}</span>
      {lastSync && <small>Last: {new Date(lastSync).toLocaleTimeString()}</small>}
    </div>
  );
}
```

## Ключевые принципы Offline-First

**Local-First Philosophy**:
- Локальная база данных как единственный источник истины
- Мгновенный ответ на пользовательские действия
- Синхронизация в фоновом режиме

**Sync Strategies**:
```javascript
const syncStrategies = {
  immediate: 'Синхронизация при каждом изменении',
  batched: 'Групповая синхронизация через интервалы',
  manual: 'Синхронизация по запросу пользователя',
  background: 'Фоновая синхронизация через Service Worker'
};
```

**Conflict Resolution**:
- **Last Write Wins**: Простой, но может потерять данные
- **Manual Resolution**: Пользователь выбирает версию
- **Automatic Merge**: Объединение по правилам
- **Vector Clocks**: Для сложных сценариев

## Data Consistency Models

| Model | Consistency | Availability | Partition Tolerance |
|-------|-------------|--------------|-------------------|
| **Strong Consistency** | Высокая | Низкая | Низкая |
| **Eventual Consistency** | Низкая | Высокая | Высокая |
| **Causal Consistency** | Средняя | Высокая | Высокая |

Offline-first обычно использует **Eventual Consistency**.

## Storage Limits и Управление

```javascript
// Проверка и управление квотами
const checkStorageQuota = async () => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage,
      available: estimate.quota,
      percentage: (estimate.usage / estimate.quota) * 100
    };
  }
};

// Очистка старых данных
const cleanupOldData = async (db, maxAge = 30 * 24 * 60 * 60 * 1000) => {
  const cutoff = Date.now() - maxAge;
  const oldItems = await db.getAll('posts', 'timestamp', IDBKeyRange.upperBound(cutoff));
  
  for (const item of oldItems) {
    if (item.status === 'synced') {
      await db.delete('posts', item.id);
    }
  }
};
```

## Best Practices Senior-level

1. **Progressive Enhancement**: Приложение работает без сети
2. **Optimistic UI**: Мгновенные обновления интерфейса
3. **Conflict Resolution**: Стратегии разрешения конфликтов
4. **Battery Optimization**: Адаптация к состоянию батареи
5. **Storage Management**: Управление квотами и очистка
6. **Background Sync**: Service Worker для фоновой синхронизации
7. **User Feedback**: Индикаторы состояния синхронизации

## Частые Senior вопросы

- **Как обеспечить eventual consistency в offline-first приложениях?**
- **Стратегии разрешения конфликтов данных?**
- **Оптимизация синхронизации для мобильных устройств?**
- **Управление storage quota и очистка данных?**
- **Тестирование offline functionality?**
- **Миграция схемы данных в IndexedDB?**
- **Performance considerations для больших offline datasets?**
