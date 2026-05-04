import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

const url = env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const queryClient = postgres(url, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 5,
  onnotice: () => {}
});

export const db = drizzle(queryClient, { schema });
export { schema };

export async function pingDb(): Promise<boolean> {
  try {
    await queryClient`select 1`;
    return true;
  } catch {
    return false;
  }
}
