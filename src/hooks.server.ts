import type { Handle } from '@sveltejs/kit';
import { startExpiryCron } from '$lib/server/expiry/cron';
import { COOKIE_NAME, getSessionUser } from '$lib/server/auth/sessions';

const FLAG = '__tagcloud_cron_started';
const g = globalThis as unknown as Record<string, boolean>;
if (!g[FLAG]) {
  g[FLAG] = true;
  startExpiryCron();
}

export const handle: Handle = async ({ event, resolve }) => {
  const sid = event.cookies.get(COOKIE_NAME);
  event.locals.user = await getSessionUser(sid);
  return resolve(event);
};
