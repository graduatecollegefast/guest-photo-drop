// Attempt limits (for example 10 password tries per 15 minutes) kept in Netlify Blobs.
// If the store is unreachable the request is allowed, so an outage never locks hosts out.

import crypto from 'node:crypto';
import { blobStore } from './blobs.mjs';
import { HttpError } from './http.mjs';

export const LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  adminLogin: { limit: 10, windowMs: 15 * 60 * 1000 },
  forgot: { limit: 5, windowMs: 60 * 60 * 1000 },
  reset: { limit: 10, windowMs: 15 * 60 * 1000 },
};

const keyFor = (bucket, id) => crypto.createHash('sha256').update(`${bucket}:${id}`).digest('hex').slice(0, 48);

export function clientIp(req, context) {
  return (
    (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

// Counts one attempt. Throws 429 when the limit is already used up.
export async function takeAttempt(bucket, id) {
  const { limit, windowMs } = LIMITS[bucket];
  const store = blobStore('rate-limits');
  const key = keyFor(bucket, id);
  const now = Date.now();
  let rec = null;
  try {
    rec = await store.get(key, { type: 'json' });
  } catch (err) {
    console.warn(`[ratelimit] store unavailable: ${err.message}`);
    return;
  }
  if (!rec || now - rec.start > windowMs) rec = { start: now, count: 0 };
  if (rec.count >= limit) {
    const minutes = Math.max(1, Math.ceil((rec.start + windowMs - now) / 60000));
    throw new HttpError(429, 'too_many_attempts', `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`);
  }
  rec.count += 1;
  try {
    await store.setJSON(key, rec);
  } catch (err) {
    console.warn(`[ratelimit] could not save: ${err.message}`);
  }
}

export async function clearAttempts(bucket, id) {
  try {
    await blobStore('rate-limits').delete(keyFor(bucket, id));
  } catch {
    /* not important */
  }
}

// Returns true only for the first caller with this key (used so one payment is applied once).
export async function claimOnce(key) {
  const res = await blobStore('claims').setJSON(key, { at: new Date().toISOString() }, { onlyIfNew: true });
  return res.modified !== false;
}
