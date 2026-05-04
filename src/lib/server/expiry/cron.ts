import { and, eq, lt, or } from 'drizzle-orm';
import { db } from '../db';
import { surveys } from '../schema';
import { processExpired } from './process';

const TICK_MS = 60_000;
const BATCH = 20;
// Recovery: добиваем survey, который застрял в 'expired' (процесс упал
// между atomic UPDATE active→expired и финальным sent/failed)
const STUCK_EXPIRED_THRESHOLD_MS = 5 * 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let scanning = false;

async function scan(): Promise<void> {
  if (scanning) return;
  scanning = true;
  try {
    const now = new Date();
    const stuckThreshold = new Date(now.getTime() - STUCK_EXPIRED_THRESHOLD_MS);

    const candidates = await db
      .select()
      .from(surveys)
      .where(
        or(
          // обычная истечение
          and(eq(surveys.status, 'active'), lt(surveys.expiresAt, now)),
          // recovery застрявших expired (старше 5 мин)
          and(eq(surveys.status, 'expired'), lt(surveys.expiresAt, stuckThreshold))
        )
      )
      .limit(BATCH);

    if (candidates.length === 0) return;
    console.log(`[cron] found ${candidates.length} surveys to process`);
    for (const s of candidates) {
      await processExpired(s);
    }
  } catch (err) {
    console.error('[cron] scan failed:', err instanceof Error ? err.message : err);
  } finally {
    scanning = false;
  }
}

export function startExpiryCron(): void {
  if (timer) return;
  console.log('[cron] expiry scanner started (60s tick)');
  timer = setInterval(() => void scan(), TICK_MS);
  void scan();
}

export function stopExpiryCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
