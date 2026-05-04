import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../schema';
import { hashPassword, verifyPassword } from './hash';
import { createSession, type AuthUser } from './sessions';
import type { Credentials } from './validation';

export type AuthResult =
  | { ok: true; user: AuthUser; sessionId: string; expiresAt: Date; claimedExisting: boolean }
  | { ok: false; code: 'email_taken' | 'invalid_credentials'; message: string };

/**
 * Регистрация. Особенность:
 * - Если user с этим email уже есть И password_hash NULL → "claim" (это inactive-user
 *   из backfill миграции — был создан под существующие опросы). Устанавливаем пароль,
 *   автоматически получаем все его опросы.
 * - Если user уже есть И password_hash NOT NULL → email_taken.
 * - Иначе создаём нового.
 */
export async function register(creds: Credentials): Promise<AuthResult> {
  const passwordHash = await hashPassword(creds.password);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, creds.email))
    .limit(1);

  let userId: string;
  let claimedExisting = false;

  if (existing) {
    if (existing.passwordHash !== null) {
      return { ok: false, code: 'email_taken', message: 'Email уже зарегистрирован' };
    }
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
    userId = existing.id;
    claimedExisting = true;
  } else {
    const [created] = await db
      .insert(users)
      .values({ email: creds.email, passwordHash })
      .returning({ id: users.id });
    userId = created.id;
  }

  const { id: sessionId, expiresAt } = await createSession(userId);
  return {
    ok: true,
    user: { id: userId, email: creds.email },
    sessionId,
    expiresAt,
    claimedExisting
  };
}

export async function login(creds: Credentials): Promise<AuthResult> {
  const [u] = await db.select().from(users).where(eq(users.email, creds.email)).limit(1);
  if (!u || !u.passwordHash) {
    return { ok: false, code: 'invalid_credentials', message: 'Неверный email или пароль' };
  }
  const ok = await verifyPassword(creds.password, u.passwordHash);
  if (!ok) {
    return { ok: false, code: 'invalid_credentials', message: 'Неверный email или пароль' };
  }
  const { id: sessionId, expiresAt } = await createSession(u.id);
  return {
    ok: true,
    user: { id: u.id, email: u.email },
    sessionId,
    expiresAt,
    claimedExisting: false
  };
}
