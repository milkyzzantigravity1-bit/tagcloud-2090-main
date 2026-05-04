# Облако тегов — Школа №2090

Веб-приложение для проведения анонимных опросов с визуализацией результатов в виде облака тегов.

## Стек

- **Frontend + REST**: SvelteKit 2 (Svelte 5) + TypeScript
- **БД**: PostgreSQL 16 + Drizzle ORM
- **Кэш / счётчики**: Redis 7
- **Realtime**: WebSocket (этап 4)
- **Email**: Yandex SMTP через `nodemailer` (этап 5)
- **Облако**: `wordcloud2.js` + `node-canvas` для серверного рендера
- **Контейнеризация**: Docker Compose

## Быстрый старт (локально)

Требуется Node 20+, Docker Desktop / OrbStack / Colima.

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать env
cp .env.example .env

# 3. Поднять Postgres + Redis
npm run db:up

# 4. Сгенерировать и применить миграции
npm run db:generate
npm run db:migrate

# 5. Запустить dev-сервер
npm run dev
```

Приложение: http://localhost:5173
Healthcheck: http://localhost:5173/api/health

## Документация

- [CLAUDE.md](CLAUDE.md) — правила проекта (онбординг для Claude Code и людей)
- [docs/architecture.md](docs/architecture.md) — модули, зависимости, схемы, нагрузка
- [docs/spec.md](docs/spec.md) — продуктовая спецификация (ТЗ + решения)
- [docs/etapes.md](docs/etapes.md) — этапы разработки и критерии готовности
- [docs/modules/](docs/modules/) — интерфейс каждого модуля


## Этапы разработки

См. [docs/etapes.md](docs/etapes.md). Сейчас завершён **этап 1 (скелет)**.

## Лицензия

Образовательный проект.
