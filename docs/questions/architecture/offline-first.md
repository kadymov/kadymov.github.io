# Offline-first архитектура

## Описание
Вопрос касается создания приложений, которые в первую очередь рассчитаны на работу в оффлайн режиме, с последующей синхронизацией при появлении соединения. Это подход, где offline-функциональность является основной, а не дополнительной.

## Детальный ответ

### Принципы Offline-First

#### 1. Локальное хранение как источник истины
В offline-first приложениях локальное хранилище является основным источником данных.

```javascript
// Локальная база данных с IndexedDB
class OfflineDatabase {
  constructor(dbName, version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Создание объектных хранилищ
        this.createStores(db);
      };
    });
  }
  
  createStores(db) {
    // Пользователи
    if (!db.objectStoreNames.contains('users')) {
      const userStore = db.createObjectStore('users', { keyPath: 'id' });
      userStore.createIndex('email', 'email', { unique: true });
    }
    
    // Посты
    if (!db.objectStoreNames.contains('posts')) {
      const postStore = db.createObjectStore('posts', { keyPath: 'id' });
      postStore.createIndex('authorId', 'authorId');
      postStore.createIndex('timestamp', 'timestamp');
    }
    
    // Очередь синхронизации
    if (!db.objectStoreNames.contains('syncQueue')) {
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('operation', 'operation');
      syncStore.createIndex('timestamp', 'timestamp');
    }
    
    // Метаданные
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }
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
  
  async getAll(storeName, indexName = null, range = null) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    
    return new Promise((resolve, reject) => {
      const request = source.getAll(range);
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
  
  async delete(storeName, id) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Инициализация базы данных
const offlineDB = new OfflineDatabase('AppDatabase');
await offlineDB.init();
```

#### 2. Локальные операции с отложенной синхронизацией
```javascript
// Сервис для работы с постами (offline-first)
class PostService {
  constructor(database, syncService) {
    this.db = database;
    this.syncService = syncService;
  }
  
  // Создание поста (сразу сохраняется локально)
  async createPost(postData) {
    const post = {
      id: this.generateOfflineId(),
      ...postData,
      timestamp: Date.now(),
      status: 'pending', // pending, synced, conflict
      version: 1,
      isLocalChange: true
    };
    
    // Сохраняем в локальную БД
    await this.db.put('posts', post);
    
    // Добавляем в очередь синхронизации
    await this.syncService.addToQueue({
      type: 'CREATE_POST',
      data: post,
      timestamp: Date.now()
    });
    
    return post;
  }
  
  // Обновление поста
  async updatePost(id, updates) {
    const existingPost = await this.db.get('posts', id);
    if (!existingPost) {
      throw new Error('Post not found');
    }
    
    const updatedPost = {
      ...existingPost,
      ...updates,
      version: existingPost.version + 1,
      lastModified: Date.now(),
      isLocalChange: true,
      status: existingPost.status === 'synced' ? 'pending' : existingPost.status
    };
    
    await this.db.put('posts', updatedPost);
    
    await this.syncService.addToQueue({
      type: 'UPDATE_POST',
      data: updatedPost,
      timestamp: Date.now()
    });
    
    return updatedPost;
  }
  
  // Удаление поста
  async deletePost(id) {
    const post = await this.db.get('posts', id);
    if (!post) return;
    
    if (post.isLocalChange && post.status === 'pending') {
      // Если пост еще не синхронизирован, просто удаляем локально
      await this.db.delete('posts', id);
      await this.syncService.removeFromQueue('CREATE_POST', { id });
    } else {
      // Помечаем как удаленный для синхронизации
      const deletedPost = {
        ...post,
        isDeleted: true,
        deletedAt: Date.now(),
        status: 'pending'
      };
      
      await this.db.put('posts', deletedPost);
      
      await this.syncService.addToQueue({
        type: 'DELETE_POST',
        data: { id },
        timestamp: Date.now()
      });
    }
  }
  
  // Получение постов (всегда из локальной БД)
  async getPosts(filters = {}) {
    let posts = await this.db.getAll('posts');
    
    // Фильтруем удаленные посты
    posts = posts.filter(post => !post.isDeleted);
    
    // Применяем фильтры
    if (filters.authorId) {
      posts = posts.filter(post => post.authorId === filters.authorId);
    }
    
    // Сортировка по времени
    posts.sort((a, b) => b.timestamp - a.timestamp);
    
    return posts;
  }
  
  generateOfflineId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 3. Синхронизация данных
```javascript
// Сервис синхронизации
class SyncService {
  constructor(database, apiClient) {
    this.db = database;
    this.api = apiClient;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.conflictResolver = new ConflictResolver();
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.startSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  async addToQueue(operation) {
    const queueItem = {
      ...operation,
      id: crypto.randomUUID(),
      attempts: 0,
      maxAttempts: 3
    };
    
    await this.db.put('syncQueue', queueItem);
    
    if (this.isOnline && !this.isSyncing) {
      this.startSync();
    }
  }
  
  async removeFromQueue(type, criteria) {
    const queue = await this.db.getAll('syncQueue');
    const itemsToRemove = queue.filter(item => 
      item.type === type && 
      Object.keys(criteria).every(key => item.data[key] === criteria[key])
    );
    
    for (const item of itemsToRemove) {
      await this.db.delete('syncQueue', item.id);
    }
  }
  
  async startSync() {
    if (!this.isOnline || this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      // Сначала загружаем изменения с сервера
      await this.downloadChanges();
      
      // Затем отправляем локальные изменения
      await this.uploadChanges();
      
      // Обновляем последнее время синхронизации
      await this.updateLastSyncTime();
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }
  
  async downloadChanges() {
    const lastSync = await this.getLastSyncTime();
    
    try {
      const changes = await this.api.getChanges({ since: lastSync });
      
      for (const change of changes) {
        await this.applyRemoteChange(change);
      }
    } catch (error) {
      console.error('Failed to download changes:', error);
      throw error;
    }
  }
  
  async applyRemoteChange(change) {
    const { type, data } = change;
    const localData = await this.db.get('posts', data.id);
    
    if (localData && localData.isLocalChange && localData.status === 'pending') {
      // Конфликт: и локальные, и удаленные изменения
      const resolution = await this.conflictResolver.resolve(localData, data);
      await this.db.put('posts', resolution);
    } else {
      // Нет конфликта, применяем удаленные изменения
      const updatedData = {
        ...data,
        status: 'synced',
        isLocalChange: false
      };
      await this.db.put('posts', updatedData);
    }
  }
  
  async uploadChanges() {
    const queue = await this.db.getAll('syncQueue');
    
    for (const item of queue) {
      try {
        await this.processQueueItem(item);
        await this.db.delete('syncQueue', item.id);
      } catch (error) {
        item.attempts++;
        
        if (item.attempts >= item.maxAttempts) {
          console.error(`Failed to sync item after ${item.maxAttempts} attempts:`, item);
          await this.db.delete('syncQueue', item.id);
        } else {
          await this.db.put('syncQueue', item);
        }
      }
    }
  }
  
  async processQueueItem(item) {
    const { type, data } = item;
    
    switch (type) {
      case 'CREATE_POST':
        const serverPost = await this.api.createPost(data);
        await this.updateLocalWithServerData(data.id, serverPost);
        break;
        
      case 'UPDATE_POST':
        const updatedPost = await this.api.updatePost(data.id, data);
        await this.updateLocalWithServerData(data.id, updatedPost);
        break;
        
      case 'DELETE_POST':
        await this.api.deletePost(data.id);
        await this.db.delete('posts', data.id);
        break;
        
      default:
        throw new Error(`Unknown sync operation: ${type}`);
    }
  }
  
  async updateLocalWithServerData(localId, serverData) {
    const updatedData = {
      ...serverData,
      status: 'synced',
      isLocalChange: false
    };
    
    // Если ID изменился (например, при создании), обновляем
    if (localId !== serverData.id) {
      await this.db.delete('posts', localId);
    }
    
    await this.db.put('posts', updatedData);
  }
  
  async getLastSyncTime() {
    const metadata = await this.db.get('metadata', 'lastSyncTime');
    return metadata ? metadata.value : 0;
  }
  
  async updateLastSyncTime() {
    await this.db.put('metadata', {
      key: 'lastSyncTime',
      value: Date.now()
    });
  }
}
```

#### 4. Разрешение конфликтов
```javascript
// Система разрешения конфликтов
class ConflictResolver {
  async resolve(localData, remoteData) {
    // Стратегии разрешения конфликтов
    const strategy = this.selectStrategy(localData, remoteData);
    
    switch (strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(localData, remoteData);
      
      case 'merge-fields':
        return this.mergeFields(localData, remoteData);
      
      case 'user-choice':
        return this.requestUserChoice(localData, remoteData);
      
      default:
        return this.lastWriteWins(localData, remoteData);
    }
  }
  
  selectStrategy(localData, remoteData) {
    // Для критических полей требуем выбор пользователя
    const criticalFields = ['title', 'content'];
    const hasConflictInCriticalFields = criticalFields.some(field => 
      localData[field] !== remoteData[field]
    );
    
    if (hasConflictInCriticalFields) {
      return 'user-choice';
    }
    
    // Для простых полей используем слияние
    return 'merge-fields';
  }
  
  lastWriteWins(localData, remoteData) {
    const localTime = localData.lastModified || localData.timestamp;
    const remoteTime = remoteData.lastModified || remoteData.timestamp;
    
    return localTime > remoteTime ? localData : remoteData;
  }
  
  mergeFields(localData, remoteData) {
    // Простое слияние полей
    return {
      ...remoteData,
      ...localData,
      // Специальная логика для определенных полей
      tags: [...new Set([
        ...(localData.tags || []),
        ...(remoteData.tags || [])
      ])],
      lastModified: Math.max(
        localData.lastModified || 0,
        remoteData.lastModified || 0
      )
    };
  }
  
  async requestUserChoice(localData, remoteData) {
    // В реальном приложении это должно показать UI для выбора
    return new Promise((resolve) => {
      const conflictData = {
        local: localData,
        remote: remoteData,
        resolve
      };
      
      // Отправляем событие для показа UI разрешения конфликта
      window.dispatchEvent(new CustomEvent('conflict-resolution-needed', {
        detail: conflictData
      }));
    });
  }
}

// React компонент для разрешения конфликтов
function ConflictResolutionModal({ local, remote, onResolve }) {
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [customResolution, setCustomResolution] = useState(null);
  
  useEffect(() => {
    // Инициализируем кастомное разрешение данными локальной версии
    setCustomResolution({ ...local });
  }, [local]);
  
  const handleResolve = () => {
    let resolution;
    
    switch (selectedVersion) {
      case 'local':
        resolution = local;
        break;
      case 'remote':
        resolution = remote;
        break;
      case 'custom':
        resolution = customResolution;
        break;
      default:
        resolution = local; // fallback
    }
    
    onResolve(resolution);
  };
  
  return (
    <div className="conflict-modal">
      <h3>Конфликт данных</h3>
      <p>Обнаружены различия между локальной и серверной версиями:</p>
      
      <div className="versions-comparison">
        <div className="version">
          <h4>Локальная версия</h4>
          <label>
            <input
              type="radio"
              name="version"
              value="local"
              onChange={(e) => setSelectedVersion(e.target.value)}
            />
            Использовать эту версию
          </label>
          <pre>{JSON.stringify(local, null, 2)}</pre>
        </div>
        
        <div className="version">
          <h4>Серверная версия</h4>
          <label>
            <input
              type="radio"
              name="version"
              value="remote"
              onChange={(e) => setSelectedVersion(e.target.value)}
            />
            Использовать эту версию
          </label>
          <pre>{JSON.stringify(remote, null, 2)}</pre>
        </div>
        
        <div className="version">
          <h4>Объединить вручную</h4>
          <label>
            <input
              type="radio"
              name="version"
              value="custom"
              onChange={(e) => setSelectedVersion(e.target.value)}
            />
            Создать объединенную версию
          </label>
          {selectedVersion === 'custom' && (
            <textarea
              value={JSON.stringify(customResolution, null, 2)}
              onChange={(e) => {
                try {
                  setCustomResolution(JSON.parse(e.target.value));
                } catch (error) {
                  // Игнорируем ошибки парсинга во время ввода
                }
              }}
            />
          )}
        </div>
      </div>
      
      <div className="modal-actions">
        <button onClick={handleResolve} disabled={!selectedVersion}>
          Применить
        </button>
      </div>
    </div>
  );
}
```

### React Integration для Offline-First

#### Custom Hooks для offline-first
```javascript
// Hook для работы с offline-first данными
const useOfflineData = (storeName, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const dbRef = useRef(null);
  const syncServiceRef = useRef(null);
  
  useEffect(() => {
    const initDatabase = async () => {
      try {
        dbRef.current = new OfflineDatabase('AppDatabase');
        await dbRef.current.init();
        
        syncServiceRef.current = new SyncService(
          dbRef.current,
          new APIClient()
        );
        
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    initDatabase();
  }, []);
  
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  const loadData = async () => {
    if (!dbRef.current) return;
    
    try {
      const items = await dbRef.current.getAll(storeName);
      setData(items);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const create = useCallback(async (itemData) => {
    if (!dbRef.current || !syncServiceRef.current) return;
    
    const item = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      timestamp: Date.now(),
      status: 'pending',
      isLocalChange: true
    };
    
    await dbRef.current.put(storeName, item);
    await syncServiceRef.current.addToQueue({
      type: `CREATE_${storeName.toUpperCase()}`,
      data: item
    });
    
    await loadData();
    return item;
  }, [storeName]);
  
  const update = useCallback(async (id, updates) => {
    if (!dbRef.current || !syncServiceRef.current) return;
    
    const existing = await dbRef.current.get(storeName, id);
    if (!existing) throw new Error('Item not found');
    
    const updated = {
      ...existing,
      ...updates,
      lastModified: Date.now(),
      status: existing.status === 'synced' ? 'pending' : existing.status,
      isLocalChange: true
    };
    
    await dbRef.current.put(storeName, updated);
    await syncServiceRef.current.addToQueue({
      type: `UPDATE_${storeName.toUpperCase()}`,
      data: updated
    });
    
    await loadData();
    return updated;
  }, [storeName]);
  
  const remove = useCallback(async (id) => {
    if (!dbRef.current || !syncServiceRef.current) return;
    
    const item = await dbRef.current.get(storeName, id);
    if (!item) return;
    
    if (item.isLocalChange && item.status === 'pending') {
      await dbRef.current.delete(storeName, id);
    } else {
      const deleted = {
        ...item,
        isDeleted: true,
        deletedAt: Date.now(),
        status: 'pending'
      };
      await dbRef.current.put(storeName, deleted);
    }
    
    await syncServiceRef.current.addToQueue({
      type: `DELETE_${storeName.toUpperCase()}`,
      data: { id }
    });
    
    await loadData();
  }, [storeName]);
  
  const sync = useCallback(async () => {
    if (syncServiceRef.current && isOnline) {
      await syncServiceRef.current.startSync();
      await loadData();
    }
  }, [isOnline]);
  
  return {
    data: data.filter(item => !item.isDeleted),
    loading,
    error,
    isOnline,
    create,
    update,
    remove,
    sync,
    refresh: loadData
  };
};

// Hook для статуса синхронизации
const useSyncStatus = () => {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingItems: 0,
    lastSync: null,
    conflicts: []
  });
  
  useEffect(() => {
    const updateStatus = async () => {
      if (window.syncService) {
        const newStatus = await window.syncService.getStatus();
        setStatus(newStatus);
      }
    };
    
    const interval = setInterval(updateStatus, 5000);
    updateStatus();
    
    return () => clearInterval(interval);
  }, []);
  
  return status;
};

// Компонент для отображения статуса синхронизации
function SyncStatusIndicator() {
  const syncStatus = useSyncStatus();
  const isOnline = navigator.onLine;
  
  const getStatusText = () => {
    if (!isOnline) return 'Оффлайн режим';
    if (syncStatus.isSyncing) return 'Синхронизация...';
    if (syncStatus.pendingItems > 0) return `Ожидает синхронизации: ${syncStatus.pendingItems}`;
    return 'Синхронизировано';
  };
  
  const getStatusColor = () => {
    if (!isOnline) return 'orange';
    if (syncStatus.isSyncing) return 'blue';
    if (syncStatus.pendingItems > 0) return 'yellow';
    return 'green';
  };
  
  return (
    <div className={`sync-status ${getStatusColor()}`}>
      <div className="status-indicator" />
      <span>{getStatusText()}</span>
      {syncStatus.lastSync && (
        <small>
          Последняя синхронизация: {new Date(syncStatus.lastSync).toLocaleTimeString()}
        </small>
      )}
    </div>
  );
}
```

### Оптимизация для мобильных устройств

#### Управление памятью и батареей
```javascript
class OfflineOptimizer {
  constructor() {
    this.batteryOptimized = false;
    this.connectionQuality = 'good';
    this.setupBatteryMonitoring();
    this.setupConnectionMonitoring();
  }
  
  async setupBatteryMonitoring() {
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      
      const updateBatteryOptimization = () => {
        this.batteryOptimized = battery.level < 0.2 || !battery.charging;
      };
      
      battery.addEventListener('levelchange', updateBatteryOptimization);
      battery.addEventListener('chargingchange', updateBatteryOptimization);
      updateBatteryOptimization();
    }
  }
  
  setupConnectionMonitoring() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      const updateConnectionQuality = () => {
        const effectiveType = connection.effectiveType;
        
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          this.connectionQuality = 'poor';
        } else if (effectiveType === '3g') {
          this.connectionQuality = 'moderate';
        } else {
          this.connectionQuality = 'good';
        }
      };
      
      connection.addEventListener('change', updateConnectionQuality);
      updateConnectionQuality();
    }
  }
  
  shouldOptimizeSync() {
    return this.batteryOptimized || this.connectionQuality === 'poor';
  }
  
  getSyncInterval() {
    if (this.shouldOptimizeSync()) {
      return 300000; // 5 минут при низком заряде/плохом соединении
    }
    
    switch (this.connectionQuality) {
      case 'poor': return 120000; // 2 минуты
      case 'moderate': return 60000; // 1 минута
      default: return 30000; // 30 секунд
    }
  }
  
  getMaxConcurrentSyncs() {
    if (this.batteryOptimized) return 1;
    
    switch (this.connectionQuality) {
      case 'poor': return 1;
      case 'moderate': return 2;
      default: return 5;
    }
  }
}
```

### Progressive Web App интеграция

#### Манифест и Service Worker
```javascript
// service-worker.js для offline-first PWA
const CACHE_NAME = 'offline-first-v1';
const APP_SHELL = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/offline.html'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Обработка запросов (offline-first стратегия)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Для API запросов используем cache-first с network fallback
  if (request.url.includes('/api/')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Возвращаем кешированный ответ
            return cachedResponse;
          }
          
          // Пытаемся получить из сети
          return fetch(request)
            .then(response => {
              // Кешируем успешный ответ
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            })
            .catch(() => {
              // Если сеть недоступна, возвращаем заглушку
              return new Response(JSON.stringify({
                error: 'Network unavailable',
                offline: true
              }), {
                headers: { 'Content-
