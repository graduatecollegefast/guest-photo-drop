// POST /.netlify/functions/dashboard-login  { slug, password }
// Each event has its own dashboard password (stored only as a scrypt hash on its record).
// A correct password sets an HttpOnly session cookie for that one event.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError } from '../lib/http.mjs';
import { verifyPassword, createSessionToken, sessionCookie } from '../lib/session.mjs';
import { findEventBySlug, effectiveStatus } from '../lib/events.mjs';
import { config } from '../lib/config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WRONG = [401, 'wrong_password', 'That password is not right. Please try again.'];

export default handler('dashboard-login', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID']);
  const { slug, password } = await readJson(req, 2000);

  let event;
  try {
    event = await findEventBySlug(slug, { fresh: true });
  } catch (err) {
    if (err.code === 'event_not_found') {
      await sleep(600);
      throw new HttpError(...WRONG); // don't reveal which events exist
    }
    throw err;
  }
  if (effectiveStatus(event) === 'draft') {
    throw new HttpError(403, 'not_paid', 'This event is not active yet. Finish checkout to open your dashboard.');
  }
  if (!verifyPassword(password, event.passwordHash)) {
    await sleep(600); // slows down guessing
    throw new HttpError(...WRONG);
  }

  const c = config().dashboard;
  const ttl = c.sessionDays * 86400;
  const token = createSessionToken({ sub: 'host', eventSlug: event.slug }, c.sessionSecret, ttl);
  return json({ ok: true, slug: event.slug }, 200, { 'Set-Cookie': sessionCookie(token, ttl) });
});
