# Этапы разработки

Каждый этап — отдельная сессия + минимум один коммит. Переход к следующему — только когда выполнены критерии готовности предыдущего.

## Этап 1: Скелет ✅

- [x] `docker-compose.yml`: Postgres 16 + Redis 7
- [x] SvelteKit 2 + TypeScript + Drizzle ORM
- [x] Схема БД (`surveys`, `questions`, `responses`)
- [x] Миграция 0000 применена
- [x] `/api/health` → 200 при работающих БД
- [x] Лого школы в шапке (`static/logo2090.png`)
- [x] Цветовая палитра (`src/lib/theme.ts`, CSS-переменные в `app.css`)
- [x] Git-репозиторий, push в `main`

**Критерий готовности:** `npm run dev` стартует, главная страница загружается, кнопка "Проверить healthcheck" возвращает зелёные db+redis.

## Этап 2: Создание опроса ✅

**Зависимости:** этап 1.

**Что сделано:**
- [x] Модуль [surveys](modules/surveys.md): create / get / codes / validation
- [x] Модуль [qr](modules/qr.md): генерация QR-PNG base64
- [x] POST `/api/surveys` (валидация → INSERT транзакция → генерация code → QR → response)
- [x] GET `/api/surveys/:code/public` (для респондента — без email и токена)
- [x] GET `/api/surveys/:code` (для создателя — с проверкой `creatorToken`)
- [x] Страница `/new` — форма создателя (с цветовой палитрой и preset сроками)
- [x] Страница `/s/[code]` — дашборд с code/link/QR + список вопросов + плейсхолдер облака
- [x] Страница `/r/[code]` — заглушка для респондента (поля ввода — этап 3)
- [x] `+error.svelte` — 404 страница
- [x] В БД: миграция 0001 добавила `creator_token` (UUID, default `gen_random_uuid()`)

**Критерии готовности — все выполнены:**
- [x] Создание опроса с 1 вопросом single → POST возвращает `{code, creatorToken, url, dashboardUrl, qrPngBase64, expiresAt}` (201)
- [x] Создание с 50 вопросами — 0.09 сек (требование ≤2 сек)
- [x] Открытие `/s/<code>?t=<creatorToken>` показывает QR и ссылку (200)
- [x] Открытие `/r/<code>` показывает список вопросов (200)
- [x] Открытие `/r/ZZZZZZ` (несуществующий) — 404 с человечной страницей через `+error.svelte`
- [x] Дополнительно: `/s/<code>` без токена → 401, с левым токеном → 404
- [x] Дополнительно: невалидный input → 400 с zod issues

## Этап 3: Голосование ✅

**Зависимости:** этап 2.

**Что сделано:**
- [x] Модуль [voting](modules/voting.md): submit / validate / rate-limit / validation
- [x] POST `/api/surveys/:code/answer` (rate-limit → zod → already-voted → бизнес-валидация → submit → markVoted)
- [x] Один POST принимает массив ответов на ВСЕ вопросы — иначе после первого ответа markVoted блокирует остальные
- [x] Батчинг: in-memory очередь, flush каждые 200 мс или по достижении 100 записей; параллельно `ZINCRBY cloud:<questionId>` в Redis pipeline
- [x] Rate-limit: Redis `rl:<sha256(ip+salt)>` INCR + EXPIRE 60s, max 30 запросов/мин. Соль ротируется ежедневно (`salt:YYYYMMDD`, TTL 48h).
- [x] Защита от двойного: Redis `voted:<hash>:<code>` TTL до `expiresAt` + localStorage `voted:<code>` на клиенте (best-effort)
- [x] Страница `/r/[code]`: поля ввода (single/multi), фильтрация пробелов на input + блок Space на keydown, динамический список для multi с кнопкой `+ слово`, confirmation-экраны (sent / already / closed)

**Критерии готовности — все выполнены:**
- [x] Отправка single без пробела → 201 + запись в `responses`
- [x] Single с пробелом из curl → 400 (`whitespace_in_word`)
- [x] Multi с 25 словами → 400 (zod limit max 20)
- [x] 31-й запрос с одного IP → 429 (Retry-After header)
- [x] Двойное голосование с того же IP → 409 (`already_voted`)
- [x] Двойное голосование с того же браузера → экран "Ты уже отвечал" (localStorage)
- [x] **Багфикс:** rate-limit перенесён ПЕРЕД zod-валидацией, иначе флуд невалидным мусором не лимитировался

## Этап 4: Realtime + облако ✅

**Зависимости:** этап 3.

**Что сделано:**
- [x] Модуль [realtime](modules/realtime.md): protocol / broadcast / ws-server
- [x] Модуль [cloud](modules/cloud.md): client utils (colorPicker, weightFactor, buildWordCloudOptions)
- [x] Native WebSocket через `ws` пакет + `vite-plugin-ws.ts` (Vite dev). Prod custom server.js — этап 7.
- [x] Endpoint `wss://host/ws/<code>?t=<creatorToken>` валидирует токен при upgrade.
- [x] WS-протокол: `snapshot` (полный топ-50). Throttle 2.5 сек. Шлётся только если изменился сериализованный топ.
- [x] Initial snapshot — сразу при подключении.
- [x] Реконнект клиента через 3 сек при разрыве.
- [x] Дашборд `/s/[code]`: live-облако через `wordcloud` npm пакет, селектор активного вопроса (если их >1), индикатор состояния WS, счётчик голосов.
- [x] Кнопка "Скачать PNG" — клиентская, через `canvas.toDataURL('image/png')`. (Серверный PNG для email — этап 5.)
- [x] Лог-шкала размеров: `baseSize * (1 + log2(count+1)/log2(max+1) * 3)` — топ-1 заметно крупнее остальных.
- [x] Цветовые схемы: `mono` (navy), `random` (3 фирменных цвета), `custom` (палитра из настроек опроса).
- [x] `rotateRatio: 0` — без поворотов (плохо читается кириллица под углом).
- [x] TS-check без ошибок (0 ERRORS, 3 ложно-положительных warning Svelte 5).

**Критерии готовности — все выполнены:**
- [x] Голос появляется в облаке за ≤5 сек: smoke-тест показал 2.6 сек (тикер 2.5 сек).
- [x] Все 3 цветовые схемы рендерятся (визуально проверяется в браузере).
- [x] Облако перестраивается при росте топа (отправка snapshot при изменении сериализованного топ-50).
- [x] БЕЗ числовых счётчиков рядом со словами (wordcloud сам не рисует, мы тоже не рисуем).
- [x] Размер шрифта — лог-шкала, заметная разница топ-1 и топ-10.
- [x] Кнопка "Скачать PNG" → клиентский canvas snapshot.

## Этап 5: Истечение + email ✅ (отправка проверится при рабочей сети)

**Зависимости:** этап 4.

**Что сделано:**
- [x] email/smtp.ts: lazy-init nodemailer transporter из env
- [x] email/templates.ts: HTML с inline-стилями (фирменный navy header) + plain text
- [x] email/send.ts: sendResultsEmail с PNG- и CSV-аттачами
- [x] cloud/aggregate.ts: SQL group by word_norm + слияние первой формы исходного слова
- [x] cloud/render-png.ts: node-canvas + d3-cloud (Node-friendly альтернатива wordcloud2)
- [x] export/csv.ts: UTF-8 BOM + escape (запятые/кавычки/переносы)
- [x] expiry/cron.ts: setInterval 60s, защита от двойного scan
- [x] expiry/process.ts: aggregate → renderPng per question → buildCsv → sendMail → status
- [x] hooks.server.ts: startExpiryCron при первом запросе, защита от HMR-двойного запуска
- [x] /api/surveys/[code]/export.csv: GET с creatorToken, Content-Disposition attachment
- [x] Дашборд: кнопки «Скачать PNG» (client) и «Скачать CSV» (server)
- [x] scripts/smtp-verify.mjs для отладки SMTP

**Критерии готовности:**
- [x] Опрос с прошедшим expires_at → cron обработал за 56 сек (требование ≤60 сек)
- [x] При SMTP-ошибке — `status='failed'`, в логе `[expiry] failed survey=<CODE>: <error>`
- [x] aggregateQuestion правильно слил `альфа×3, бета×2, гамма×1`
- [x] Ручной CSV-экспорт: HTTP 200, BOM, UTF-8 кириллица. Без токена → 401, с неверным → 403
- [⏳] Письмо пришло — нельзя проверить (Karing/V2BOX блокирует TLS до Yandex SMTP). Логически валидировано: ошибка падает на TLS-handshake → значит aggregate + renderPng + buildCsv ВСЕ отработали успешно. При рабочей сети `failed` станет `sent`.

**Известные ограничения (на этапы 6-7):**
- Auto-retry для failed-опросов не реализован. Manual: `UPDATE surveys SET status='active' WHERE status='failed';` — cron подхватит на следующем тике.

## Этап 6: Регистрация создателя ✅

**Зависимости:** этап 5.

**Что сделано:**
- [x] Миграция 0002: таблицы `users` (email, password_hash NULLABLE), `sessions` (id, user_id, expires_at), `surveys.user_id` (FK на users, NULLABLE для бэккомпата)
- [x] Backfill в той же миграции: для каждого distinct `creator_email` — INSERT user (password_hash=NULL, "не активирован") + UPDATE surveys.user_id
- [x] Модуль auth (см. [docs/modules/auth.md](modules/auth.md)): hash (bcrypt 11 rounds), sessions (cookie httpOnly+sameSite=lax, TTL 30 дней), validation (email + пароль 8-72 симв), service (register/login)
- [x] **Claim** существующих опросов: при регистрации с email, для которого уже есть user без пароля → UPDATE password_hash (активация), все его опросы автоматом видны
- [x] API: POST `/api/auth/{register,login,logout}`
- [x] hooks.server.ts: парсит cookie, заполняет `locals.user`
- [x] app.d.ts: `Locals.user` типы
- [x] Страницы: `/login`, `/register`, `/my` (список с status, count вопросов/голосов, кнопками)
- [x] `/new` теперь требует auth (redirect на /login?next=/new), email берётся из сессии (поле формы убрано)
- [x] `/s/[code]` поддерживает оба способа доступа: session (новый) или `?t=<token>` (бэккомпат)
- [x] Layout с шапкой: «Войти / Регистрация» когда не залогинен, «Мои опросы / email / Выйти» когда залогинен
- [x] POST `/api/surveys`: убрано поле `creatorEmail` из payload, берётся из `locals.user`

**Критерии готовности — все выполнены:**
- [x] `/new`, `/my` без сессии → 303 редирект на /login с next=
- [x] Регистрация существующего email (`maxud.nasibov@gmail.com`) → 201 + `claimedExisting: true`, на /my видны его 2 ранее созданных опроса
- [x] Регистрация уже-активированного email → 409 `email_taken`
- [x] Регистрация нового email → 201, /my пустой
- [x] Создание опроса БЕЗ email-поля (берётся из сессии) → 201
- [x] Создание без сессии → 401
- [x] Logout → 200, после этого защищённые роуты возвращают 303
- [x] Login → 200 + сессия восстанавливается
- [x] TS-check 0 ERRORS

## Этап 7: Брендирование (полировка)

**Зависимости:** этап 6.

**Что делаем:**
- Финальный UI-pass: типографика, отступы, кнопки, формы, error-states
- Favicon из лого
- OG-image для шары (`/r/<code>` → preview)
- Метатеги (description, theme-color)
- Адаптивная вёрстка (mobile-first)
- Empty states ("опрос не найден", "опрос завершён", "первый голос ещё не пришёл")
- Loading skeletons

**Критерий готовности:**
- Все страницы хорошо смотрятся на 360px и 1440px.
- Lighthouse Accessibility ≥ 90.
- При шаринге ссылки в Telegram/WhatsApp — preview с лого и заголовком.

## Этап 8: Деплой на домашний сервер

**Зависимости:** этап 7 + физический сервер.

**Что делаем:**
- `Dockerfile` для app (multi-stage build: SvelteKit build → Node runtime)
- Полный `docker-compose.prod.yml`: caddy + app + postgres + redis
- `Caddyfile` с auto-HTTPS
- DuckDNS для динамического DNS, либо Cloudflare Tunnel (если CGNAT)
- Бэкапы: cron `pg_dump` daily в `/backups`, ротация 14 дней
- Healthcheck в контейнере, restart policy
- README для развёртывания на сервере

**Критерий готовности:**
- На домашнем сервере один `docker compose up -d` поднимает всё.
- HTTPS работает через `2090cloud.duckdns.org` (или выбранное имя).
- После rebooot сервера всё поднимается само.
- Бэкап создаётся ежедневно, можно восстановить из него.
