// POST /.netlify/functions/update-event  { headline, welcomeMessage, colors }  (requires session)
// Lets the host edit what guests see. Changes show on the guest page within a minute.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError, cleanText, cleanMultiline } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug, clearEventCache } from '../lib/events.mjs';
import { updateRecord } from '../lib/airtable.mjs';
import { COLORS } from '../lib/plans.mjs';
import { config } from '../lib/config.mjs';

export function validateEdit(body) {
  const headline = cleanText(body.headline, 100);
  if (headline.length < 2) throw new HttpError(400, 'invalid_form', 'Please enter a headline.');
  const welcomeMessage = cleanMultiline(body.welcomeMessage, 500);
  const colors = Array.isArray(body.colors) ? [...new Set(body.colors.filter((c) => COLORS.includes(c)))] : [];
  if (colors.length < 2 || colors.length > 3) throw new HttpError(400, 'invalid_form', 'Please pick 2 or 3 colors.');
  return { headline, welcomeMessage, colors };
}

export default handler('update-event', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID']);
  const session = requireSession(req);
  const event = await findEventBySlug(session.eventSlug, { fresh: true });
  assertCurrentPassword(session, event);
  const edit = validateEdit(await readJson(req, 4000));
  await updateRecord(config().airtable.eventsTable, event.recordId, {
    Headline: edit.headline,
    'Welcome Message': edit.welcomeMessage,
    Colors: edit.colors,
  });
  clearEventCache(event.slug);
  return json({ ok: true, ...edit });
});
