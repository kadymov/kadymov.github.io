# WebSockets и Real-time коммуникация (small)

## Технологии сравнение

| Технология | Направление | Задержка | Overhead | Proxy support | Use Case |
|------------|-------------|----------|----------|---------------|----------|
| WebSockets | Двунаправленная | Очень низкая | Низкий | Ограниченная | Чаты, игры |
| SSE | Односторонняя | Низкая | Средний | Хорошая | Уведомления, live updates |
| Long Polling | Односторонняя | Средняя | Высокий | Отличная | Fallback решения |
| WebRTC | P2P | Очень низкая | Низкий | Ограниченная | Видео/аудио звонки |

## WebSocket с переподключением

```javascript
class WebSocketConnection {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.listeners = new Map();
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.type, data.payload);
    };
    
    this.ws.onclose = (event) => {
      if (!event.wasClean) this.handleReconnect();
    };
  }
  
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 
        this.reconnectInterval * this.reconnectAttempts);
    }
  }
  
  send(type, payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
}
```

## React Hook для WebSockets

```javascript
const useWebSocket = (url, options = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef(null);
  const reconnectTimeoutId = useRef(null);
  
  const connect = useCallback(() => {
    ws.current = new WebSocket(url);
    
    ws.current.onopen = () => setConnectionStatus('Connected');
    ws.current.onmessage = (event) => setLastMessage(JSON.parse(event.data));
    ws.current.onclose = (event) => {
      setConnectionStatus('Disconnected');
      if (!event.wasClean) {
        setConnectionStatus('Reconnecting');
        reconnectTimeoutId.current = setTimeout(connect, 3000);
      }
    };
  }, [url]);
  
  const sendMessage = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutId.current);
      ws.current?.close();
    };
  }, [connect]);
  
  return { connectionStatus, lastMessage, sendMessage };
};
```

## WebSocket Context для глобального состояния

```javascript
const WebSocketContext = createContext();

function websocketReducer(state, action) {
  switch (action.type) {
    case 'CONNECT': return { ...state, isConnected: true, error: null };
    case 'DISCONNECT': return { ...state, isConnected: false };
    case 'MESSAGE_RECEIVED': 
      return { ...state, messages: [...state.messages, action.payload] };
    case 'USERS_UPDATE': 
      return { ...state, activeUsers: action.payload };
    default: return state;
  }
}

export function WebSocketProvider({ children, url }) {
  const [state, dispatch] = useReducer(websocketReducer, {
    isConnected: false,
    messages: [],
    activeUsers: [],
    error: null
  });
  
  const wsRef = useRef();
  
  useEffect(() => {
    const connect = () => {
      wsRef.current = new WebSocket(url);
      wsRef.current.onopen = () => dispatch({ type: 'CONNECT' });
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        dispatch({ type: `${data.type.toUpperCase()}`, payload: data.payload });
      };
      wsRef.current.onclose = () => {
        dispatch({ type: 'DISCONNECT' });
        setTimeout(connect, 3000);
      };
    };
    
    connect();
    return () => wsRef.current?.close();
  }, [url]);
  
  const sendMessage = (message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };
  
  return (
    <WebSocketContext.Provider value={{ ...state, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

## Server-Sent Events (SSE)

```javascript
class ServerSentEvents {
  constructor(url) {
    this.eventSource = new EventSource(url);
    this.listeners = new Map();
    
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit('message', data);
    };
  }
  
  // Кастомные события
  addEventListener(type, callback) {
    this.eventSource.addEventListener(type, callback);
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
}
```

## Продвинутые паттерны

### Room/Channel Management
```javascript
class RoomManager {
  constructor(websocket) {
    this.ws = websocket;
    this.rooms = new Map();
    this.currentRooms = new Set();
  }
  
  joinRoom(roomId, callbacks = {}) {
    if (this.currentRooms.has(roomId)) return false;
    
    this.rooms.set(roomId, callbacks);
    this.currentRooms.add(roomId);
    this.ws.send({ type: 'join_room', payload: { roomId } });
    return true;
  }
  
  handleMessage(data) {
    if (data.roomId && this.rooms.has(data.roomId)) {
      const callbacks = this.rooms.get(data.roomId);
      callbacks[`on${data.type}`]?.(data.payload);
    }
  }
}
```

### Message Queue для offline поддержки
```javascript
class MessageQueue {
  constructor(websocket) {
    this.ws = websocket;
    this.queue = JSON.parse(localStorage.getItem('messageQueue') || '[]');
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => this.isOnline = false);
  }
  
  send(message) {
    const queuedMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    };
    
    if (this.isOnline && this.ws.isConnected()) {
      this.sendMessage(queuedMessage);
    } else {
      this.enqueue(queuedMessage);
    }
  }
  
  enqueue(message) {
    this.queue.push(message);
    localStorage.setItem('messageQueue', JSON.stringify(this.queue));
  }
  
  processQueue() {
    while (this.queue.length > 0 && this.isOnline) {
      const message = this.queue.shift();
      this.sendMessage(message);
    }
    localStorage.setItem('messageQueue', JSON.stringify(this.queue));
  }
}
```

## Оптимизация производительности

### Message Batching
```javascript
class MessageBatcher {
  constructor(websocket, { batchSize = 10, flushInterval = 100 } = {}) {
    this.ws = websocket;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.buffer = [];
    this.timeoutId = null;
  }
  
  send(message) {
    this.buffer.push(message);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.flushInterval);
    }
  }
  
  flush() {
    if (this.buffer.length === 0) return;
    
    this.ws.send({ type: 'batch', payload: this.buffer });
    this.buffer = [];
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }
}
```

### Connection Pooling
```javascript
class WebSocketPool {
  constructor(urls) {
    this.connections = urls.map(url => new WebSocketConnection(url));
    this.currentIndex = 0;
  }
  
  send(message) {
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    connection.send(message);
  }
  
  broadcast(message) {
    this.connections.forEach(conn => conn.send(message));
  }
}
```

## Безопасность

### Аутентификация WebSocket
```javascript
class SecureWebSocket extends WebSocketConnection {
  constructor(url, { token, refreshToken } = {}) {
    super(url);
    this.token = token;
    this.refreshToken = refreshToken;
  }
  
  connect() {
    const urlWithAuth = `${this.url}?token=${this.token}`;
    this.ws = new WebSocket(urlWithAuth);
    this.setupEventHandlers();
  }
  
  send(type, payload) {
    const message = {
      type,
      payload,
      token: this.token,
      timestamp: Date.now()
    };
    super.send(message);
  }
  
  async refreshAuthToken() {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });
    const data = await response.json();
    this.token = data.accessToken;
    this.reconnect();
  }
}
```

## Ключевые проблемы и решения

**Проблемы масштабирования**:
- Sticky sessions для WebSockets
- Redis pub/sub для multi-instance
- Message brokers (RabbitMQ, Apache Kafka)

**Обработка разрывов соединения**:
- Exponential backoff для переподключений
- Heartbeat/ping-pong для проверки соединения
- Circuit breaker pattern

**Fallback стратегии**:
```javascript
const RealtimeClient = {
  async connect(url) {
    try {
      return new WebSocketConnection(url);
    } catch {
      try {
        return new ServerSentEvents(url + '/sse');
      } catch {
        return new LongPolling(url + '/poll');
      }
    }
  }
};
```

## Best Practices Senior-level

1. **Graceful degradation**: WebSocket → SSE → Long polling
2. **Message validation**: JSON schema валидация
3. **Rate limiting**: Throttling на клиенте и сервере
4. **Monitoring**: Connection health, message latency
5. **Testing**: Mock WebSocket для unit тестов
6. **Error recovery**: Exponential backoff, circuit breaker
7. **Security**: Token refresh, message encryption
8. **Performance**: Batching, compression, connection pooling

## Частые Senior вопросы

- **Масштабирование**: Horizontal scaling WebSocket servers
- **Load balancing**: Sticky sessions vs stateless approach  
- **Message ordering**: Гарантии доставки и порядка
- **Backpressure**: Обработка медленных клиентов
- **Monitoring**: Метрики для WebSocket соединений
- **Security**: CSRF, XSS защита в real-time приложениях
