// Signed links for viewing and downloading stored photos and videos.

import { presign } from './r2.mjs';

const VIEW_SECONDS = 2 * 3600;

export function safeFilename(name, fallback) {
  const clean = String(name || '').replace(/[^\w.\- ]+/g, '').trim().slice(0, 120);
  return clean || fallback;
}

export async function mediaUrls({ key, thumbKey, type, format, filename }) {
  const original = await presign('GET', key, VIEW_SECONDS);
  const thumb = thumbKey ? await presign('GET', thumbKey, VIEW_SECONDS) : null;
  const name = safeFilename(filename, `${key.split('/').pop()}`);
  const ext = format && !name.toLowerCase().endsWith(`.${format}`) ? `.${format}` : '';
  const downloadUrl = await presign('GET', key, VIEW_SECONDS, {
    'response-content-disposition': `attachment; filename="${name}${ext}"`,
  });
  // Browsers can't show HEIC/HEIF, so those rely on the thumbnail made at upload time.
  const displayable = type === 'image' && !['heic', 'heif'].includes(format);
  if (type === 'video') {
    return { thumbUrl: thumb, posterUrl: thumb, displayUrl: original, originalUrl: original, downloadUrl };
  }
  return {
    thumbUrl: thumb || (displayable ? original : null),
    displayUrl: displayable ? original : thumb,
    originalUrl: original,
    downloadUrl,
  };
}
