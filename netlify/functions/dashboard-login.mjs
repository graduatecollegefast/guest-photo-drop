// POST /.netlify/functions/dashboard-login  { slug, password }
// Each event has its own dashboard password (stored only as a scrypt hash on its record).
// A correct password sets an HttpOnly session cookie for that one event.
// Limited to 10 attempts per 15 minutes per device and event.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError } from '../lib/http.mjs';
import { verifyPassword, hostSessionCookie } from '../lib/session.mjs';
import { findEventBySlug, effectiveStatus } from '../lib/events.mjs';
import { takeAttempt, clearAttempts, clientIp } from '../lib/ratelimit.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WRONG = [401, 'wrong_password', 'That password is not right. Please try again.'];

export default handler('dashboard-login', async (req, context) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID']);
  const { slug, password } = await readJson(req, 2000);
  const attemptKey = `${clientIp(req, context)}|${String(slug).slice(0, 80)}`;
  await takeAttempt('login', attemptKey);

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

  await clearAttempts('login', attemptKey);
  return json({ ok: true, slug: event.slug }, 200, { 'Set-Cookie': hostSessionCookie(event) });
});
