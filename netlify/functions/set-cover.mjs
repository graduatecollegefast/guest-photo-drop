// POST /.netlify/functions/set-cover  (requires session)
// { key }          -> sets the host's photo (must be in this event's cover folder and exist)
// { remove: true } -> removes it from the page
import { handler, json, requireMethod, readJson, ensureConfigured, HttpError } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug, clearEventCache, coverUrl } from '../lib/events.mjs';
import { headObject } from '../lib/r2.mjs';
import { updateRecord } from '../lib/airtable.mjs';
import { config, R2_KEYS } from '../lib/config.mjs';

export default handler('set-cover', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', ...R2_KEYS]);
  const session = requireSession(req);
  const body = await readJson(req, 4000);
  const event = await findEventBySlug(session.eventSlug, { fresh: true });
  assertCurrentPassword(session, event);
  const { eventsTable } = config().airtable;

  if (body.remove === true) {
    await updateRecord(eventsTable, event.recordId, { 'Cover Image Key': '', 'Cover Image URL': null });
    clearEventCache(event.slug);
    return json({ ok: true, coverImageUrl: '' });
  }

  const key = typeof body.key === 'string' ? body.key : '';
  const prefix = `events/${event.eventId}/cover/`;
  if (!key.startsWith(prefix) || !/^[a-f0-9-]{36}\.jpg$/.test(key.slice(prefix.length))) {
    throw new HttpError(400, 'invalid_upload', 'We could not confirm this photo. Please try again.', `bad cover key ${key}`);
  }
  if (!(await headObject(key))) {
    throw new HttpError(400, 'invalid_upload', 'We could not confirm this photo. Please try again.', `cover not in storage ${key}`);
  }
  await updateRecord(eventsTable, event.recordId, { 'Cover Image Key': key, 'Cover Image URL': null });
  clearEventCache(event.slug);
  return json({ ok: true, coverImageUrl: await coverUrl({ coverImageKey: key }) });
});
