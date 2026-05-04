import { createTransport, type Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';

let _transporter: Transporter | null = null;

export function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  _transporter = createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 465),
    secure: (env.SMTP_SECURE ?? 'true') !== 'false',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000
  });
  return _transporter;
}

export async function verifySmtp(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch (err) {
    console.error('[smtp] verify failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
