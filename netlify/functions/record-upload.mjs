// POST /.netlify/functions/record-upload
// { slug, sessionId, uploadId, guestName, originalFilename,
//   result: { key, thumbKey?, kind, width?, height?, duration? } }
// Confirms the file really is in this event's R2 folder, then creates exactly one
// Airtable Upload record for it. Safe to call repeatedly.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError, SESSION_ID_RE, UPLOAD_ID_RE, cleanText } from '../lib/http.mjs';
import { findEventBySlug, effectiveStatus } from '../lib/events.mjs';
import { headObject, thumbKey as thumbKeyFor } from '../lib/r2.mjs';
import { listRecords, createRecord, formulaString } from '../lib/airtable.mjs';
import { config, IMAGE_FORMATS, VIDEO_FORMATS, R2_KEYS } from '../lib/config.mjs';

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const invalid = (detail) => new HttpError(400, 'invalid_upload', 'We could not confirm this upload.', detail);

export default handler('record-upload', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'AIRTABLE_UPLOADS_TABLE_ID', ...R2_KEYS]);

  const body = await readJson(req);
  const r = body.result || {};
  if (!UPLOAD_ID_RE.test(body.uploadId || '')) throw invalid('bad upload id');
  const uploadId = body.uploadId;

  const event = await findEventBySlug(body.slug);
  // Accept late registrations for uploads that started before uploads were closed,
  // but never for draft or expired events.
  const status = effectiveStatus(event);
  if (status === 'draft' || status === 'expired') {
    throw new HttpError(403, 'event_not_open', 'This event is not accepting photos.');
  }

  // The key must be exactly the one this event's ticket hands out for this upload id.
  const m = typeof r.key === 'string' && r.key.match(/^events\/([^/]+)\/originals\/([A-Za-z0-9-]+)\.([a-z0-9]{2,5})$/);
  if (!m || m[1] !== event.eventId || m[2] !== uploadId) throw invalid(`key outside event folder: ${r.key}`);
  const format = m[3];
  const type = VIDEO_FORMATS.includes(format) ? 'video' : IMAGE_FORMATS.includes(format) ? 'image' : null;
  if (!type) throw new HttpError(400, 'unsupported_file', 'This file type is not supported.', format);

  // Idempotency: one record per upload id.
  const { uploadsTable } = config().airtable;
  const existing = await listRecords(uploadsTable, {
    filterByFormula: `{Upload ID} = ${formulaString(uploadId)}`,
    fields: ['Upload ID'],
    maxRecords: 1,
    pageSize: 1,
  });
  if (existing.records.length) return json({ ok: true, uploadId, duplicate: true });

  // The file must really be in storage; its size comes from storage, not the browser.
  const head = await headObject(r.key);
  if (!head || !head.size) throw invalid(`missing object ${r.key}`);
  let tKey;
  if (r.thumbKey) {
    if (r.thumbKey !== thumbKeyFor(event.eventId, uploadId)) throw invalid(`bad thumb key ${r.thumbKey}`);
    tKey = (await headObject(r.thumbKey)) ? r.thumbKey : undefined;
  }

  const sessionId = SESSION_ID_RE.test(body.sessionId || '') ? body.sessionId : '';
  const fields = {
    'Upload ID': uploadId,
    Event: [event.recordId],
    'Event Key': event.eventId,
    'Guest Name': cleanText(body.guestName, 80) || undefined,
    'Storage Asset ID': uploadId,
    'Storage Key': r.key,
    'Thumb Key': tKey,
    'Resource Type': type,
    Format: format,
    'Original Filename': cleanText(body.originalFilename || '', 200) || undefined,
    'File Size': head.size,
    Width: numberOrNull(r.width) || undefined,
    Height: numberOrNull(r.height) || undefined,
    Duration: type === 'video' ? numberOrNull(r.duration) || undefined : undefined,
    Status: 'Active',
    'Uploaded At': new Date().toISOString(),
    'Upload Session ID': sessionId || undefined,
    'User Agent': cleanText(req.headers.get('user-agent') || '', 300) || undefined,
  };
  for (const k of Object.keys(fields)) if (fields[k] === undefined || fields[k] === null) delete fields[k];

  await createRecord(uploadsTable, fields);
  return json({ ok: true, uploadId, duplicate: false });
});
