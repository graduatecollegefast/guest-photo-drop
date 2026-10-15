// GET /.netlify/functions/dashboard-media?status=Active|Hidden&type=image|video&cursor=...
// One page (50 items) of media at a time, newest first, with short-lived signed links
// for the thumbnail, the full file and a download.

import { handler, json, requireMethod, ensureConfigured, HttpError } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug } from '../lib/events.mjs';
import { listRecords, formulaString } from '../lib/airtable.mjs';
import { mediaUrls } from '../lib/media.mjs';
import { config, R2_KEYS } from '../lib/config.mjs';

const PAGE_SIZE = 50;
const FIELDS = [
  'Upload ID', 'Guest Name', 'Storage Key', 'Thumb Key', 'Resource Type', 'Format',
  'Original Filename', 'File Size', 'Width', 'Height', 'Duration', 'Status', 'Uploaded At',
];

export default handler('dashboard-media', async (req) => {
  requireMethod(req, 'GET');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_UPLOADS_TABLE_ID', ...R2_KEYS]);
  const session = requireSession(req);
  const event = await findEventBySlug(session.eventSlug);
  assertCurrentPassword(session, event);
  if (event.filesDeletedOn) return json({ ok: true, items: [], nextCursor: null, deleted: true });

  const q = new URL(req.url).searchParams;
  const status = q.get('status') === 'Hidden' ? 'Hidden' : 'Active';
  const type = ['image', 'video'].includes(q.get('type')) ? q.get('type') : null;
  const cursor = q.get('cursor') || undefined;
  if (cursor && !/^[A-Za-z0-9/._-]{1,200}$/.test(cursor)) throw new HttpError(400, 'bad_cursor', 'Please reload the gallery.');

  const clauses = [`{Event Key} = ${formulaString(event.eventId)}`, `{Status} = ${formulaString(status)}`];
  if (type) clauses.push(`{Resource Type} = ${formulaString(type)}`);

  let page;
  try {
    page = await listRecords(config().airtable.uploadsTable, {
      filterByFormula: `AND(${clauses.join(', ')})`,
      fields: FIELDS,
      sort: [{ field: 'Uploaded At', direction: 'desc' }],
      pageSize: PAGE_SIZE,
      offset: cursor,
    });
  } catch (err) {
    // Airtable offsets expire; tell the client to start over instead of failing hard.
    if (cursor && String(err.detail || '').includes('LIST_RECORDS_ITERATOR_NOT_AVAILABLE')) {
      throw new HttpError(409, 'cursor_expired', 'The gallery was refreshed. Please reload.');
    }
    throw err;
  }

  const items = await Promise.all(
    page.records
      .filter((rec) => rec.fields['Storage Key'])
      .map(async (rec) => {
        const f = rec.fields;
        const type = f['Resource Type'] === 'video' ? 'video' : 'image';
        const format = f['Format'] || (type === 'video' ? 'mp4' : 'jpg');
        return {
          id: f['Upload ID'],
          type,
          format,
          status: f['Status'],
          guestName: f['Guest Name'] || '',
          originalFilename: f['Original Filename'] || '',
          bytes: f['File Size'] || null,
          width: f['Width'] || null,
          height: f['Height'] || null,
          duration: f['Duration'] || null,
          uploadedAt: f['Uploaded At'] || null,
          ...(await mediaUrls({ key: f['Storage Key'], thumbKey: f['Thumb Key'], type, format, filename: f['Original Filename'] })),
        };
      })
  );

  return json({ ok: true, items, nextCursor: page.offset || null });
});
