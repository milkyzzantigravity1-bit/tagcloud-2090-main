# Архитектура

## Контекст

Один процесс Node (SvelteKit + custom WS) обслуживает HTTP/WS-трафик. Postgres хранит долгоживущие данные, Redis — горячие счётчики и rate-limit. Caddy терминирует HTTPS и проксирует.

```
                    Интернет
                       │
                  ┌────▼─────┐
                  │  Caddy   │  HTTPS, статика, /api, /ws
                  └────┬─────┘
            ┌──────────┴──────────┐
            │                     │
       /, /api/*              /ws/:code
            │                     │
       ┌────▼─────────────────────▼────┐
       │   Node.js (SvelteKit + ws)    │
       │   ──────────────────────      │
       │   • REST: surveys, voting     │
       │   • WS: cloud broadcast       │
       │   • Cron: expiry → email      │
       └────┬───────────────────┬──────┘
            │                   │
       ┌────▼────┐         ┌────▼────┐
       │Postgres │         │ Redis   │
       │ (truth) │         │(counters│
       └─────────┘         │ + rate) │
                           └─────────┘
```

## Модули

Каждый модуль — папка в `src/lib/server/<module>/`. Имеет публичный интерфейс (что экспортирует) и не должен лезть в детали других модулей.

| Модуль | Назначение | Доку |
|---|---|---|
| `db` (core) | Drizzle-клиент Postgres | в `schema.ts` |
| `redis` (core) | ioredis-клиент | inline |
| `surveys` | CRUD опросов, генерация code | [modules/surveys.md](modules/surveys.md) |
| `voting` | Приём голосов, валидация, rate-limit, батч-INSERT | [modules/voting.md](modules/voting.md) |
| `realtime` | WS-сервер, broadcast облака | [modules/realtime.md](modules/realtime.md) |
| `cloud` | Агрегация частот, рендер (клиент + сервер) | [modules/cloud.md](modules/cloud.md) |
| `expiry` | Cron-сканер истёкших опросов | [modules/expiry-email.md](modules/expiry-email.md) |
| `email` | Yandex SMTP + шаблоны | [modules/expiry-email.md](modules/expiry-email.md) |
| `export` | CSV (вариант, количество) | [modules/expiry-email.md](modules/expiry-email.md) |
| `qr` | Генерация QR-PNG из URL | [modules/qr.md](modules/qr.md) |
| `branding` | Лого, цвета, layout | [modules/branding.md](modules/branding.md) |

## Зависимости между модулями

```
surveys ──► db, redis, qr
voting  ──► db, redis, surveys (читает meta)
realtime──► db, redis
cloud   ──► (чистая утилита, без БД)
expiry  ──► db, cloud, export, email
email   ──► (отдельно)
export  ──► db
qr      ──► (отдельно)
```

Правило: модуль может импортировать только то, что в его столбце "зависимости". Никаких обратных рёбер.

## Структура папок

```
src/
├── app.html, app.css, app.d.ts
├── hooks.server.ts                     # инициализация WS + cron
├── lib/
│   ├── theme.ts                        # палитра 2090 (общая)
│   ├── cloud.ts                        # утилиты облака для клиента
│   ├── types/                          # общие типы (DTO survey, cloud message)
│   └── server/
│       ├── db.ts                       # postgres-js + drizzle
│       ├── redis.ts                    # ioredis
│       ├── schema.ts                   # Drizzle-схема
│       ├── surveys/
│       │   ├── create.ts
│       │   ├── get.ts
│       │   ├── codes.ts                # генератор 6-символьного кода
│       │   └── validation.ts           # zod-схемы
│       ├── voting/
│       │   ├── submit.ts               # с батчингом
│       │   ├── validate.ts
│       │   ├── rate-limit.ts
│       │   └── validation.ts
│       ├── realtime/
│       │   ├── ws-server.ts            # apply WebSocketServer к Node http.Server
│       │   ├── broadcast.ts            # тикер + diff
│       │   └── protocol.ts             # типы сообщений
│       ├── cloud/
│       │   ├── aggregate.ts            # подсчёт по responses → top N
│       │   └── render-png.ts           # node-canvas + wordcloud2
│       ├── expiry/
│       │   ├── cron.ts                 # node-cron каждую минуту
│       │   └── process.ts              # один опрос → email
│       ├── email/
│       │   ├── smtp.ts                 # nodemailer transport
│       │   └── templates.ts            # html + text
│       ├── export/
│       │   └── csv.ts
│       └── qr/
│           └── generate.ts
└── routes/
    ├── +layout.svelte, +page.svelte
    ├── new/+page.svelte                # форма создания опроса
    ├── s/[code]/+page.svelte           # дашборд создателя (live cloud)
    ├── r/[code]/+page.svelte           # страница респондента
    └── api/
        ├── health/+server.ts
        ├── surveys/+server.ts                     # POST создать
        ├── surveys/[code]/+server.ts              # GET (creator-token)
        ├── surveys/[code]/public/+server.ts       # GET (анонимно)
        ├── surveys/[code]/answer/+server.ts       # POST голос
        ├── surveys/[code]/aggregate/+server.ts    # GET top-N (для дашборда)
        └── surveys/[code]/export.csv/+server.ts   # GET CSV
```

## Схема БД

См. `src/lib/server/schema.ts`. Краткая ER-схема:

```
surveys (1) ──< (N) questions (1) ──< (N) responses
```

Таблицы:

- **surveys**: id, code(uniq), title?, creator_email, case_sensitive, color_scheme(enum), custom_palette(jsonb?), expires_at, status(enum), created_at
  - индекс `(status, expires_at)` для cron-сканера
- **questions**: id, survey_id(FK cascade), text, answer_type(enum), position
  - индекс `(survey_id, position)`
- **responses**: id(bigserial), question_id(FK cascade), word, word_norm, created_at
  - индекс `(question_id, word_norm)` — для агрегации топ-N

Миграции — `drizzle/*.sql` (генерируются `db:generate`).

## Поток данных

### Создание опроса

```
POST /api/surveys → validate (zod)
  → INSERT survey + INSERT questions[] (одна транзакция)
  → generate code (6 символов, alphabet без 0/O/1/I/l)
  → generate QR PNG из URL
  ← { code, url, qrPngBase64, expiresAt }
```

### Голосование

```
POST /api/surveys/:code/answer { questionId, words[] }
  → rate-limit Redis (sha256(ip+salt), TTL 10s, max 30/min)
  → validate (length ≤ 50, count ≤ 20, no whitespace if single)
  → normalize (lowercase if !caseSensitive)
  → push в воркер-очередь (in-memory) → батч-INSERT каждые 200ms
  → ZINCRBY cloud:<questionId> 1 <wordNorm>
  ← { ok: true }
```

WS-broadcast подписан на изменения Redis-ключа `cloud:*`, шлёт diff раз в 2-3 сек.

### Истечение

```
cron каждую минуту:
  SELECT * FROM surveys WHERE status='active' AND expires_at < now()
  for each:
    aggregate (per-question) → [(word_norm, count), ...]
    render PNG (per-question, цветовая схема из survey)
    build CSV
    nodemailer.sendMail(creator_email, { html, attachments: [PNG, CSV] })
    UPDATE status='sent'
    Если send упал — UPDATE status='failed', retry через час
```

## Realtime: интеграция WebSocket в SvelteKit

SvelteKit dev и prod используют разные сценарии:

- **Dev (vite)**: vite-plugin поднимает WS на том же порту, что и Vite. Используем `vite.config.ts → server.hmr` + кастомный плагин в `vite-plugin-ws.ts`.
- **Prod (adapter-node)**: кастомный `server.js` оборачивает SvelteKit handler и добавляет `WebSocketServer` на `upgrade` событие http.Server.

Подробнее — в [modules/realtime.md](modules/realtime.md).

## Нагрузка 1000 одновременных

| Ресурс | Оценка | Митигация |
|---|---|---|
| WS соединения | 1000 × ~30 KB RAM = 30 MB | один процесс Node справляется |
| INSERT в БД | пик 200/сек | батчинг в очереди (flush каждые 200 мс) |
| WS broadcast | top-50 слов × 1000 клиентов | throttle до 1 раз в 2-3 сек, шлём diff |
| Upload-канал | домашний интернет | если <10 Mbit — увеличить throttle до 5 сек |
| CPU | <30% одного ядра | профиль чистый |

## Деплой (этап 7)

`docker-compose.yml` (prod-вариант):

```
caddy        # 80/443, автоматический HTTPS
app          # Node (build)
postgres     # data volume
redis        # cache volume
```

DNS — `duckdns.org` (бесплатно). Бэкапы — `pg_dump` cron + опционально sync на B2.

## Что НЕ делать (anti-patterns под это ТЗ)

- ❌ Не использовать NextAuth/Auth0 — у респондентов нет регистрации.
- ❌ Не сохранять IP/fingerprint/UA — нарушает анонимность.
- ❌ Не INSERT каждый голос отдельной транзакцией — батчинг обязателен.
- ❌ Не генерировать PNG облака в браузере для email — серверный рендер.
- ❌ Не использовать managed cloud (Vercel, Render, Railway) — противоречит "домашний сервер" + "бесплатно".
