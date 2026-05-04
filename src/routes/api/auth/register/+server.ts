import { json } from '@sveltejs/kit';
import { CredentialsSchema } from '$lib/server/auth/validation';
import { register } from '$lib/server/auth/service';
import { COOKIE_NAME } from '$lib/server/auth/sessions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const raw = await request.json().catch(() => null);
  const parsed = CredentialsSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: { code: 'invalid_input', issues: parsed.error.issues } }, { status: 400 });
  }

  const result = await register(parsed.data);
  if (!result.ok) {
    return json({ error: { code: result.code, message: result.message } }, { status: 409 });
  }

  cookies.set(COOKIE_NAME, result.sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: result.expiresAt
  });

  return json({
    user: result.user,
    claimedExisting: result.claimedExisting
  }, { status: 201 });
};
