// Cloudflare R2 storage (S3-compatible). Files never pass through Netlify:
// the browser uploads and downloads with short-lived signed links made here.
// Keys:  events/<Event ID>/originals/<upload id>.<ext>
//        events/<Event ID>/thumbs/<upload id>.jpg
//        events/<Event ID>/cover/<random>.jpg

import crypto from 'node:crypto';
import { AwsClient } from 'aws4fetch';
import { config } from './config.mjs';

let cached = null;
function client() {
  const { accountId, accessKeyId, secretAccessKey, bucket } = config().r2;
  const sig = `${accountId}|${accessKeyId}|${bucket}`;
  if (!cached || cached.sig !== sig) {
    cached = {
      sig,
      aws: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
      base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
    };
  }
  return cached;
}

const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

export function objectUrl(key) {
  return `${client().base}/${encodeKey(key)}`;
}

// Signed link valid for `seconds` (max 7 days). Extra query params, e.g.
// { 'response-content-disposition': 'attachment; filename="x.jpg"' }.
export async function presign(method, key, seconds = 3600, query = {}) {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(Math.min(Math.max(60, seconds), 604800)));
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const signed = await client().aws.sign(url.toString(), { method, aws: { signQuery: true } });
  return signed.url;
}

async function send(url, init = {}) {
  return client().aws.fetch(url, init);
}

// Size in bytes if the object exists, otherwise null.
export async function headObject(key) {
  const res = await send(objectUrl(key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${res.status}`);
  return { size: Number(res.headers.get('content-length')) || 0, contentType: res.headers.get('content-type') || '' };
}

async function listKeys(prefix, token) {
  const url = new URL(`${client().base}`);
  url.searchParams.set('list-type', '2');
  url.searchParams.set('prefix', prefix);
  url.searchParams.set('max-keys', '1000');
  if (token) url.searchParams.set('continuation-token', token);
  const res = await send(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`R2 list ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const xml = await res.text();
  const keys = [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const next = (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1];
  return { keys, next: truncated ? next : null };
}

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function deleteKeys(keys) {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${keys
    .map((k) => `<Object><Key>${xmlEscape(k)}</Key></Object>`)
    .join('')}</Delete>`;
  const md5 = crypto.createHash('md5').update(body).digest('base64');
  const res = await send(`${client().base}?delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 },
    body,
  });
  if (!res.ok) throw new Error(`R2 delete ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Permanently deletes every object under an event's folder.
export async function deleteEventFiles(eventId) {
  if (!/^evt_[a-z0-9]{6,40}$/.test(eventId)) throw new Error(`refusing to delete files for unexpected event id "${eventId}"`);
  const prefix = `events/${eventId}/`;
  let deleted = 0;
  let token = null;
  for (let round = 0; round < 100; round++) {
    const page = await listKeys(prefix, token);
    if (page.keys.length) {
      await deleteKeys(page.keys);
      deleted += page.keys.length;
    }
    if (!page.next) break;
    token = page.next;
  }
  return { deleted };
}

// Permanently deletes specific objects, all of which must sit inside this event's folder.
export async function deleteEventObjects(eventId, keys) {
  const prefix = `events/${eventId}/`;
  const list = keys.filter(Boolean);
  if (!/^evt_[a-z0-9]{6,40}$/.test(eventId) || list.some((k) => !k.startsWith(prefix) || k.includes('..'))) {
    throw new Error('refusing to delete objects outside the event folder');
  }
  if (list.length) await deleteKeys(list);
  return { deleted: list.length };
}

export function eventPrefix(eventId) {
  return `events/${eventId}/`;
}
export function originalKey(eventId, uploadId, ext) {
  return `events/${eventId}/originals/${uploadId}.${ext}`;
}
export function thumbKey(eventId, uploadId) {
  return `events/${eventId}/thumbs/${uploadId}.jpg`;
}
export function newCoverKey(eventId) {
  return `events/${eventId}/cover/${crypto.randomUUID()}.jpg`;
}
