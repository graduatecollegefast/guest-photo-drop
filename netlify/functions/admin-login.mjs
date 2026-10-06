// POST /.netlify/functions/admin-login  { password }
// Owner-only admin page. The password lives only in the ADMIN_PASSWORD environment variable.
// Limited to 10 attempts per 15 minutes per device.

import crypto from 'node:crypto';
import { handler, json, requireMethod, readJson, ensureConfigured, HttpError } from '../lib/http.mjs';
import { adminSessionCookie } from '../lib/session.mjs';
import { takeAttempt, clearAttempts, clientIp } from '../lib/ratelimit.mjs';

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

export default handler('admin-login', async (req, context) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'ADMIN_PASSWORD']);
  const ip = clientIp(req, context);
  await takeAttempt('adminLogin', ip);
  const { password } = await readJson(req, 1000);
  const given = typeof password === 'string' ? password.trim() : '';
  if (!given || !crypto.timingSafeEqual(digest(given), digest(process.env.ADMIN_PASSWORD.trim()))) {
    await new Promise((r) => setTimeout(r, 600));
    throw new HttpError(401, 'wrong_password', 'That password is not right.');
  }
  await clearAttempts('adminLogin', ip);
  return json({ ok: true }, 200, { 'Set-Cookie': adminSessionCookie() });
});
