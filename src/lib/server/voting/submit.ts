import { db } from '../db';
import { responses } from '../schema';
import { redis } from '../redis';
import type { ProcessedAnswer } from './validate';

type QueueItem = {
  questionId: string;
  word: string;
  wordNorm: string;
};

const FLUSH_INTERVAL_MS = 200;
const FLUSH_THRESHOLD = 100;

const buffer: QueueItem[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing = false;

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer.splice(0, buffer.length);
  try {
    await db.insert(responses).values(batch);
    const pipeline = redis.pipeline();
    for (const item of batch) {
      pipeline.zincrby(`cloud:${item.questionId}`, 1, item.wordNorm);
    }
    await pipeline.exec();
  } catch (err) {
    // Возвращаем неотданный пакет в начало буфера, чтобы повторить попытку
    // на следующем тике — иначе голоса терялись бы при первой ошибке БД/Redis.
    buffer.unshift(...batch);
    console.error('[voting/submit] flush failed, requeued batch', err);
  } finally {
    flushing = false;
  }
}

function scheduleFlush(): void {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    await flush();
    if (buffer.length > 0) scheduleFlush();
  }, FLUSH_INTERVAL_MS);
}

export async function submitAnswers(processed: ProcessedAnswer[]): Promise<void> {
  for (const answer of processed) {
    for (let i = 0; i < answer.words.length; i++) {
      buffer.push({
        questionId: answer.questionId,
        word: answer.words[i],
        wordNorm: answer.normalized[i]
      });
    }
  }
  if (buffer.length >= FLUSH_THRESHOLD) {
    await flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Дренирует in-memory очередь. Используется обработчиком сигналов
 * остановки процесса в `hooks.server.ts`, чтобы не терять голоса при
 * graceful shutdown (SIGTERM/SIGINT).
 */
export async function flushPending(): Promise<void> {
  // Несколько попыток на случай, если первая упадёт и положит batch обратно.
  for (let i = 0; i < 3 && buffer.length > 0; i++) {
    await flush();
  }
}

export function pendingCount(): number {
  return buffer.length;
}
