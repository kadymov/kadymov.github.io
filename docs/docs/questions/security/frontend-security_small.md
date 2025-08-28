# Frontend Security (small)

## OWASP Top 10 Frontend Focus

1. **XSS** - Injection attacks, DOM manipulation
2. **CSRF** - Cross-site request forgery
3. **Sensitive Data Exposure** - Client-side data leaks
4. **Broken Authentication** - JWT/session mishandling
5. **Security Misconfiguration** - Missing headers, CSP
6. **Vulnerable Dependencies** - Supply chain attacks
7. **Insufficient Access Control** - Client-side authorization
8. **Insecure Deserialization** - JSON/data parsing
9. **Logging & Monitoring** - Security event tracking
10. **Transport Security** - HTTPS, certificate issues

## XSS Protection

### Санитизация и валидация
```javascript
import DOMPurify from 'dompurify';

// Санитизация HTML
const sanitizeHTML = (dirty) => DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href']
});

// React безопасность
function UserComment({ comment }) {
  // ❌ Опасно
  // return <div dangerouslySetInnerHTML={{__html: comment.text}} />;
  
  // ✅ Безопасно
  const sanitized = DOMPurify.sanitize(comment.text);
  return <div dangerouslySetInnerHTML={{__html: sanitized}} />;
}

// Экранирование атрибутов
const escapeAttribute = (str) => str.replace(/[&<>"']/g, match => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'
})[match]);
```

### Content Security Policy (CSP)
```javascript
// Строгая CSP конфигурация
const cspConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'nonce-${nonce}'", "'strict-dynamic'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", 'https://api.yourdomain.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"]
};

// Генерация nonce
const generateNonce = () => Buffer.from(crypto.randomBytes(16)).toString('base64');

// CSP нарушения мониторинг
window.addEventListener('securitypolicyviolation', (event) => {
  fetch('/api/csp-report', {
    method: 'POST',
    body: JSON.stringify({
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber
    })
  });
});
```

## CSRF Protection

```javascript
// CSRF Token management
class CSRFProtection {
  constructor() {
    this.token = null;
    this.refreshToken();
  }
  
  async refreshToken() {
    const response = await fetch('/api/csrf-token');
    const { token } = await response.json();
    this.token = token;
  }
  
  async secureRequest(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-CSRF-Token': this.token,
        'Content-Type': 'application/json'
      }
    });
  }
}

// SameSite cookies configuration
const cookieConfig = {
  sameSite: 'Strict',  // или 'Lax' для cross-site navigation
  secure: true,        // только HTTPS
  httpOnly: true       // недоступно из JavaScript
};
```

## JWT Security

### Безопасное хранение токенов
```javascript
class TokenManager {
  constructor() {
    this.accessToken = null; // В памяти
    this.refreshToken = null; // HttpOnly cookie (сервер)
  }
  
  async getAccessToken() {
    if (!this.accessToken || this.isExpired(this.accessToken)) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }
  
  async refreshAccessToken() {
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        credentials: 'include' // HttpOnly cookie
      });
      
      if (!response.ok) throw new Error('Refresh failed');
      
      const { accessToken } = await response.json();
      this.accessToken = accessToken;
    } catch (error) {
      this.logout();
    }
  }
  
  isExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
  
  logout() {
    this.accessToken = null;
    fetch('/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  }
}
```

### Session Management
```javascript
class SessionManager {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 min
    this.warningTime = 5 * 60 * 1000; // 5 min warning
    this.lastActivity = Date.now();
    this.setupActivityTracking();
  }
  
  setupActivityTracking() {
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), true);
    });
    
    setInterval(() => this.checkSession(), 60000);
  }
  
  updateActivity() {
    this.lastActivity = Date.now();
  }
  
  checkSession() {
    const inactive = Date.now() - this.lastActivity;
    
    if (inactive > this.sessionTimeout) {
      this.logout();
    } else if (inactive > this.sessionTimeout - this.warningTime) {
      this.showSessionWarning();
    }
  }
}
```

## Security Headers

### Полный набор заголовков
```javascript
const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-xyz'",
  
  // Clickjacking protection
  'X-Frame-Options': 'DENY',
  
  // MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Transport security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Permissions policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  
  // XSS protection (legacy)
  'X-XSS-Protection': '1; mode=block'
};

// React Helmet для SPA
import { Helmet } from 'react-helmet';

const SecurityHeaders = () => (
  <Helmet>
    {Object.entries(securityHeaders).map(([name, value]) => (
      <meta key={name} httpEquiv={name} content={value} />
    ))}
  </Helmet>
);
```

## Dependency Security

### Supply Chain Protection
```bash
# Аудит зависимостей
npm audit --audit-level=moderate
yarn audit

# Точные версии в package.json
{
  "dependencies": {
    "react": "18.2.0",  # без ^
    "lodash": "4.17.21"
  }
}

# .npmrc настройки
audit-level=moderate
fund=false
```

### Subresource Integrity (SRI)
```html
<!-- SRI для CDN -->
<script 
  src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.min.js"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous">
</script>

<link 
  rel="stylesheet" 
  href="https://cdn.example.com/style.css"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous">
```

## Data Protection

### Шифрование на клиенте
```javascript
// Symmetric encryption для локальных данных
class DataEncryption {
  async generateKey() {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  async encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    return { encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv) };
  }
  
  async decrypt(encryptedData, key) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
      key,
      new Uint8Array(encryptedData.encrypted)
    );
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}

// Secure data cleanup
class SecureDataHandler {
  constructor() {
    this.sensitiveData = null;
    window.addEventListener('beforeunload', () => this.cleanup());
  }
  
  setSensitiveData(data) {
    this.cleanup();
    this.sensitiveData = data;
  }
  
  cleanup() {
    if (this.sensitiveData && typeof this.sensitiveData === 'string') {
      this.sensitiveData = this.sensitiveData.replace(/./g, '0');
    }
    this.sensitiveData = null;
  }
}
```

## Transport Security

### HTTPS Enforcement
```javascript
// Force HTTPS redirect
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  location.replace(`https:${location.href.substring(location.protocol.length)}`);
}

// Certificate validation monitoring
fetch('/api/test').catch(error => {
  if (error.name === 'SecurityError') {
    console.error('Certificate validation failed');
    // Alert security team
  }
});

// Public key pinning check (conceptual)
const validateCertificate = async (response) => {
  const cert = response.headers.get('x-certificate-fingerprint');
  const expectedHashes = ['sha256-HASH1', 'sha256-HASH2'];
  
  if (!expectedHashes.includes(cert)) {
    throw new Error('Certificate pinning validation failed');
  }
};
```

## Security Testing

### Automated Security Testing
```javascript
describe('Security Tests', () => {
  test('XSS protection', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = DOMPurify.sanitize(maliciousInput);
    expect(sanitized).not.toContain('<script>');
  });
  
  test('CSP headers present', async () => {
    const response = await fetch('/');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });
  
  test('HTTPS redirect', () => {
    expect(location.protocol).toBe('https:');
  });
  
  test('Token expiration', () => {
    const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.signature';
    expect(tokenManager.isExpired(expiredToken)).toBe(true);
  });
});
```

### Security Audit Automation
```javascript
// CI/CD security checks
const securityAudit = {
  async checkDependencies() {
    const { execSync } = require('child_process');
    const audit = JSON.parse(execSync('npm audit --json', { encoding: 'utf8' }));
    
    if (audit.metadata.vulnerabilities.high > 0) {
      throw new Error(`Found ${audit.metadata.vulnerabilities.high} high severity vulnerabilities`);
    }
  },
  
  async checkHeaders() {
    const response = await fetch(process.env.APP_URL);
    const requiredHeaders = [
      'content-security-policy',
      'x-frame-options',
      'strict-transport-security'
    ];
    
    requiredHeaders.forEach(header => {
      if (!response.headers.get(header)) {
        throw new Error(`Missing security header: ${header}`);
      }
    });
  },
  
  async checkSSL() {
    const url = new URL(process.env.APP_URL);
    if (url.protocol !== 'https:') {
      throw new Error('Application must run over HTTPS');
    }
  }
};
```

## Security Monitoring

### Real-time Security Monitoring
```javascript
class SecurityMonitor {
  constructor() {
    this.violations = [];
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // CSP violations
    window.addEventListener('securitypolicyviolation', this.handleCSPViolation.bind(this));
    
    // Failed authentication attempts
    this.monitorAuthFailures();
    
    // Suspicious activity patterns
    this.monitorSuspiciousActivity();
  }
  
  handleCSPViolation(event) {
    const violation = {
      type: 'csp_violation',
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      timestamp: Date.now()
    };
    
    this.reportViolation(violation);
  }
  
  monitorAuthFailures() {
    let failedAttempts = 0;
    const maxAttempts = 5;
    
    document.addEventListener('auth_failure', () => {
      failedAttempts++;
      if (failedAttempts >= maxAttempts) {
        this.reportViolation({
          type: 'brute_force_attempt',
          attempts: failedAttempts,
          timestamp: Date.now()
        });
      }
    });
  }
  
  async reportViolation(violation) {
    try {
      await fetch('/api/security/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(violation)
      });
    } catch (error) {
      // Fallback logging
      console.error('Security violation:', violation);
    }
  }
}
```

## Security Checklist для Senior

### Development Phase
- [ ] Input validation и sanitization
- [ ] Output encoding для всех пользовательских данных
- [ ] CSP настроен и протестирован
- [ ] Authentication токены хранятся безопасно
- [ ] CSRF protection реализован
- [ ] Security headers установлены
- [ ] Dependency audit пройден
- [ ] Sensitive data не логируется

### Production Phase
- [ ] HTTPS enforced
- [ ] Security headers присутствуют
- [ ] CSP violations мониторятся
- [ ] Automated security scanning
- [ ] Incident response plan готов
- [ ] Regular security audits
- [ ] Staff security training

### Code Review Focus
- [ ] XSS vectors проверены
- [ ] Authentication flows secure
- [ ] Authorization checks на клиенте и сервере
- [ ] Error messages не раскрывают информацию
- [ ] Crypto operations используют secure APIs
- [ ] Dependencies актуальны
- [ ] Debug code удален

## Security Tools для Senior

**Static Analysis**:
- ESLint Security Plugin
- SonarQube Security Rules
- Semgrep для security patterns

**Dynamic Testing**:
- OWASP ZAP
- Burp Suite
- Browser security extensions

**Dependency Scanning**:
- npm audit / yarn audit
- Snyk
- GitHub Security Advisories

**Monitoring**:
- CSP violation reporting
- Authentication failure tracking
- Abnormal traffic patterns

## Частые Senior вопросы

- **Как защитить JWT токены в браузере?**
- **Настройка CSP для современных SPA?**
- **Supply chain security для frontend зависимостей?**
- **Разница между XSS типами и защита от каждого?**
- **Security headers приоритизация и конфигурация?**
- **CSRF protection в SPA vs traditional web apps?**
- **Security testing интеграция в CI/CD?**
- **Incident response для frontend security issues?**

## Must-know Security Concepts

- **Same-origin policy** и CORS implications
- **Content Security Policy** директивы и nonce usage
- **Authentication vs Authorization** на клиенте
- **Cryptographic best practices** в браузере
- **Supply chain attacks** и mitigation strategies
- **Security headers** полный набор и назначение
- **XSS types** и specific protection mechanisms
- **CSRF tokens** vs SameSite cookies effectiveness
