# Безопасность Frontend Приложений

## Оглавление
- [Основные Угрозы](#основные-угрозы)
- [XSS (Cross-Site Scripting)](#xss-cross-site-scripting)
- [CSRF (Cross-Site Request Forgery)](#csrf-cross-site-request-forgery)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Безопасность Аутентификации](#безопасность-аутентификации)
- [HTTPS и Transport Security](#https-и-transport-security)
- [Защита Данных](#защита-данных)
- [Безопасность Dependencies](#безопасность-dependencies)
- [Security Headers](#security-headers)
- [Практические Рекомендации](#практические-рекомендации)
- [Инструменты и Аудит](#инструменты-и-аудит)

## Основные Угрозы

### OWASP Top 10 для Frontend:
1. **Injection** - XSS, SQL injection через frontend
2. **Broken Authentication** - небезопасная реализация авторизации
3. **Sensitive Data Exposure** - утечка данных в frontend
4. **XML External Entities (XXE)** - через обработку XML
5. **Broken Access Control** - неправильная авторизация
6. **Security Misconfiguration** - неправильная настройка безопасности
7. **Cross-Site Scripting (XSS)** - внедрение скриптов
8. **Insecure Deserialization** - небезопасная десериализация
9. **Using Components with Known Vulnerabilities** - уязвимые зависимости
10. **Insufficient Logging & Monitoring** - недостаточное логирование

## XSS (Cross-Site Scripting)

### Типы XSS:

#### 1. Reflected XSS
```javascript
// УЯЗВИМЫЙ КОД
function displayUserInput(input) {
  document.innerHTML = `<p>Вы ввели: ${input}</p>`;
}

// БЕЗОПАСНЫЙ КОД
function displayUserInput(input) {
  const sanitizedInput = DOMPurify.sanitize(input);
  const element = document.createElement('p');
  element.textContent = `Вы ввели: ${sanitizedInput}`;
  document.body.appendChild(element);
}
```

#### 2. Stored XSS
```javascript
// React - безопасная обработка пользовательского контента
import DOMPurify from 'dompurify';

function UserComment({ comment }) {
  // УЯЗВИМО
  // return <div dangerouslySetInnerHTML={{__html: comment.text}} />;
  
  // БЕЗОПАСНО
  const sanitizedContent = DOMPurify.sanitize(comment.text);
  return <div dangerouslySetInnerHTML={{__html: sanitizedContent}} />;
}

// Еще более безопасно - использование textContent
function UserComment({ comment }) {
  return <div>{comment.text}</div>; // React автоматически экранирует
}
```

#### 3. DOM-based XSS
```javascript
// УЯЗВИМЫЙ КОД
const userInput = new URLSearchParams(window.location.search).get('q');
document.getElementById('search-term').innerHTML = userInput;

// БЕЗОПАСНЫЙ КОД
const userInput = new URLSearchParams(window.location.search).get('q');
document.getElementById('search-term').textContent = userInput;

// Или с валидацией
function sanitizeSearchTerm(term) {
  return term ? term.replace(/<[^>]*>/g, '') : '';
}
```

### Защита от XSS:

#### Content Security Policy (CSP)
```html
<!-- Базовая CSP -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline';">

<!-- Строгая CSP -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'nonce-random123' 'strict-dynamic'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:;">
```

#### Санитизация входных данных
```javascript
import DOMPurify from 'dompurify';

// Санитизация HTML
function sanitizeHTML(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
}

// Экранирование для атрибутов
function escapeAttribute(str) {
  return str.replace(/[&<>"']/g, (match) => {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return escapeMap[match];
  });
}
```

## CSRF (Cross-Site Request Forgery)

### Защита от CSRF:

#### 1. CSRF Token
```javascript
// Получение CSRF токена
async function getCSRFToken() {
  const response = await fetch('/api/csrf-token');
  const { token } = await response.json();
  return token;
}

// Отправка запроса с токеном
async function makeSecureRequest(data) {
  const csrfToken = await getCSRFToken();
  
  return fetch('/api/sensitive-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(data)
  });
}
```

#### 2. SameSite Cookies
```javascript
// Настройка cookie с SameSite
document.cookie = "sessionId=abc123; SameSite=Strict; Secure; HttpOnly";

// В Express.js
app.use(session({
  cookie: {
    sameSite: 'strict',
    secure: true, // только для HTTPS
    httpOnly: true
  }
}));
```

#### 3. Проверка Referer/Origin
```javascript
// Middleware для проверки Origin
function validateOrigin(req, res, next) {
  const allowedOrigins = ['https://yourdomain.com'];
  const origin = req.headers.origin;
  
  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }
  
  next();
}
```

## Content Security Policy (CSP)

### Детальная настройка CSP:

```javascript
// CSP для React приложения
const cspConfig = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'nonce-${nonce}'",
    'https://cdn.jsdelivr.net'
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // для styled-components
    'https://fonts.googleapis.com'
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com'
  ],
  'img-src': [
    "'self'",
    'data:',
    'https:'
  ],
  'connect-src': [
    "'self'",
    'https://api.yourdomain.com'
  ]
};

// Генерация CSP заголовка
function generateCSP(config) {
  return Object.entries(config)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}
```

### Nonce для inline скриптов:
```javascript
// Генерация nonce
function generateNonce() {
  return Buffer.from(crypto.randomBytes(16)).toString('base64');
}

// React с nonce
function App({ nonce }) {
  return (
    <>
      <script nonce={nonce}>
        {`console.log('Безопасный inline скрипт');`}
      </script>
    </>
  );
}
```

## Безопасность Аутентификации

### JWT Security:

#### 1. Безопасное хранение токенов
```javascript
// НЕБЕЗОПАСНО - localStorage
localStorage.setItem('token', jwt);

// БОЛЕЕ БЕЗОПАСНО - httpOnly cookie
// (устанавливается сервером)
app.post('/login', (req, res) => {
  const token = generateJWT(user);
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600000 // 1 час
  });
});

// КОМПРОМИСС - memory storage с refresh token
class TokenManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = this.getRefreshTokenFromSecureStorage();
  }
  
  async getAccessToken() {
    if (!this.accessToken || this.isTokenExpired(this.accessToken)) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }
  
  async refreshAccessToken() {
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        credentials: 'include' // для httpOnly cookie с refresh token
      });
      
      const { accessToken } = await response.json();
      this.accessToken = accessToken;
    } catch (error) {
      this.logout();
    }
  }
}
```

#### 2. Token Validation
```javascript
// Валидация JWT на frontend (базовая проверка)
function validateJWT(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    
    // Проверка истечения
    if (decodedPayload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }
    
    // Проверка issuer
    if (decodedPayload.iss !== 'your-app') {
      throw new Error('Invalid issuer');
    }
    
    return decodedPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

### Session Management:
```javascript
// Безопасное управление сессией
class SessionManager {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 минут
    this.warningTime = 5 * 60 * 1000; // 5 минут до истечения
    this.setupSessionTracking();
  }
  
  setupSessionTracking() {
    // Отслеживание активности пользователя
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => this.updateLastActivity(), true);
    });
    
    // Проверка сессии каждую минуту
    setInterval(() => this.checkSession(), 60000);
  }
  
  updateLastActivity() {
    this.lastActivity = Date.now();
  }
  
  checkSession() {
    const timeSinceLastActivity = Date.now() - this.lastActivity;
    
    if (timeSinceLastActivity > this.sessionTimeout) {
      this.logout();
    } else if (timeSinceLastActivity > this.sessionTimeout - this.warningTime) {
      this.showSessionWarning();
    }
  }
  
  async logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }
}
```

## HTTPS и Transport Security

### Strict Transport Security (HSTS):
```javascript
// Настройка HSTS заголовков
app.use((req, res, next) => {
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  next();
});

// Проверка HTTPS в приложении
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace(`https:${location.href.substring(location.protocol.length)}`);
}
```

### Certificate Pinning:
```javascript
// Public Key Pinning (устарело, но важно знать концепцию)
const expectedPublicKeyHash = 'sha256-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=';

fetch('/api/data', {
  // В современных браузерах используется Certificate Transparency
  // и проверка сертификатов встроена
}).catch(error => {
  if (error.name === 'SecurityError') {
    console.error('Certificate validation failed');
  }
});
```

## Защита Данных

### Шифрование на Frontend:
```javascript
// Шифрование чувствительных данных перед отправкой
async function encryptSensitiveData(data, publicKey) {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicKey,
    encodedData
  );
  
  return Array.from(new Uint8Array(encrypted));
}

// Хеширование паролей (только для дополнительной защиты)
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Защита от утечек данных:
```javascript
// Очистка чувствительных данных из памяти
class SecureDataHandler {
  constructor() {
    this.sensitiveData = null;
  }
  
  setSensitiveData(data) {
    this.clearSensitiveData();
    this.sensitiveData = data;
  }
  
  clearSensitiveData() {
    if (this.sensitiveData) {
      // Перезапись данных
      if (typeof this.sensitiveData === 'string') {
        this.sensitiveData = this.sensitiveData.replace(/./g, '0');
      }
      this.sensitiveData = null;
    }
  }
  
  // Автоматическая очистка при закрытии страницы
  setupCleanup() {
    window.addEventListener('beforeunload', () => {
      this.clearSensitiveData();
    });
  }
}
```

## Безопасность Dependencies

### Аудит зависимостей:
```bash
# NPM аудит
npm audit
npm audit fix

# Yarn аудит
yarn audit

# Использование специализированных инструментов
npx audit-ci --config audit-ci.json
```

### Защита от Supply Chain атак:
```javascript
// package.json с точными версиями
{
  "dependencies": {
    "react": "18.2.0", // Точная версия вместо ^18.2.0
    "lodash": "4.17.21"
  }
}

// .npmrc для дополнительной безопасности
audit-level=moderate
fund=false
```

### Subresource Integrity (SRI):
```html
<!-- SRI для CDN -->
<script 
  src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous">
</script>

<link 
  rel="stylesheet" 
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0/dist/css/bootstrap.min.css"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous">
```

## Security Headers

### Полный набор security заголовков:
```javascript
// Express.js middleware для security заголовков
function setSecurityHeaders(req, res, next) {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline'");
  
  // X-Frame-Options (защита от clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=()');
  
  // X-XSS-Protection (устарело, но может быть полезно)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
}
```

### React Helmet для SPA:
```javascript
import { Helmet } from 'react-helmet';

function SecurityHeaders() {
  return (
    <Helmet>
      <meta httpEquiv="Content-Security-Policy" 
            content="default-src 'self'; script-src 'self' 'unsafe-inline'" />
      <meta httpEquiv="X-Frame-Options" content="DENY" />
      <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
    </Helmet>
  );
}
```

## Практические Рекомендации

### Checklist для безопасности:

#### 1. Входные данные
- [ ] Валидация всех пользовательских входных данных
- [ ] Санитизация HTML контента
- [ ] Ограничение размера загружаемых файлов
- [ ] Проверка типов файлов

#### 2. Аутентификация
- [ ] Использование HTTPS
- [ ] Безопасное хранение токенов
- [ ] Реализация logout на всех устройствах
- [ ] Ограничение попыток входа

#### 3. Авторизация
- [ ] Проверка прав доступа на frontend и backend
- [ ] Скрытие чувствительных элементов интерфейса
- [ ] Валидация на уровне API

#### 4. Конфигурация
- [ ] Настройка CSP
- [ ] Установка security заголовков
- [ ] Удаление debug информации в production
- [ ] Минификация и обфускация кода

### Безопасное кодирование:
```javascript
// Безопасная обработка ошибок
function handleError(error) {
  // НЕ выводим stack trace в production
  if (process.env.NODE_ENV === 'production') {
    console.error('Application error occurred');
    // Отправляем детали в систему мониторинга
    errorReporting.report(error);
  } else {
    console.error(error);
  }
  
  // Показываем пользователю общее сообщение
  return { message: 'Произошла ошибка. Попробуйте позже.' };
}

// Безопасная работа с URL
function createSafeURL(baseURL, params) {
  const url = new URL(baseURL);
  
  Object.entries(params).forEach(([key, value]) => {
    // Валидация параметров
    if (typeof value === 'string' && value.length < 1000) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
}
```

## Инструменты и Аудит

### Инструменты для аудита безопасности:

#### 1. Статический анализ
```bash
# ESLint с правилами безопасности
npm install eslint-plugin-security --save-dev

# SonarQube для анализа кода
sonar-scanner -Dsonar.projectKey=my-project
```

#### 2. Динамическое тестирование
```javascript
// Тестирование XSS
describe('XSS Protection', () => {
  test('should sanitize user input', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = DOMPurify.sanitize(maliciousInput);
    expect(sanitized).not.toContain('<script>');
  });
  
  test('should escape HTML entities', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const component = render(<UserInput value={input} />);
    expect(component.container.innerHTML).not.toContain('onerror');
  });
});
```

#### 3. Browser Security Testing
```javascript
// Проверка CSP
function testCSP() {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) {
    console.warn('CSP не настроен');
    return false;
  }
  
  const csp = meta.getAttribute('content');
  return csp.includes("default-src 'self'");
}

// Проверка HTTPS
function ensureHTTPS() {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    throw new Error('Приложение должно работать только по HTTPS');
  }
}
```

### Мониторинг безопасности:
```javascript
// Мониторинг CSP нарушений
window.addEventListener('securitypolicyviolation', (event) => {
  const violation = {
    directive: event.violatedDirective,
    blockedURI: event.blockedURI,
    sourceFile: event.sourceFile,
    lineNumber: event.lineNumber
  };
  
  // Отправка отчета о нарушении
  fetch('/api/csp-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(violation)
  });
});
```

### Автоматизация проверок:
```javascript
// CI/CD pipeline проверки
const securityChecks = {
  async auditDependencies() {
    const audit = await exec('npm audit --json');
    const results = JSON.parse(audit.stdout);
    
    if (results.metadata.vulnerabilities.high > 0) {
      throw new Error('Найдены критические уязвимости');
    }
  },
  
  async checkCSP() {
    const response = await fetch(process.env.APP_URL);
    const csp = response.headers.get('content-security-policy');
    
    if (!csp || !csp.includes("default-src 'self'")) {
      throw new Error('CSP не настроен правильно');
    }
  }
};
```

## Выводы для Собеседования

### Ключевые принципы безопасности:
1. **Defense in Depth** - многоуровневая защита
2. **Principle of Least Privilege** - минимальные необходимые права
3. **Input Validation** - проверка всех входных данных
4. **Output Encoding** - кодирование выходных данных
5. **Security by Design** - безопасность с самого начала

### Вопросы, которые может задать интервьюер:
- Как защитить приложение от XSS атак?
- Что такое CSP и как его настроить?
- Как безопасно хранить JWT токены?
- Какие security заголовки нужно устанавливать?
- Как проверить зависимости на уязвимости?

### Практические задачи:
- Найти и исправить XSS уязвимость в коде
- Настроить CSP для React приложения
- Реализовать безопасную аутентификацию
- Провести аудит безопасности существующего приложения

---

**Связанные материалы:**
- [JavaScript - Event Loop](../javascript/event-loop.md)
- [React - Context API](../react/context-api.md)
- [Архитектура - State Management](../architecture/state-management.md)
- [TypeScript - Advanced Types](../typescript/advanced-types.md)
