# Модуль `realtime`

WebSocket-сервер для live-обновления облака на дашборде создателя.

## Папка

`src/lib/server/realtime/`

## Файлы

- `protocol.ts` — типы сообщений (server→client, client→server)
- `ws-server.ts` — поднятие `WebSocketServer` на http.Server
- `broadcast.ts` — тикер: каждые 2-3 сек собирает топ-N из Redis и шлёт diff подписанным клиентам

## Интеграция с SvelteKit

SvelteKit `adapter-node` отдаёт собранный handler как Express-style. WebSocket нужно навесить отдельно:

### Dev (Vite)

`vite.config.ts`:
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { wsPlugin } from './vite-plugin-ws';
export default { plugins: [sveltekit(), wsPlugin()] };
```

Плагин `vite-plugin-ws.ts` слушает `configureServer(server)` и навешивает `WebSocketServer({ noServer: true })` на `server.httpServer.on('upgrade', ...)`.

### Prod (custom server.js)

`server.js` (входная точка вместо `build/index.js`):
```ts
import { handler } from './build/handler.js';
import { createServer } from 'node:http';
import { initWebSocket } from './build/server/realtime/ws-server.js';

const server = createServer(handler);
initWebSocket(server);
server.listen(3000);
```

`package.json`: `"start": "node server.js"`.

## Протокол (protocol.ts)

```ts
export type ServerMsg =
  | { type: 'snapshot'; questionId: string; words: Array<[string, number]> }     // top 50
  | { type: 'delta'; questionId: string; updates: Array<[string, number]> }      // только изменения
  | { type: 'closed'; reason: 'expired' | 'sent' };

export type ClientMsg =
  | { type: 'subscribe'; questionIds: string[] }
  | { type: 'ping' };
```

URL: `wss://host/ws/<code>?t=<creatorToken>` (токен валидируется при upgrade).

## Broadcast (broadcast.ts)

```ts
// in-memory: { code: { ws: Set<WebSocket>, lastSent: Map<questionId, Map<word, count>> } }

// каждые 3 сек:
for (const code of activeRooms) {
  for (const questionId of room.questionIds) {
    const top = await redis.zrevrange(\`cloud:\${questionId}\`, 0, 49, 'WITHSCORES');
    const diff = computeDiff(room.lastSent[questionId], top);
    if (diff.length > 0) broadcastToRoom(code, { type: 'delta', questionId, updates: diff });
    room.lastSent[questionId] = top;
  }
}
```

При первом подключении — отправляется `snapshot` (полный топ-50).

## Зависимости

- `db` (валидация code и creatorToken при upgrade)
- `redis` (чтение `cloud:*` ZSET)

## Готчи

- НЕ создавать новый `Redis` клиент на каждое сообщение — использовать общий `redis` из `lib/server/redis.ts`.
- Throttle broadcast обязательно. Без него при 1000 клиентов и 200 голосах/сек сервер ляжет.
- При закрытии WS — удалять из `room.ws`. Если последний клиент ушёл — `activeRooms.delete(code)`.
- При истечении опроса — broadcast `{type: 'closed', reason: 'expired'}` и закрыть все коннекты этой комнаты.
- В dev режиме hot-reload Vite перезапускает WS — клиент должен переподключаться (с exponential backoff).
- НЕ использовать Socket.IO — он добавляет ~50 KB JS и polling-fallback, который нам не нужен.
- В Caddy явно проксировать `/ws/*` с `transport http { versions 1.1 }` — Caddy 2 по умолчанию пробует h2, что ломает WS upgrade.
