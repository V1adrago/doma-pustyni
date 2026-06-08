# Деплой — Дома Пустыни

## Как это работает

Сервер (`server/index.js`) делает всё сразу:
- отдаёт игру (статические файлы из `dist/`)
- обрабатывает WebSocket-комнаты через Socket.IO

Один URL = игра + мультиплеер. Другу просто кидаешь ссылку.

---

## Локальная разработка

```bash
npm install
npm run dev          # только клиент: http://localhost:5173
```

Для локального онлайн-режима (два окна на одном ПК или по сети):

```bash
npm run dev:online   # клиент :5173 + сервер :3000 одновременно
```

---

## Деплой на Render.com (бесплатно, публичный URL)

### Шаг 1 — Загрузить код на GitHub

1. Зайди на [github.com](https://github.com) → **New repository**
2. Название: `doma-pustyni` → **Create repository**
3. В папке проекта выполни:

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/ТВО_ИМЯ/doma-pustyni.git
git push -u origin main
```

### Шаг 2 — Создать сервис на Render

1. Зайди на [render.com](https://render.com) → **Sign up** (можно через GitHub)
2. Dashboard → **New** → **Web Service**
3. Выбери репозиторий `doma-pustyni` → **Connect**
4. Настройки:

| Поле | Значение |
|------|----------|
| Name | doma-pustyni |
| Region | Frankfurt (EU) |
| Branch | main |
| Build Command | `npm install && npm run build` |
| Start Command | `node server/index.js` |
| Plan | **Free** |

5. **Create Web Service**

Render сам установит зависимости, соберёт Vite-билд и запустит сервер.

### Шаг 3 — Получить URL

После деплоя (~2-3 минуты) Render покажет URL вида:
```
https://doma-pustyni.onrender.com
```

Этот URL можно сразу кидать другу — он откроет полную игру включая туториал и мультиплеер.

### Шаг 4 — Обновление игры

Любой `git push` автоматически пересобирает и деплоит:

```bash
git add .
git commit -m "правки"
git push
```

---

## Важно: холодный старт

Бесплатный сервис на Render засыпает через 15 минут без посещений.
Первое обращение после сна занимает ~30-60 секунд (сервер просыпается).

Чтобы этого не было — зарегистрируйся на [UptimeRobot](https://uptimerobot.com) (бесплатно)
и добавь мониторинг на URL игры с интервалом 10 минут. Это не даст серверу засыпать.

---

## Локальный запуск продакшн-версии

```bash
npm run build
npm start          # сервер на http://localhost:3000
```

---

## Структура сборки

```
dist/
├── index.html
└── assets/
    ├── index-[hash].js
    └── index-[hash].css
```

Сервер отдаёт `dist/` как статику и обрабатывает WebSocket на том же порту.
