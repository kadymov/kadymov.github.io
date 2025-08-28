# SSR/SSG и React Server Components

## Описание
Вопрос касается современных подходов к рендерингу React-приложений на стороне сервера, включая Server-Side Rendering (SSR), Static Site Generation (SSG) и новые React Server Components (RSC).

## Детальный ответ

### Server-Side Rendering (SSR)

**Определение**: SSR - это процесс рендеринга React-компонентов на сервере и отправки готового HTML клиенту.

**Преимущества**:
- Быстрое время до первой отрисовки (FCP)
- Лучшее SEO (поисковики индексируют готовый HTML)
- Улучшенная производительность на медленных устройствах
- Социальные сети могут парсить метатеги

**Недостатки**:
- Увеличенная нагрузка на сервер
- Сложность кеширования
- Время до интерактивности (TTI) может быть больше
- Проблемы с гидратацией

```javascript
// Пример SSR с Next.js
export async function getServerSideProps(context) {
  const data = await fetchUserData(context.params.id);
  
  return {
    props: {
      user: data,
    },
  };
}

export default function UserPage({ user }) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Static Site Generation (SSG)

**Определение**: SSG - это генерация статических HTML файлов во время сборки.

**Преимущества**:
- Максимальная производительность
- Отличное SEO
- Простое развертывание через CDN
- Высокая надежность

**Недостатки**:
- Не подходит для динамического контента
- Время сборки увеличивается с количеством страниц
- Нужна пересборка для обновления контента

```javascript
// Пример SSG с Next.js
export async function getStaticProps() {
  const posts = await fetchPosts();
  
  return {
    props: {
      posts,
    },
    // Регенерация каждые 60 секунд (ISR)
    revalidate: 60,
  };
}

export async function getStaticPaths() {
  const posts = await fetchPosts();
  const paths = posts.map((post) => ({
    params: { id: post.id },
  }));

  return {
    paths,
    fallback: 'blocking', // или true, false
  };
}
```

### React Server Components (RSC)

**Определение**: RSC - это новая парадигма, где компоненты выполняются исключительно на сервере и отправляют сериализованный результат клиенту.

**Ключевые особенности**:
- Выполняются только на сервере
- Имеют прямой доступ к серверным ресурсам
- Не включаются в клиентский бандл
- Могут использовать async/await напрямую

```javascript
// Server Component (выполняется на сервере)
async function BlogPost({ id }) {
  // Прямой доступ к базе данных
  const post = await db.posts.findById(id);
  const comments = await db.comments.findByPostId(id);
  
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      
      {/* Client Component для интерактивности */}
      <CommentSection comments={comments} />
    </article>
  );
}

// Client Component (отмечен директивой)
'use client';

function CommentSection({ comments }) {
  const [newComment, setNewComment] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Отправка комментария
  };
  
  return (
    <div>
      {comments.map(comment => (
        <div key={comment.id}>{comment.text}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <textarea 
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button type="submit">Добавить комментарий</button>
      </form>
    </div>
  );
}
```

### Сравнение подходов

| Аспект | SSR | SSG | RSC |
|--------|-----|-----|-----|
| Производительность | Средняя | Высокая | Высокая |
| SEO | Отличное | Отличное | Отличное |
| Динамический контент | Да | Ограниченно | Да |
| Размер бандла | Большой | Большой | Меньше |
| Сложность | Средняя | Низкая | Высокая |
| Доступ к серверу | Ограниченный | Ограниченный | Прямой |

### Стратегии гидратации

**Проблемы гидратации**:
- Несоответствие серверного и клиентского HTML
- Блокирующая гидратация
- Пропуск интерактивности

```javascript
// Решение проблем гидратации
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Динамическая загрузка для избежания проблем гидратации
const DynamicComponent = dynamic(
  () => import('./HeavyComponent'),
  { 
    ssr: false,
    loading: () => <div>Loading...</div>
  }
);

// Использование Suspense для потоковой гидратации
function App() {
  return (
    <div>
      <header>Static Header</header>
      <Suspense fallback={<div>Loading content...</div>}>
        <DynamicContent />
      </Suspense>
    </div>
  );
}
```

### Оптимизация производительности

**Selective Hydration**:
```javascript
// React 18 - автоматическая селективная гидратация
import { hydrateRoot } from 'react-dom/client';

const container = document.getElementById('root');
hydrateRoot(container, <App />);
```

**Streaming SSR**:
```javascript
// Потоковый SSR в Next.js App Router
export default function Layout({ children }) {
  return (
    <html>
      <body>
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        
        <main>
          <Suspense fallback={<ContentSkeleton />}>
            {children}
          </Suspense>
        </main>
      </body>
    </html>
  );
}
```

### Best Practices

1. **Выбор подходящей стратегии**:
   - SSG для статического контента
   - SSR для динамического контента
   - RSC для серверо-зависимой логики

2. **Оптимизация размера бандла**:
   ```javascript
   // Разделение на Server и Client компоненты
   // app/page.js (Server Component)
   import ClientComponent from './ClientComponent';
   
   export default async function Page() {
     const data = await fetch('...');
     
     return (
       <div>
         <h1>Server-rendered content</h1>
         <ClientComponent data={data} />
       </div>
     );
   }
   ```

3. **Управление состоянием**:
   ```javascript
   // Использование Server Actions для мутаций
   async function createPost(formData) {
     'use server';
     
     const title = formData.get('title');
     await db.posts.create({ title });
     revalidatePath('/posts');
   }
   
   export default function CreatePost() {
     return (
       <form action={createPost}>
         <input name="title" />
         <button type="submit">Create</button>
       </form>
     );
   }
   ```

## Связанные темы
- [Event Loop](../javascript/event-loop.md) - Для понимания асинхронности
- [Concurrent Rendering](./concurrent-rendering.md) - React 18 особенности
- [Performance Optimization](../performance/optimization.md) - Оптимизация производительности

## Рекомендации для собеседования

**Senior-level ожидания**:
- Понимание различий между SSR, SSG и RSC
- Знание проблем гидратации и способов их решения
- Опыт работы с Next.js или аналогичными фреймворками
- Понимание impact на производительность и SEO
- Знание React 18+ особенностей (Concurrent Rendering, Suspense)

**Частые подводные камни**:
- Неправильное использование useEffect в SSR
- Проблемы с гидратацией из-за динамических данных
- Неоптимальное разделение на Server/Client компоненты
- Игнорирование водопадов запросов в RSC
