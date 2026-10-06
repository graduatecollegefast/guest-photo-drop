// POST /.netlify/functions/reset-password  { slug, token, password }
// Sets a new dashboard password from a reset link, signs out every other device,
// and signs this browser in.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError, cleanText } from '../lib/http.mjs';
import { findEventBySlug, clearEventCache } from '../lib/events.mjs';
import { hashPassword, hostSessionCookie } from '../lib/session.mjs';
import { takeAttempt, clientIp } from '../lib/ratelimit.mjs';
import { resetTokenValid } from '../lib/password-reset.mjs';
import { updateRecord } from '../lib/airtable.mjs';
import { config } from '../lib/config.mjs';

const BAD_LINK = [400, 'bad_reset_link', 'This reset link has expired or was already used. Please ask for a new one.'];

export default handler('reset-password', async (req, context) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID']);
  const body = await readJson(req, 2000);
  const slug = cleanText(body.slug, 80);
  await takeAttempt('reset', `${clientIp(req, context)}|${slug}`);

  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'invalid_form', 'Your new password needs at least 8 characters.');
  }
  let event;
  try {
    event = await findEventBySlug(slug, { fresh: true });
  } catch (err) {
    if (err.code === 'event_not_found') throw new HttpError(...BAD_LINK);
    throw err;
  }
  if (!resetTokenValid(event, body.token)) throw new HttpError(...BAD_LINK);

  const passwordHash = hashPassword(password);
  await updateRecord(config().airtable.eventsTable, event.recordId, {
    'Dashboard Password Hash': passwordHash,
    'Reset Token Hash': '',
    'Reset Token Expires': null,
  });
  clearEventCache(event.slug);
  return json({ ok: true, slug: event.slug }, 200, { 'Set-Cookie': hostSessionCookie({ ...event, passwordHash }) });
});
