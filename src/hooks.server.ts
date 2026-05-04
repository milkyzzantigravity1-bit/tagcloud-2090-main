import type { Handle } from '@sveltejs/kit';
import { startExpiryCron } from '$lib/server/expiry/cron';
import { COOKIE_NAME, getSessionUser } from '$lib/server/auth/sessions';
import { flushPending, pendingCount } from '$lib/server/voting/submit';

const STARTED_FLAG = '__tagcloud_server_started';
const g = globalThis as unknown as Record<string, boolean>;

if (!g[STARTED_FLAG]) {
  g[STARTED_FLAG] = true;
  startExpiryCron();

  // Graceful shutdown: дренируем in-memory очередь голосов перед завершением.
  // Регистрируем оба сигнала: SIGTERM (контейнер/k8s) и SIGINT (Ctrl+C).
  const shutdown = (signal: string) => {
    console.log(`[shutdown] received ${signal}, flushing ${pendingCount()} pending votes…`);
    flushPending()
      .catch((err) => console.error('[shutdown] flush error', err))
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

export const handle: Handle = async ({ event, resolve }) => {
  const sid = event.cookies.get(COOKIE_NAME);
  event.locals.user = await getSessionUser(sid);
  return resolve(event);
};
