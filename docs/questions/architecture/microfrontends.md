# Микрофронтенды (Microfrontends)

## Описание
Вопрос касается архитектурного подхода микрофронтендов - разделения монолитного frontend-приложения на независимые, автономно развиваемые части, каждая из которых принадлежит отдельной команде.

## Детальный ответ

### Что такое микрофронтенды

**Определение**: Микрофронтенды - это архитектурный стиль, где независимо развиваемые frontend-приложения составляют единое целое.

**Основные принципы**:
- Автономность команд
- Независимое развертывание
- Технологическая независимость
- Изоляция кода и состояния

### Подходы к реализации

#### 1. Build-time Integration
Интеграция на этапе сборки через NPM пакеты.

```javascript
// package.json
{
  "dependencies": {
    "@company/header-microfrontend": "^1.2.0",
    "@company/sidebar-microfrontend": "^2.1.0"
  }
}

// main-app/src/App.jsx
import Header from '@company/header-microfrontend';
import Sidebar from '@company/sidebar-microfrontend';

function App() {
  return (
    <div>
      <Header />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main>
          {/* Основное содержимое */}
        </main>
      </div>
    </div>
  );
}
```

**Преимущества**: Простота, оптимизация бандла
**Недостатки**: Необходимость пересборки всего приложения при изменениях

#### 2. Run-time Integration

##### iframe подход
```html
<!-- Простой но ограниченный подход -->
<div class="microfrontend-container">
  <iframe 
    src="https://team-a.microfrontend.com/header"
    width="100%"
    height="60"
    frameborder="0">
  </iframe>
</div>
```

**Преимущества**: Полная изоляция
**Недостатки**: Сложности с коммуникацией, производительность, UX

##### Module Federation (Webpack 5)
```javascript
// webpack.config.js для хост-приложения
const ModuleFederationPlugin = require('@module-federation/webpack');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        header: 'header@http://localhost:3001/remoteEntry.js',
        dashboard: 'dashboard@http://localhost:3002/remoteEntry.js',
      },
    }),
  ],
};

// Динамическая загрузка микрофронтенда
const Header = React.lazy(() => import('header/Header'));

function App() {
  return (
    <div>
      <Suspense fallback={<div>Loading Header...</div>}>
        <Header />
      </Suspense>
      {/* Остальное содержимое */}
    </div>
  );
}
```

```javascript
// webpack.config.js для микрофронтенда
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'header',
      filename: 'remoteEntry.js',
      exposes: {
        './Header': './src/Header',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
};
```

##### Single-SPA Framework
```javascript
// Регистрация микрофронтендов
import { registerApplication, start } from 'single-spa';

registerApplication({
  name: 'header-app',
  app: () => System.import('header-app'),
  activeWhen: () => true,
});

registerApplication({
  name: 'dashboard-app',
  app: () => System.import('dashboard-app'),
  activeWhen: (location) => location.pathname.startsWith('/dashboard'),
});

start();

// Микрофронтенд с Single-SPA
import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';
import App from './App';

const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: App,
  errorBoundary: ErrorBoundary,
});

export const { bootstrap, mount, unmount } = lifecycles;
```

### Коммуникация между микрофронтендами

#### 1. CustomEvents
```javascript
// Отправка события из одного микрофронтенда
const userUpdatedEvent = new CustomEvent('user-updated', {
  detail: { userId: 123, name: 'John Doe' }
});
window.dispatchEvent(userUpdatedEvent);

// Прослушивание в другом микрофронтенде
useEffect(() => {
  const handleUserUpdate = (event) => {
    setUser(event.detail);
  };
  
  window.addEventListener('user-updated', handleUserUpdate);
  
  return () => {
    window.removeEventListener('user-updated', handleUserUpdate);
  };
}, []);
```

#### 2. Shared State через EventBus
```javascript
// Создание глобального eventBus
class EventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
  
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}

window.eventBus = new EventBus();

// Использование в микрофронтендах
// Микрофронтенд A
const updateUserProfile = (userData) => {
  window.eventBus.emit('user-profile-updated', userData);
};

// Микрофронтенд B
useEffect(() => {
  const handleProfileUpdate = (userData) => {
    console.log('User profile updated:', userData);
  };
  
  window.eventBus.on('user-profile-updated', handleProfileUpdate);
  
  return () => {
    window.eventBus.off('user-profile-updated', handleProfileUpdate);
  };
}, []);
```

#### 3. Shared Dependencies
```javascript
// Общие утилиты и состояние
window.sharedDependencies = {
  userService: {
    getCurrentUser: () => fetch('/api/user/current'),
    updateUser: (data) => fetch('/api/user', { method: 'PUT', body: JSON.stringify(data) })
  },
  globalState: {
    user: null,
    theme: 'light'
  }
};
```

### Стилизация и UI консистентность

#### Design System подход
```javascript
// Общий design system пакет
// @company/design-system
export const Button = styled.button`
  background: ${props => props.theme.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
`;

export const theme = {
  primary: '#007bff',
  secondary: '#6c757d',
  spacing: {
    small: '8px',
    medium: '16px',
    large: '24px'
  }
};

// Использование в микрофронтенде
import { Button, theme } from '@company/design-system';
import { ThemeProvider } from 'styled-components';

function MicrofrontendApp() {
  return (
    <ThemeProvider theme={theme}>
      <div>
        <Button>Кнопка из design system</Button>
      </div>
    </ThemeProvider>
  );
}
```

#### CSS-in-JS с префиксами
```javascript
// Автоматическое создание уникальных классов
const useStyles = createUseStyles({
  container: {
    padding: '16px',
    backgroundColor: '#f5f5f5'
  }
}, { generateId: (rule, sheet) => `mf-header-${rule.key}` });
```

### Маршрутизация в микрофронтендах

#### Single-SPA Router
```javascript
// Главное приложение
import { navigateToUrl } from 'single-spa';

function Navigation() {
  return (
    <nav>
      <a href="/dashboard" onClick={navigateToUrl}>Dashboard</a>
      <a href="/profile" onClick={navigateToUrl}>Profile</a>
    </nav>
  );
}

// Микрофронтенд с собственной маршрутизацией
import { Router, Route, Switch } from 'react-router-dom';

function DashboardMicrofrontend() {
  return (
    <Router basename="/dashboard">
      <Switch>
        <Route path="/" exact component={DashboardHome} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
      </Switch>
    </Router>
  );
}
```

### Развертывание и DevOps

#### Independent Deployment Pipeline
```yaml
# .github/workflows/header-microfrontend.yml
name: Header Microfrontend CI/CD

on:
  push:
    paths:
      - 'packages/header/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Header
        run: |
          cd packages/header
          npm install
          npm run build
      
      - name: Deploy to CDN
        run: |
          aws s3 sync packages/header/dist s3://microfrontends-cdn/header/
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_ID }}
```

#### Версионирование
```javascript
// Версионированные endpoints
const MICROFRONTEND_VERSIONS = {
  header: process.env.HEADER_VERSION || 'latest',
  dashboard: process.env.DASHBOARD_VERSION || 'latest'
};

const loadMicrofrontend = (name, version = 'latest') => {
  const script = document.createElement('script');
  script.src = `https://cdn.company.com/${name}/${version}/remoteEntry.js`;
  document.head.appendChild(script);
};
```

### Testing стратегии

#### Contract Testing
```javascript
// Контрактное тестирование между микрофронтендами
describe('Header Microfrontend Contract', () => {
  it('should emit user-logout event with correct structure', () => {
    const eventSpy = jest.fn();
    window.addEventListener('user-logout', eventSpy);
    
    // Симуляция действия в header
    fireEvent.click(screen.getByTestId('logout-button'));
    
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          userId: expect.any(String),
          timestamp: expect.any(Number)
        }
      })
    );
  });
});
```

#### Integration Testing
```javascript
// Интеграционные тесты
describe('Microfrontends Integration', () => {
  beforeEach(() => {
    // Загрузка всех микрофронтендов
    loadMicrofrontend('header');
    loadMicrofrontend('dashboard');
  });
  
  it('should update dashboard when user changes in header', async () => {
    // Изменение пользователя в header
    await userEvent.click(screen.getByTestId('user-switcher'));
    await userEvent.click(screen.getByText('John Doe'));
    
    // Проверка обновления в dashboard
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-user-name')).toHaveTextContent('John Doe');
    });
  });
});
```

### Мониторинг и отладка

#### Error Boundaries для каждого микрофронтенда
```javascript
class MicrofrontendErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    // Отправка ошибки в систему мониторинга
    window.errorReporting?.captureException(error, {
      microfrontend: this.props.name,
      extra: errorInfo
    });
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Что-то пошло не так в {this.props.name}</div>;
    }
    
    return this.props.children;
  }
}
```

#### Performance Monitoring
```javascript
// Мониторинг производительности загрузки микрофронтендов
const measureMicrofrontendLoad = (name) => {
  performance.mark(`${name}-start`);
  
  return {
    end: () => {
      performance.mark(`${name}-end`);
      performance.measure(`${name}-load`, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(`${name}-load`)[0];
      console.log(`${name} loaded in ${measure.duration}ms`);
    }
  };
};
```

## Преимущества и недостатки

### Преимущества
- **Автономные команды**: Независимая разработка и развертывание
- **Технологическое разнообразие**: Каждая команда может выбирать свой стек
- **Масштабируемость**: Легче масштабировать команды и кодовую базу
- **Отказоустойчивость**: Падение одного микрофронтенда не влияет на остальные

### Недостатки
- **Сложность**: Увеличенная сложность архитектуры и инфраструктуры
- **Производительность**: Дублирование зависимостей, больше HTTP запросов
- **Консистентность**: Сложности с поддержанием единого UX
- **Отладка**: Сложнее отлаживать взаимодействие между частями

## Best Practices

1. **Начинайте с монолита**: Микрофронтенды - это эволюция, не стартовая точка
2. **Четкие границы**: Определите четкие границы ответственности
3. **Shared dependencies**: Управляйте общими зависимостями
4. **Consistent UX**: Используйте design system
5. **Monitoring**: Обязательный мониторинг и логирование
6. **Testing**: Инвестируйте в contract и integration тестирование

## Связанные темы
- [State Management](./state-management.md) - Управление состоянием в распределенной архитектуре
- [Performance Optimization](../performance/optimization.md) - Оптимизация производительности
- [Testing Strategies](../testing/strategies.md) - Стратегии тестирования

## Рекомендации для собеседования

**Senior-level ожидания**:
- Понимание различных подходов к реализации микрофронтендов
- Опыт работы с Module Federation или Single-SPA
- Знание проблем и способов их решения
- Понимание DevOps аспектов микрофронтендов
- Опыт с мониторингом и отладкой распределенных систем

**Частые вопросы**:
- Когда стоит использовать микрофронтенды?
- Как обеспечить консистентность UI между микрофронтендами?
- Как тестировать взаимодействие между микрофронтендами?
- Как решать проблемы производительности?
- Как организовать CI/CD для микрофронтендов?
