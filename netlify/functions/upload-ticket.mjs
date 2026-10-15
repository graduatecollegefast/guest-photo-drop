// POST /.netlify/functions/upload-ticket
// { slug, sessionId, uploadId, name, type, size, kind: 'image'|'video' }
// Checks the event is open, the file type and size are allowed and the album has room,
// then returns short-lived links that let the browser put this one file (and its
// thumbnail) straight into the event's R2 folder. Nothing else can be written with them.

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError, SESSION_ID_RE, UPLOAD_ID_RE } from '../lib/http.mjs';
import { findEventBySlug, effectiveStatus, allowedFormats, storageInfo } from '../lib/events.mjs';
import { presign, originalKey, thumbKey } from '../lib/r2.mjs';
import { config, IMAGE_FORMATS, VIDEO_FORMATS, MIME, R2_KEYS } from '../lib/config.mjs';

const STATUS_ERRORS = {
  closed: [403, 'event_closed', 'Uploads for this event are now closed.'],
  expired: [403, 'event_expired', 'This gallery has expired.'],
  draft: [403, 'event_not_open', 'This event is not accepting photos yet.'],
};
const TYPE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v', 'video/3gpp': '3gp', 'video/webm': 'webm' };

// File extension we store the original under, from its name or MIME type.
export function extensionFor(name, type) {
  const fromName = String(name || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const ext = fromName ? fromName[1] : TYPE_EXT[String(type || '').toLowerCase()] || '';
  return ext === 'jpeg' ? 'jpg' : ext;
}

export default handler('upload-ticket', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', ...R2_KEYS]);
  const body = await readJson(req, 4000);
  if (!SESSION_ID_RE.test(body.sessionId || '')) throw new HttpError(400, 'bad_session', 'Please refresh the page and try again.');
  if (!UPLOAD_ID_RE.test(body.uploadId || '')) throw new HttpError(400, 'bad_upload', 'Please refresh the page and try again.');

  const event = await findEventBySlug(body.slug);
  const status = effectiveStatus(event);
  if (status !== 'active') throw new HttpError(...STATUS_ERRORS[status]);

  const kind = body.kind === 'video' ? 'video' : 'image';
  const ext = extensionFor(body.name, body.type);
  const allowed = allowedFormats(event);
  const okType = kind === 'video' ? VIDEO_FORMATS.includes(ext) : IMAGE_FORMATS.includes(ext);
  if (!okType || !allowed.includes(ext)) throw new HttpError(400, 'unsupported_file', 'This file type isn’t supported.');

  const size = Number(body.size);
  const { limits } = config();
  const maxBytes = (kind === 'video' ? limits.maxVideoMB : limits.maxImageMB) * 1024 * 1024;
  if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, 'bad_upload', 'This file looks empty.');
  if (size > maxBytes) throw new HttpError(413, 'too_large', 'This file is too large to upload.');

  // Plan storage cap (Party 5 GB, Wedding 25 GB, Forever 50 GB).
  const storage = storageInfo(event);
  if (storage.full || storage.usedBytes + size > storage.capBytes) {
    throw new HttpError(403, 'album_full', 'This album is full, so it can’t take more photos or videos. Please let the hosts know.');
  }

  const key = originalKey(event.eventId, body.uploadId, ext);
  const tKey = thumbKey(event.eventId, body.uploadId);
  return json({
    ok: true,
    ticket: {
      key,
      contentType: MIME[ext] || 'application/octet-stream',
      putUrl: await presign('PUT', key, 3600),
      thumbKey: tKey,
      thumbPutUrl: await presign('PUT', tKey, 3600),
      expiresAt: Date.now() + 55 * 60 * 1000,
    },
  });
});
