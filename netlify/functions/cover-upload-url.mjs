// POST /.netlify/functions/cover-upload-url  (requires session)
// A short-lived link that lets the host put ONE photo of themselves (already resized to
// JPEG in the browser) into the event's cover folder. Guests never get this link.

import { handler, json, requireMethod, ensureConfigured } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug } from '../lib/events.mjs';
import { presign, newCoverKey } from '../lib/r2.mjs';
import { R2_KEYS } from '../lib/config.mjs';

export default handler('cover-upload-url', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', ...R2_KEYS]);
  const session = requireSession(req);
  const event = await findEventBySlug(session.eventSlug);
  assertCurrentPassword(session, event);
  const key = newCoverKey(event.eventId);
  return json({ ok: true, upload: { key, putUrl: await presign('PUT', key, 1800), contentType: 'image/jpeg' } });
});
