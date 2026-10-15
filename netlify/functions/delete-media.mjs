// POST /.netlify/functions/delete-media  { uploadId }
// Permanently deletes one photo or video (original and preview) from storage.
// The Upload record stays as Status = Deleted with File Size 0, so the album's storage is freed.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug } from '../lib/events.mjs';
import { listRecords, updateRecord, formulaString } from '../lib/airtable.mjs';
import { deleteEventObjects } from '../lib/r2.mjs';
import { config, R2_KEYS } from '../lib/config.mjs';

export default handler('delete-media', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_UPLOADS_TABLE_ID', ...R2_KEYS]);
  const session = requireSession(req);
  const { uploadId } = await readJson(req, 2000);
  if (typeof uploadId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(uploadId)) {
    throw new HttpError(400, 'bad_request', 'Please reload and try again.');
  }
  const event = await findEventBySlug(session.eventSlug);
  assertCurrentPassword(session, event);
  const { uploadsTable } = config().airtable;

  const found = await listRecords(uploadsTable, {
    filterByFormula: `AND({Upload ID} = ${formulaString(uploadId)}, {Event Key} = ${formulaString(event.eventId)})`,
    fields: ['Status', 'Storage Key', 'Thumb Key'],
    maxRecords: 1,
    pageSize: 1,
  });
  const record = found.records[0];
  if (!record) throw new HttpError(404, 'not_found', 'That photo could not be found.');
  if (record.fields.Status === 'Deleted') return json({ ok: true, uploadId, status: 'Deleted' });

  await deleteEventObjects(event.eventId, [record.fields['Storage Key'], record.fields['Thumb Key']]);
  await updateRecord(uploadsTable, record.id, { Status: 'Deleted', 'File Size': 0, 'Thumb Key': '' });
  return json({ ok: true, uploadId, status: 'Deleted' });
});
