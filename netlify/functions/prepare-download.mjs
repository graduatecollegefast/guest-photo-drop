// POST /.netlify/functions/prepare-download  (requires session)
// Lists every visible (Active) photo and video with a signed link, plus a file name.
// The browser fetches them straight from storage and builds the ZIP files itself,
// so no media passes through Netlify.

import { handler, json, requireMethod, ensureConfigured } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug } from '../lib/events.mjs';
import { listAll, formulaString } from '../lib/airtable.mjs';
import { presign } from '../lib/r2.mjs';
import { safeFilename } from '../lib/media.mjs';
import { config, R2_KEYS } from '../lib/config.mjs';

export default handler('prepare-download', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_UPLOADS_TABLE_ID', ...R2_KEYS]);
  const session = requireSession(req);
  const event = await findEventBySlug(session.eventSlug);
  assertCurrentPassword(session, event);

  const records = await listAll(config().airtable.uploadsTable, {
    filterByFormula: `AND({Event Key} = ${formulaString(event.eventId)}, {Status} = 'Active')`,
    fields: ['Storage Key', 'Resource Type', 'Format', 'Guest Name', 'File Size', 'Uploaded At'],
    sort: [{ field: 'Uploaded At', direction: 'asc' }],
  });

  const counters = { image: 0, video: 0 };
  const files = [];
  for (const rec of records) {
    const f = rec.fields;
    if (!f['Storage Key']) continue;
    const type = f['Resource Type'] === 'video' ? 'video' : 'image';
    counters[type] += 1;
    const n = String(counters[type]).padStart(4, '0');
    const who = safeFilename(f['Guest Name'], '').replace(/\s+/g, '-');
    const ext = f['Format'] || f['Storage Key'].split('.').pop();
    files.push({
      type,
      name: `${type === 'video' ? 'videos' : 'photos'}/${n}${who ? `-${who}` : ''}.${ext}`,
      bytes: Number(f['File Size']) || 0,
      url: await presign('GET', f['Storage Key'], 6 * 3600),
    });
  }

  return json({
    ok: true,
    name: event.slug,
    totals: { photos: counters.image, videos: counters.video },
    expiresInMinutes: 6 * 60 - 5,
    files,
  });
});
