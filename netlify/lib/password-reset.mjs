// One-time password reset links. Only a SHA-256 of the token is stored on the event.

import crypto from 'node:crypto';
import { config } from './config.mjs';
import { updateRecord } from './airtable.mjs';
import { clearEventCache } from './events.mjs';

export const RESET_HOURS = 1; // link from "Forgot password"
export const ADMIN_RESET_HOURS = 24; // link sent from the admin page

export function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function issueResetLink(event, hours = RESET_HOURS) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  await updateRecord(config().airtable.eventsTable, event.recordId, {
    'Reset Token Hash': tokenHash(token),
    'Reset Token Expires': expires,
  });
  clearEventCache(event.slug);
  return `${config().siteUrl}/dashboard/${event.slug}?reset=${token}`;
}

export function resetTokenValid(event, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return false;
  if (!event.resetTokenHash || !event.resetTokenExpires) return false;
  if (new Date(event.resetTokenExpires).getTime() < now) return false;
  const a = Buffer.from(tokenHash(token));
  const b = Buffer.from(event.resetTokenHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
