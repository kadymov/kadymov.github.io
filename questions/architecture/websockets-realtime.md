# WebSockets и real-time коммуникация

## Описание
Вопрос касается реализации real-time функциональности в frontend-приложениях с использованием WebSockets, Server-Sent Events и других технологий для двунаправленной коммуникации.

## Детальный ответ

### Технологии real-time коммуникации

#### WebSockets
**Определение**: Протокол для полнодуплексной коммуникации между клиентом и сервером по одному TCP соединению.

**Преимущества**:
- Низкая задержка
- Двунаправленная коммуникация
- Меньше overhead по сравнению с HTTP polling

**Недостатки**:
- Сложность в масштабировании
- Проблемы с прокси и firewall
- Необходимость обработки разрывов соединения

```javascript
// Базовое подключение WebSocket
class WebSocketConnection {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.listeners = new Map();
  }
  
  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.handleReconnect();
    }
  }
  
  setupEventHandlers() {
    this.ws.onopen = (event) => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', event);
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data.payload);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.emit('disconnected', event);
      
      if (!event.wasClean) {
        this.handleReconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }
  
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }
  
  send(type, payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not open. Message not sent:', { type, payload });
    }
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }
}
```

#### Server-Sent Events (SSE)
**Определение**: Технология для получения автоматических обновлений от сервера через HTTP.

**Преимущества**:
- Простота реализации
- Автоматическое переподключение
- Поддержка прокси и кеширования

**Недостатки**:
- Только односторонняя коммуникация (сервер → клиент)
- Ограничения браузера на количество подключений

```javascript
// SSE реализация
class ServerSentEvents {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.eventSource = null;
    this.listeners = new Map();
  }
  
  connect() {
    if (this.eventSource) {
      this.disconnect();
    }
    
    this.eventSource = new EventSource(this.url, this.options);
    
    this.eventSource.onopen = (event) => {
      console.log('SSE connected');
      this.emit('connected', event);
    };
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch (error) {
        this.emit('message', event.data);
      }
    };
    
    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      this.emit('error', error);
    };
  }
  
  // Подписка на кастомные события
  addEventListener(type, callback) {
    this.eventSource?.addEventListener(type, callback);
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
```

### React Integration

#### Custom Hook для WebSockets
```javascript
import { useEffect, useRef, useState, useCallback } from 'react';

const useWebSocket = (url, options = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);
  
  const ws = useRef(null);
  const reconnectTimeoutId = useRef(null);
  const reconnectAttempts = useRef(0);
  
  const maxReconnectAttempts = options.maxReconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 1000;
  
  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        setConnectionStatus('Connected');
        reconnectAttempts.current = 0;
      };
      
      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setLastMessage(message);
        
        if (options.keepHistory) {
          setMessageHistory(prev => [...prev, message]);
        }
      };
      
      ws.current.onclose = (event) => {
        setConnectionStatus('Disconnected');
        
        if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setConnectionStatus('Reconnecting');
          
          reconnectTimeoutId.current = setTimeout(() => {
            connect();
          }, reconnectInterval * reconnectAttempts.current);
        }
      };
      
      ws.current.onerror = () => {
        setConnectionStatus('Error');
      };
      
    } catch (error) {
      setConnectionStatus('Error');
    }
  }, [url, maxReconnectAttempts, reconnectInterval, options.keepHistory]);
  
  const sendMessage = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Client disconnecting');
    }
  }, []);
  
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    connectionStatus,
    lastMessage,
    messageHistory,
    sendMessage,
    disconnect,
    reconnect: connect
  };
};

// Использование в компоненте
function ChatComponent() {
  const { connectionStatus, lastMessage, sendMessage } = useWebSocket(
    'ws://localhost:8080/chat',
    { keepHistory: true, maxReconnectAttempts: 3 }
  );
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    if (lastMessage) {
      setMessages(prev => [...prev, lastMessage]);
    }
  }, [lastMessage]);
  
  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessage({ type: 'chat', content: message, timestamp: Date.now() });
      setMessage('');
    }
  };
  
  return (
    <div>
      <div>Status: {connectionStatus}</div>
      
      <div>
        {messages.map((msg, index) => (
          <div key={index}>{msg.content}</div>
        ))}
      </div>
      
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}
```

#### Context для глобального WebSocket состояния
```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';

const WebSocketContext = createContext();

const initialState = {
  isConnected: false,
  messages: [],
  activeUsers: [],
  error: null
};

function websocketReducer(state, action) {
  switch (action.type) {
    case 'CONNECT':
      return { ...state, isConnected: true, error: null };
    
    case 'DISCONNECT':
      return { ...state, isConnected: false };
    
    case 'ERROR':
      return { ...state, error: action.payload, isConnected: false };
    
    case 'MESSAGE_RECEIVED':
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };
    
    case 'USERS_UPDATE':
      return {
        ...state,
        activeUsers: action.payload
      };
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    
    default:
      return state;
  }
}

export function WebSocketProvider({ children, url }) {
  const [state, dispatch] = useReducer(websocketReducer, initialState);
  const wsRef = useRef();
  
  useEffect(() => {
    const connect = () => {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        dispatch({ type: 'CONNECT' });
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            dispatch({ type: 'MESSAGE_RECEIVED', payload: data.payload });
            break;
          case 'users':
            dispatch({ type: 'USERS_UPDATE', payload: data.payload });
            break;
        }
      };
      
      wsRef.current.onclose = () => {
        dispatch({ type: 'DISCONNECT' });
        // Переподключение через 3 секунды
        setTimeout(connect, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        dispatch({ type: 'ERROR', payload: error.message });
      };
    };
    
    connect();
    
    return () => {
      wsRef.current?.close();
    };
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

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};
```

### Продвинутые паттерны

#### Room/Channel Management
```javascript
class RoomManager {
  constructor(websocket) {
    this.ws = websocket;
    this.rooms = new Map();
    this.currentRooms = new Set();
  }
  
  joinRoom(roomId, callbacks = {}) {
    if (this.currentRooms.has(roomId)) {
      return false;
    }
    
    this.rooms.set(roomId, callbacks);
    this.currentRooms.add(roomId);
    
    this.ws.send({
      type: 'join_room',
      payload: { roomId }
    });
    
    return true;
  }
  
  leaveRoom(roomId) {
    if (!this.currentRooms.has(roomId)) {
      return false;
    }
    
    this.rooms.delete(roomId);
    this.currentRooms.delete(roomId);
    
    this.ws.send({
      type: 'leave_room',
      payload: { roomId }
    });
    
    return true;
  }
  
  sendToRoom(roomId, message) {
    if (this.currentRooms.has(roomId)) {
      this.ws.send({
        type: 'room_message',
        payload: { roomId, message }
      });
    }
  }
  
  handleMessage(data) {
    if (data.roomId && this.rooms.has(data.roomId)) {
      const callbacks = this.rooms.get(data.roomId);
      
      switch (data.type) {
        case 'room_message':
          callbacks.onMessage?.(data.payload);
          break;
        case 'user_joined':
          callbacks.onUserJoined?.(data.payload);
          break;
        case 'user_left':
          callbacks.onUserLeft?.(data.payload);
          break;
      }
    }
  }
}

// Использование
const roomManager = new RoomManager(websocket);

roomManager.joinRoom('chat-general', {
  onMessage: (message) => console.log('New message:', message),
  onUserJoined: (user) => console.log('User joined:', user),
  onUserLeft: (user) => console.log('User left:', user)
});
```

#### Message Queue для offline поддержки
```javascript
class MessageQueue {
  constructor(websocket) {
    this.ws = websocket;
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    
    this.ws.on('connected', () => {
      this.processQueue();
    });
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
    // Сохранение в localStorage для персистентности
    localStorage.setItem('messageQueue', JSON.stringify(this.queue));
  }
  
  dequeue() {
    const message = this.queue.shift();
    localStorage.setItem('messageQueue', JSON.stringify(this.queue));
    return message;
  }
  
  processQueue() {
    while (this.queue.length > 0 && this.isOnline && this.ws.isConnected()) {
      const message = this.dequeue();
      this.sendMessage(message);
    }
  }
  
  sendMessage(message) {
    try {
      this.ws.send(message);
    } catch (error) {
      // Если отправка не удалась, возвращаем в очередь
      if (message.retryCount < 3) {
        message.retryCount++;
        this.enqueue(message);
      }
    }
  }
  
  // Восстановление очереди при инициализации
  restoreQueue() {
    const saved = localStorage.getItem('messageQueue');
    if (saved) {
      this.queue = JSON.parse(saved);
    }
  }
}
```

### Оптимизация производительности

#### Message Batching
```javascript
class MessageBatcher {
  constructor(websocket, options = {}) {
    this.ws = websocket;
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 100;
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
    
    this.ws.send({
      type: 'batch',
      payload: this.buffer
    });
    
    this.buffer = [];
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
```

#### Connection Pooling
```javascript
class WebSocketPool {
  constructor(urls, options = {}) {
    this.urls = urls;
    this.maxConnections = options.maxConnections || urls.length;
    this.connections = [];
    this.currentIndex = 0;
    this.setupConnections();
  }
  
  setupConnections() {
    for (let i = 0; i < Math.min(this.maxConnections, this.urls.length); i++) {
      const connection = new WebSocketConnection(this.urls[i]);
      this.connections.push(connection);
    }
  }
  
  send(message) {
    const connection = this.getNextConnection();
    connection.send(message);
  }
  
  getNextConnection() {
    // Round-robin балансировка
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return connection;
  }
  
  broadcast(message) {
    this.connections.forEach(connection => {
      connection.send(message);
    });
  }
}
```

### Безопасность

#### Authentication и Authorization
```javascript
class SecureWebSocket extends WebSocketConnection {
  constructor(url, options = {}) {
    super(url, options);
    this.token = options.token;
    this.refreshToken = options.refreshToken;
  }
  
  connect() {
    // Добавление токена в URL или заголовки
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
  
  handleTokenExpiration() {
    // Обновление токена и переподключение
    this.refreshAuthToken()
      .then(newToken => {
        this.token = newToken;
        this.disconnect();
        this.connect();
      })
      .catch(error => {
        console.error('Token refresh failed:', error);
        this.emit('authError', error);
      });
  }
  
  async refreshAuthToken() {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });
    
    const data = await response.json();
    return data.accessToken;
  }
}
```

## Сравнение технологий

| Аспект | WebSockets | SSE | Long Polling | WebRTC |
|--------|------------|-----|--------------|--------|
| Направление | Двунаправленная | Односторонняя | Односторонняя | P2P |
| Задержка | Очень низкая | Низкая | Средняя | Очень низкая |
| Overhead | Низкий | Средний | Высокий | Низкий |
| Proxy support | Ограниченная | Хорошая | Отличная | Ограниченная |
| Сложность | Высокая | Низкая | Средняя | Очень высокая |

## Best Practices

1. **Graceful Degradation**: Предусмотрите fallback на polling
2. **Connection Management**: Правильно обрабатывайте переподключения
3. **Message Validation**: Валидируйте входящие сообщения
4. **Error Handling**: Предусмотрите обработку всех типов ошибок
5. **Performance**: Используйте batching и throttling
6. **Security**: Аутентификация и валидация на каждом сообщении

## Связанные темы
- [Performance Optimization](../performance/optimization.md) - Оптимизация real-time приложений
- [Security](../security/frontend-security.md) - Безопасность в real-time коммуникации
- [State Management](./state-management.md) - Управление real-time состоянием

## Рекомендации для собеседования

**Senior-level ожидания**:
- Понимание различий между WebSockets, SSE и других технологий
- Знание проблем масштабирования real-time приложений
- Опыт с обработкой разрывов соединения и переподключениями
- Понимание аспектов безопасности
- Знание оптимизаций производительности

**Частые вопросы**:
- Когда использовать WebSockets vs SSE vs Long Polling?
- Как обрабатывать большое количество одновременных подключений?
- Как обеспечить безопасность real-time соединений?
- Как тестировать WebSocket соединения?
- Как решать проблемы с прокси и firewall?
