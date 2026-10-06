// Server-side tests. Airtable is replaced by an in-memory fake so these run offline:
//   npm test

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.AIRTABLE_ACCESS_TOKEN = 'test-token';
process.env.AIRTABLE_BASE_ID = 'appTEST';
process.env.AIRTABLE_EVENTS_TABLE_ID = 'tblEvents';
process.env.AIRTABLE_UPLOADS_TABLE_ID = 'tblUploads';
process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
process.env.CLOUDINARY_API_KEY = '123456';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.SESSION_SECRET = 'session-secret-for-tests-only';
process.env.AIRTABLE_CUSTOMERS_TABLE_ID = 'tblCustomers';
process.env.AIRTABLE_ORDERS_TABLE_ID = 'tblOrders';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.SITE_URL = 'https://guestphotodrop.test';
process.env.AIRTABLE_PARTNERS_TABLE_ID = 'tblPartners';
process.env.ADMIN_PASSWORD = 'owner admin pass';

const { signParams, verifyUploadResponse, archiveDownloadUrl } = await import('../netlify/lib/cloudinary.mjs');
const { hashPassword, verifyPassword, createSessionToken, verifySessionToken } = await import('../netlify/lib/session.mjs');
const { effectiveStatus, addDays } = await import('../netlify/lib/events.mjs');
const TEST_HASH = hashPassword('correct horse battery');

const getEvent = (await import('../netlify/functions/get-event.mjs')).default;
const uploadSignature = (await import('../netlify/functions/upload-signature.mjs')).default;
const recordUpload = (await import('../netlify/functions/record-upload.mjs')).default;
const login = (await import('../netlify/functions/dashboard-login.mjs')).default;
const dashboardEvent = (await import('../netlify/functions/dashboard-event.mjs')).default;
const dashboardMedia = (await import('../netlify/functions/dashboard-media.mjs')).default;
const hideMedia = (await import('../netlify/functions/hide-media.mjs')).default;
const prepareDownload = (await import('../netlify/functions/prepare-download.mjs')).default;
const coverSignature = (await import('../netlify/functions/cover-signature.mjs')).default;
const setCover = (await import('../netlify/functions/set-cover.mjs')).default;

// ---------- Fake Airtable ----------
const db = { tblEvents: [], tblUploads: [], tblCustomers: [], tblOrders: [], tblPartners: [] };
const sentEmails = [];
const cloudinaryDeletes = [];
const stripe = { sessions: {}, created: 0 };
let airtableDown = false;
let created = 0;

function evalFormula(formula, fields) {
  // Supports the formulas this app uses: {Field} = 'value', LOWER({Field}) = 'value', AND(...), OR(...)
  const eq = [...formula.matchAll(/(LOWER\()?\{([^}]+)\}\)? = '((?:[^'\\]|\\.)*)'/g)].map((m) => [m[2], m[3].replace(/\\'/g, "'"), Boolean(m[1])]);
  const results = eq.map(([f, v, lower]) => (lower ? String(fields[f] ?? '').toLowerCase() : String(fields[f] ?? '')) === v);
  if (formula.startsWith('OR(')) return results.some(Boolean);
  return results.every(Boolean);
}

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname === 'api.stripe.com') return fakeStripe(u, opts);
  if (u.hostname === 'api.resend.com') {
    sentEmails.push(JSON.parse(opts.body));
    return Response.json({ id: `email_${sentEmails.length}` });
  }
  if (u.hostname === 'api.cloudinary.com' && opts.method === 'DELETE') {
    cloudinaryDeletes.push({ path: u.pathname, prefix: u.searchParams.get('prefix') });
    return Response.json({ deleted: { a: 'deleted' }, partial: false });
  }
  if (u.hostname !== 'api.airtable.com') throw new Error(`unexpected fetch ${url}`);
  if (airtableDown) return new Response('down', { status: 503 });
  const [, , , tableRaw, recId] = u.pathname.split('/');
  const table = decodeURIComponent(tableRaw);
  const rows = db[table];
  if (opts.method === 'POST') {
    const body = JSON.parse(opts.body);
    const recs = body.records.map((r) => ({ id: `rec${++created}`, fields: r.fields }));
    rows.push(...recs);
    return Response.json({ records: recs });
  }
  if (opts.method === 'PATCH') {
    const row = rows.find((r) => r.id === recId);
    Object.assign(row.fields, JSON.parse(opts.body).fields);
    return Response.json(row);
  }
  const formula = u.searchParams.get('filterByFormula');
  let found = formula ? rows.filter((r) => evalFormula(formula, r.fields)) : rows;
  const pageSize = Number(u.searchParams.get('pageSize') || 100);
  const offset = Number(u.searchParams.get('offset') || 0);
  const page = found.slice(offset, offset + pageSize);
  const next = offset + pageSize < found.length ? String(offset + pageSize) : undefined;
  return Response.json({ records: page, offset: next });
};

function fakeStripe(u, opts) {
  const auth = (opts.headers || {}).Authorization;
  assert.equal(auth, 'Bearer sk_test_fake');
  if (opts.method === 'POST' && u.pathname === '/v1/checkout/sessions') {
    const form = new URLSearchParams(opts.body);
    const id = `cs_test_${String(++stripe.created).padStart(12, '0')}`;
    stripe.sessions[id] = {
      id,
      url: `https://checkout.stripe.test/${id}`,
      payment_status: 'unpaid',
      amount_total: Number(form.get('line_items[0][price_data][unit_amount]')),
      customer: 'cus_test_1',
      metadata: Object.fromEntries(['event_id', 'event_slug', 'plan', 'kind'].filter((k) => form.get(`metadata[${k}]`)).map((k) => [k, form.get(`metadata[${k}]`)])),
      form,
    };
    return Promise.resolve(Response.json(stripe.sessions[id]));
  }
  const m = u.pathname.match(/^\/v1\/checkout\/sessions\/(.+)$/);
  if (m && stripe.sessions[m[1]]) return Promise.resolve(Response.json(stripe.sessions[m[1]]));
  return Promise.resolve(Response.json({ error: { message: 'not found' } }, { status: 404 }));
}

function seedEvent(slug, overrides = {}) {
  db.tblEvents.push({
    id: `recEvt${slug}`,
    fields: {
      'Event ID': `evt-${slug}`,
      'Event Name': 'Jordan & Taylor',
      'Event Slug': slug,
      'Event Type': 'Wedding',
      Plan: 'Wedding Drop',
      'Event Date': '2026-10-17',
      'Uploads Close Date': '2099-01-15',
      'Hosting End Date': '2099-01-15',
      'Dashboard Password Hash': TEST_HASH,
      Status: 'Active',
      'Allow Photos': true,
      'Allow Videos': true,
      'Maximum Files Per Upload': 50,
      'Photo Count': 3,
      'Video Count': 1,
      'Hidden Count': 1,
      'Contributor Count': 2,
      ...overrides,
    },
  });
}

function cloudinaryResult(slug, overrides = {}) {
  const public_id = `events/evt-${slug}/originals/abc123`;
  const version = 1760000000;
  return {
    asset_id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    public_id,
    version,
    signature: signParams({ public_id, version }),
    resource_type: 'image',
    format: 'jpg',
    bytes: 2048000,
    width: 4032,
    height: 3024,
    secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v${version}/${public_id}.jpg`,
    original_filename: 'IMG_2031',
    ...overrides,
  };
}

const req = (url, init = {}) => new Request(`https://site.test/.netlify/functions/${url}`, init);
const post = (url, body, headers = {}) =>
  req(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

const { resetMemoryStore } = await import('../netlify/lib/blobs.mjs');
beforeEach(() => {
  airtableDown = false;
  resetMemoryStore();
});

// ---------- Unit tests ----------
test('Cloudinary signature matches the documented example', () => {
  const sig = signParams(
    { eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 },
    'abcd'
  );
  assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('upload response verification rejects tampering', () => {
  const r = cloudinaryResult('x');
  assert.equal(verifyUploadResponse(r), true);
  assert.equal(verifyUploadResponse({ ...r, public_id: 'other/folder/abc' }), false);
  assert.equal(verifyUploadResponse({ ...r, signature: 'deadbeef' }), false);
});

test('archive link is signed and lists each file', () => {
  const url = new URL(archiveDownloadUrl({ resourceType: 'image', publicIds: ['a/1', 'a/2'], name: 'x-photos-1' }));
  assert.equal(url.pathname, '/v1_1/demo-cloud/image/generate_archive');
  assert.deepEqual(url.searchParams.getAll('public_ids[]'), ['a/1', 'a/2']);
  assert.ok(url.searchParams.get('signature'));
  assert.equal(url.searchParams.get('api_key'), '123456');
  assert.ok(!url.toString().includes('test-secret'));
});

test('passwords hash and verify', () => {
  const h = hashPassword('a long password');
  assert.ok(h.startsWith('scrypt:'));
  assert.ok(!h.includes('$'));
  assert.equal(verifyPassword(' a long password ', h), true);
  assert.equal(verifyPassword('a long password', h.replace(/:/g, '$')), true);
  assert.equal(verifyPassword('a long password', h), true);
  assert.equal(verifyPassword('wrong password', h), false);
});

test('session tokens reject tampering and expiry', () => {
  const t = createSessionToken({ sub: 'couple', eventSlug: 'x' });
  assert.equal(verifySessionToken(t).eventSlug, 'x');
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'couple', eventSlug: 'other', exp: 9999999999 })).toString('base64url');
  assert.equal(verifySessionToken(`${forged}.${sig}`), null);
  assert.equal(verifySessionToken(createSessionToken({ sub: 'c' }, undefined, -10)), null);
  assert.equal(verifySessionToken(`${body}.${sig}x`), null);
});

test('status follows plan dates: uploads close, then hosting ends', () => {
  assert.equal(addDays('2026-10-17', 90), '2027-01-15');
  const ev = { rawStatus: 'Active', uploadsCloseDate: '2027-01-15', hostingEndDate: '2027-07-15' };
  assert.equal(effectiveStatus(ev, new Date('2027-01-15T18:00:00Z')), 'active');
  assert.equal(effectiveStatus(ev, new Date('2027-01-16T18:00:00Z')), 'closed');
  assert.equal(effectiveStatus(ev, new Date('2027-07-16T18:00:00Z')), 'expired');
  assert.equal(effectiveStatus({ rawStatus: 'Closed', hostingEndDate: '2099-01-01' }), 'closed');
  assert.equal(effectiveStatus({ rawStatus: 'Draft', hostingEndDate: '2099-01-01' }), 'draft');
});

// ---------- Endpoint tests ----------
test('get-event returns only public fields', async () => {
  seedEvent('pub-event');
  const res = await getEvent(req('get-event?slug=pub-event'));
  assert.equal(res.status, 200);
  const { event } = await res.json();
  assert.equal(event.name, 'Jordan & Taylor');
  assert.equal(event.status, 'active');
  assert.equal(event.recordId, undefined);
  assert.equal(event.eventId, undefined);
  assert.equal(event.counts, undefined);
  assert.ok(!JSON.stringify(event).includes('recEvt'));
});

test('get-event: invalid and unknown slugs return 404', async () => {
  assert.equal((await getEvent(req("get-event?slug=bad'slug"))).status, 404);
  assert.equal((await getEvent(req('get-event?slug=nope'))).status, 404);
});

test('get-event: draft events reveal nothing', async () => {
  seedEvent('draft-event', { Status: 'Draft' });
  const { event } = await (await getEvent(req('get-event?slug=draft-event'))).json();
  assert.deepEqual(event, { slug: 'draft-event', status: 'draft' });
});

test('upload-signature: active event gets a scoped signature without the secret', async () => {
  seedEvent('sig-event', { 'Allow Videos': false });
  const res = await uploadSignature(post('upload-signature', { slug: 'sig-event', sessionId: 'session-1234' }));
  assert.equal(res.status, 200);
  const { upload } = await res.json();
  assert.equal(upload.params.folder, 'events/evt-sig-event/originals');
  assert.equal(upload.params.allowed_formats, 'jpg,jpeg,png,webp,heic,heif');
  assert.equal(upload.signature, signParams(upload.params));
  assert.ok(!JSON.stringify(upload).includes('test-secret'));
});

test('upload-signature: closed, expired and draft events are refused server-side', async () => {
  seedEvent('closed-event', { Status: 'Closed' });
  seedEvent('expired-event', { 'Hosting End Date': '2020-01-01' });
  seedEvent('draft2-event', { Status: 'Draft' });
  for (const [slug, code] of [['closed-event', 'event_closed'], ['expired-event', 'event_expired'], ['draft2-event', 'event_not_open']]) {
    const res = await uploadSignature(post('upload-signature', { slug, sessionId: 'session-1234' }));
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, code);
  }
});

test('record-upload creates exactly one record and is idempotent', async () => {
  seedEvent('rec-event');
  const before = db.tblUploads.length;
  const body = { slug: 'rec-event', sessionId: 'session-1234', uploadId: 'upload-0001', guestName: '  Tanya  ', result: cloudinaryResult('rec-event') };
  const r1 = await (await recordUpload(post('record-upload', body))).json();
  assert.equal(r1.ok, true);
  assert.equal(r1.duplicate, false);
  const r2 = await (await recordUpload(post('record-upload', body))).json();
  assert.equal(r2.duplicate, true);
  // Same asset, different client upload id: still no duplicate.
  const r3 = await (await recordUpload(post('record-upload', { ...body, uploadId: 'upload-0002' }))).json();
  assert.equal(r3.duplicate, true);
  assert.equal(db.tblUploads.length, before + 1);
  const row = db.tblUploads.at(-1).fields;
  assert.equal(row['Guest Name'], 'Tanya');
  assert.equal(row['Event Key'], 'evt-rec-event');
  assert.deepEqual(row.Event, ['recEvtrec-event']);
  assert.equal(row.Status, 'Active');
});

test('record-upload rejects forged or foreign uploads', async () => {
  seedEvent('forge-event');
  const forged = cloudinaryResult('forge-event', { signature: 'f'.repeat(40) });
  let res = await recordUpload(post('record-upload', { slug: 'forge-event', result: forged }));
  assert.equal(res.status, 400);
  // Valid Cloudinary signature but stored under another event's folder.
  const other = cloudinaryResult('someone-else');
  res = await recordUpload(post('record-upload', { slug: 'forge-event', result: other }));
  assert.equal(res.status, 400);
});

test('Airtable outage returns a friendly error, not a stack trace', async () => {
  seedEvent('down-event');
  await getEvent(req('get-event?slug=down-event')); // warm cache
  airtableDown = true;
  const res = await recordUpload(post('record-upload', { slug: 'down-event', uploadId: 'upload-0099', result: cloudinaryResult('down-event', { asset_id: 'ffffffffffffffffffffffffffffffff' }) }));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, 'database_error');
  assert.ok(!/airtable|stack/i.test(body.message));
});

test('dashboard: each event has its own password; right one sets HttpOnly cookie', async () => {
  seedEvent('login-event');
  seedEvent('other-event', { 'Dashboard Password Hash': hashPassword('a different password') });
  seedEvent('unpaid-event', { Status: 'Draft' });
  assert.equal((await login(post('dashboard-login', { slug: 'login-event', password: 'nope nope nope' }))).status, 401);
  assert.equal((await login(post('dashboard-login', { slug: 'other-event', password: 'correct horse battery' }))).status, 401);
  assert.equal((await login(post('dashboard-login', { slug: 'no-such-event', password: 'correct horse battery' }))).status, 401);
  assert.equal((await login(post('dashboard-login', { slug: 'unpaid-event', password: 'correct horse battery' }))).status, 403);
  const good = await login(post('dashboard-login', { slug: 'login-event', password: 'correct horse battery' }));
  assert.equal(good.status, 200);
  const cookie = good.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const token = cookie.match(/wp_session=([^;]+)/)[1];
  assert.equal(verifySessionToken(token).eventSlug, 'login-event');
  // A session for one event can't open another event's dashboard.
  const other = await dashboardEvent(req('dashboard-event?slug=other-event', { headers: { cookie: `wp_session=${token}` } }));
  assert.equal(other.status, 401);
});

test('dashboard endpoints require a session', async () => {
  assert.equal((await dashboardEvent(req('dashboard-event'))).status, 401);
  assert.equal((await dashboardMedia(req('dashboard-media'))).status, 401);
  assert.equal((await hideMedia(post('hide-media', { uploadId: 'upload-0001' }))).status, 401);
  assert.equal((await prepareDownload(post('prepare-download', {}))).status, 401);
});

test('dashboard: counts, paginated media, hide, and download links', async () => {
  seedEvent('jordan-and-taylor');
  const cookie = `wp_session=${createSessionToken({ sub: 'couple', eventSlug: 'jordan-and-taylor' })}`;
  for (let i = 0; i < 60; i++) {
    db.tblUploads.push({
      id: `recU${i}`,
      fields: {
        'Upload ID': `dash-upload-${String(i).padStart(4, '0')}`,
        'Event Key': 'evt-jordan-and-taylor',
        'Storage Key': `events/evt-jordan-and-taylor/originals/p${i}`,
        'Resource Type': i % 10 === 0 ? 'video' : 'image',
        Format: i % 10 === 0 ? 'mov' : 'heic',
        Version: 1,
        Status: 'Active',
        'Uploaded At': new Date(Date.now() - i * 1000).toISOString(),
      },
    });
  }
  const ev = await (await dashboardEvent(req('dashboard-event', { headers: { cookie } }))).json();
  assert.deepEqual(ev.event.counts, { media: 4, photos: 3, videos: 1, hidden: 1, contributors: 2 });

  const p1 = await (await dashboardMedia(req('dashboard-media', { headers: { cookie } }))).json();
  assert.equal(p1.items.length, 50);
  assert.ok(p1.nextCursor);
  const p2 = await (await dashboardMedia(req(`dashboard-media?cursor=${p1.nextCursor}`, { headers: { cookie } }))).json();
  assert.equal(p2.items.length, 10);
  assert.equal(p2.nextCursor, null);

  const img = p1.items.find((i) => i.type === 'image');
  assert.match(img.thumbUrl, /c_limit,w_600,q_auto,f_auto/);
  assert.match(img.downloadUrl, /fl_attachment/);
  assert.match(img.downloadUrl, /\.heic$/);

  const h = await hideMedia(post('hide-media', { uploadId: img.id }, { cookie }));
  assert.equal(h.status, 200);
  const stillVisible = await (await dashboardMedia(req('dashboard-media?status=Active', { headers: { cookie } }))).json();
  assert.ok(!stillVisible.items.some((i) => i.id === img.id));
  const hidden = await (await dashboardMedia(req('dashboard-media?status=Hidden', { headers: { cookie } }))).json();
  assert.equal(hidden.items[0].id, img.id);

  const dl = await (await prepareDownload(post('prepare-download', {}, { cookie }))).json();
  assert.equal(dl.totals.photos, 53); // 54 photos minus the hidden one
  assert.equal(dl.totals.videos, 6);
  assert.equal(dl.parts.filter((p) => p.type === 'image').length, 2);
});

test('couple photo: signed into the cover folder, saved as a display URL, removable', async () => {
  seedEvent('cover-event');
  const cookie = `wp_session=${createSessionToken({ sub: 'couple', eventSlug: 'cover-event' })}`;
  assert.equal((await coverSignature(post('cover-signature', {}))).status, 401);

  const sig = await (await coverSignature(post('cover-signature', {}, { cookie }))).json();
  assert.equal(sig.upload.params.folder, 'events/evt-cover-event/cover');
  assert.match(sig.upload.url, /\/image\/upload$/);
  assert.equal(sig.upload.signature, signParams(sig.upload.params));

  const public_id = 'events/evt-cover-event/cover/us';
  const version = 1760000001;
  const good = { public_id, version, signature: signParams({ public_id, version }), resource_type: 'image', format: 'jpg' };
  const res = await (await setCover(post('set-cover', { result: good }, { cookie }))).json();
  assert.match(res.coverImageUrl, /c_fill,g_auto,w_1200,h_900,q_auto,f_auto\/v1760000001\/events\/evt-cover-event\/cover\/us$/);
  const ev = db.tblEvents.find((e) => e.fields['Event Slug'] === 'cover-event');
  assert.equal(ev.fields['Cover Image URL'], res.coverImageUrl);
  const pub = await (await getEvent(req('get-event?slug=cover-event'))).json();
  assert.equal(pub.event.coverImageUrl, res.coverImageUrl);

  // A guest upload (originals folder) can't be used as the cover.
  const guestPid = 'events/evt-cover-event/originals/x';
  const bad = { public_id: guestPid, version, signature: signParams({ public_id: guestPid, version }), resource_type: 'image' };
  assert.equal((await setCover(post('set-cover', { result: bad }, { cookie }))).status, 400);

  const removed = await (await setCover(post('set-cover', { remove: true }, { cookie }))).json();
  assert.equal(removed.coverImageUrl, '');
  assert.equal(ev.fields['Cover Image URL'], null);
});

// ---------- Signup and checkout ----------
const createCheckout = (await import('../netlify/functions/create-checkout.mjs')).default;
const checkoutStatus = (await import('../netlify/functions/checkout-status.mjs')).default;
const stripeWebhook = (await import('../netlify/functions/stripe-webhook.mjs')).default;
const { slugify } = await import('../netlify/lib/orders.mjs');
const { planDates, addMonths } = await import('../netlify/lib/plans.mjs');
const crypto = await import('node:crypto');

const signup = (over = {}) => ({
  plan: 'wedding', eventType: 'Wedding', eventName: 'Ava & Noah', eventDate: '2027-06-12',
  headline: '', colors: ['Sage', 'White', 'Gold'], icon: 'Rings', email: 'Ava@Example.com', password: 'our secret pw', agreeTerms: true, ...over,
});

test('slugs and plan dates', () => {
  assert.equal(slugify('Shaun & Shatoya'), 'shaun-and-shatoya');
  assert.equal(slugify("Maya’s 30th!"), 'mayas-30th');
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  assert.deepEqual(planDates({ uploadMonths: 12, hostingMonths: 24 }, '2027-06-12', '2026-10-06'), { uploadsCloseDate: '2028-06-12', hostingEndDate: '2029-06-12' });
  // Event already happened: dates count from today.
  assert.deepEqual(planDates({ uploadMonths: 3, hostingMonths: 6 }, '2026-01-01', '2026-10-06'), { uploadsCloseDate: '2027-01-06', hostingEndDate: '2027-04-06' });
});

test('create-checkout validates input and never trusts a client price', async () => {
  const bad = async (over) => (await createCheckout(post('create-checkout', signup(over)))).json();
  assert.equal((await bad({ plan: 'free' })).error, 'invalid_form');
  assert.equal((await bad({ email: 'nope' })).error, 'invalid_form');
  assert.equal((await bad({ password: 'short' })).error, 'invalid_form');
  assert.equal((await bad({ eventDate: '1999-01-01' })).error, 'invalid_form');
  assert.equal((await bad({ plan: 'party', eventType: 'Wedding' })).error, 'invalid_form');
  assert.equal((await bad({ colors: ['Sage'] })).error, 'invalid_form');
  assert.equal((await bad({ colors: ['Sage', 'Gold', 'Navy', 'Blush'] })).error, 'invalid_form');
  assert.equal((await bad({ colors: ['Sage', 'Neon'] })).error, 'invalid_form');
  assert.equal((await bad({ agreeTerms: false })).error, 'invalid_form');

  const before = stripe.created;
  const res = await (await createCheckout(post('create-checkout', signup({ priceCents: 1, amount: 1 })))).json();
  assert.equal(res.ok, true);
  assert.match(res.url, /^https:\/\/checkout\.stripe\.test\/cs_test_/);
  assert.equal(stripe.created, before + 1);
  const session = Object.values(stripe.sessions).at(-1);
  assert.equal(session.form.get('line_items[0][price_data][unit_amount]'), '7900');
  assert.equal(session.form.get('success_url'), 'https://guestphotodrop.test/welcome?session_id={CHECKOUT_SESSION_ID}');

  const ev = db.tblEvents.find((e) => e.fields['Event Slug'] === 'ava-and-noah');
  assert.ok(ev, 'draft event created');
  assert.equal(ev.fields.Status, 'Draft');
  assert.deepEqual(ev.fields.Colors, ['Sage', 'White', 'Gold']);
  assert.equal(ev.fields.Icon, 'Rings');
  assert.equal(ev.fields['Owner Email'], 'ava@example.com');
  assert.equal(ev.fields['Stripe Session ID'], session.id);
  assert.ok(ev.fields['Dashboard Password Hash'].startsWith('scrypt:'));
  assert.ok(!JSON.stringify(ev.fields).includes('our secret pw'));
  assert.equal(ev.fields.Headline, 'Help us remember the day through your eyes.');
  assert.equal(db.tblCustomers.filter((c) => c.fields.Email === 'ava@example.com').length, 1);

  // Same names again get a different link; same email reuses the customer.
  await createCheckout(post('create-checkout', signup()));
  const twins = db.tblEvents.filter((e) => String(e.fields['Event Slug']).startsWith('ava-and-noah'));
  assert.equal(twins.length, 2);
  assert.notEqual(twins[0].fields['Event Slug'], twins[1].fields['Event Slug']);
  assert.equal(db.tblCustomers.filter((c) => c.fields.Email === 'ava@example.com').length, 1);

  // Draft (unpaid) page shows nothing yet.
  const pub = await (await getEvent(req('get-event?slug=ava-and-noah'))).json();
  assert.deepEqual(pub.event, { slug: 'ava-and-noah', status: 'draft' });
});

test('payment switches the event on exactly once (welcome page and webhook)', async () => {
  await createCheckout(post('create-checkout', signup({ eventName: 'Mia & Leo', plan: 'forever' })));
  const session = Object.values(stripe.sessions).at(-1);
  const ev = () => db.tblEvents.find((e) => e.fields['Event Slug'] === 'mia-and-leo');

  // Not paid yet.
  let st = await (await checkoutStatus(req(`checkout-status?session_id=${session.id}`))).json();
  assert.equal(st.paid, false);
  assert.equal(ev().fields.Status, 'Draft');

  session.payment_status = 'paid';
  st = await (await checkoutStatus(req(`checkout-status?session_id=${session.id}`))).json();
  assert.equal(st.paid, true);
  assert.equal(st.slug, 'mia-and-leo');
  assert.equal(ev().fields.Status, 'Active');
  assert.equal(ev().fields['Uploads Close Date'], '2028-06-12');
  assert.equal(ev().fields['Hosting End Date'], '2029-06-12');

  // Webhook arrives too: valid signature, no second order.
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: session } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex');
  const hook = await stripeWebhook(new Request('https://x/.netlify/functions/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body }));
  assert.equal(hook.status, 200);
  const orders = db.tblOrders.filter((o) => o.fields['Stripe Payment ID'] === session.id);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].fields.Amount, 149);
  assert.equal(orders[0].fields.Product, 'Forever Keepsake');

  // Forged webhook is rejected.
  const forged = await stripeWebhook(new Request('https://x/.netlify/functions/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${'0'.repeat(64)}` }, body }));
  assert.equal(forged.status, 400);

  // The new event's own password now opens its dashboard.
  const ok = await login(post('dashboard-login', { slug: 'mia-and-leo', password: 'our secret pw' }));
  assert.equal(ok.status, 200);
});

// ---------- Limits, password reset, editing, extensions, referrals, retention, admin ----------
const forgotPassword = (await import('../netlify/functions/forgot-password.mjs')).default;
const resetPassword = (await import('../netlify/functions/reset-password.mjs')).default;
const updateEvent = (await import('../netlify/functions/update-event.mjs')).default;
const createExtension = (await import('../netlify/functions/create-extension-checkout.mjs')).default;
const adminLogin = (await import('../netlify/functions/admin-login.mjs')).default;
const adminData = (await import('../netlify/functions/admin-data.mjs')).default;
const adminAction = (await import('../netlify/functions/admin-action.mjs')).default;
const { retentionAction, runRetention } = await import('../netlify/lib/retention.mjs');
const { passwordVersion } = await import('../netlify/lib/session.mjs');
const { normalize } = await import('../netlify/lib/events.mjs');

const evRow = (slug) => db.tblEvents.find((e) => e.fields['Event Slug'] === slug);
const cookieFrom = (res, name = 'wp_session') => `${name}=${res.headers.get('set-cookie').match(new RegExp(`${name}=([^;]+)`))[1]}`;
const hostCookie = (slug, hash = TEST_HASH) => `wp_session=${createSessionToken({ sub: 'host', eventSlug: slug, pv: passwordVersion(hash) })}`;
function webhookReq(session) {
  const body = JSON.stringify({ id: `evt_${session.id}`, type: 'checkout.session.completed', data: { object: session } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex');
  return new Request('https://x/.netlify/functions/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body });
}

test('login: 10 attempts per 15 minutes, then locked even with the right password', async () => {
  seedEvent('limit-event');
  for (let i = 0; i < 10; i++) {
    assert.equal((await login(post('dashboard-login', { slug: 'limit-event', password: `wrong ${i}` }))).status, 401);
  }
  const locked = await login(post('dashboard-login', { slug: 'limit-event', password: 'correct horse battery' }));
  assert.equal(locked.status, 429);
  assert.equal((await locked.json()).error, 'too_many_attempts');
  // Another device (IP) is not affected.
  const other = await login(post('dashboard-login', { slug: 'limit-event', password: 'correct horse battery' }, { 'x-nf-client-connection-ip': '203.0.113.9' }));
  assert.equal(other.status, 200);
});

test('storage cap: a full album refuses new uploads; others get the space left', async () => {
  seedEvent('full-party', { Plan: 'Party Drop', 'Storage Bytes': 5 * 1024 ** 3 });
  seedEvent('roomy-party', { Plan: 'Party Drop', 'Storage Bytes': 1024 ** 3 });
  const full = await uploadSignature(post('upload-signature', { slug: 'full-party', sessionId: 'session-1234' }));
  assert.equal(full.status, 403);
  assert.equal((await full.json()).error, 'album_full');
  const ok = await (await uploadSignature(post('upload-signature', { slug: 'roomy-party', sessionId: 'session-1234' }))).json();
  assert.equal(ok.upload.remainingBytes, 4 * 1024 ** 3);
});

test('forgot password emails a one-time link; reset signs out old sessions', async () => {
  process.env.RESEND_API_KEY = 're_test';
  seedEvent('reset-event', { 'Owner Email': 'host@example.com' });
  const oldCookie = hostCookie('reset-event');
  assert.equal((await dashboardEvent(req('dashboard-event', { headers: { cookie: oldCookie } }))).status, 200);

  sentEmails.length = 0;
  const wrong = await (await forgotPassword(post('forgot-password', { slug: 'reset-event', email: 'someone@else.com' }))).json();
  assert.equal(wrong.ok, true);
  assert.equal(sentEmails.length, 0);
  const right = await (await forgotPassword(post('forgot-password', { slug: 'reset-event', email: 'HOST@example.com' }))).json();
  assert.equal(right.message, wrong.message, 'same reply either way');
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(sentEmails[0].to, ['host@example.com']);
  const token = sentEmails[0].text.match(/\?reset=([A-Za-z0-9_-]+)/)[1];
  assert.ok(!JSON.stringify(evRow('reset-event').fields).includes(token), 'token itself is never stored');

  assert.equal((await resetPassword(post('reset-password', { slug: 'reset-event', token: 'x'.repeat(43), password: 'brand new pass' }))).status, 400);
  assert.equal((await resetPassword(post('reset-password', { slug: 'reset-event', token, password: 'short' }))).status, 400);
  const done = await resetPassword(post('reset-password', { slug: 'reset-event', token, password: 'brand new pass' }));
  assert.equal(done.status, 200);
  const newCookie = cookieFrom(done);
  assert.equal((await dashboardEvent(req('dashboard-event', { headers: { cookie: newCookie } }))).status, 200);
  assert.equal((await dashboardEvent(req('dashboard-event', { headers: { cookie: oldCookie } }))).status, 401, 'old device signed out');
  assert.equal((await resetPassword(post('reset-password', { slug: 'reset-event', token, password: 'another pass 1' }))).status, 400, 'link works once');
  assert.equal((await login(post('dashboard-login', { slug: 'reset-event', password: 'brand new pass' }))).status, 200);
  delete process.env.RESEND_API_KEY;
});

test('edit event: headline, welcome message and 2-3 colors', async () => {
  seedEvent('edit-event');
  const cookie = hostCookie('edit-event');
  const bad = await updateEvent(post('update-event', { headline: 'Hi there', colors: ['Sage'] }, { cookie }));
  assert.equal(bad.status, 400);
  const res = await updateEvent(post('update-event', { headline: '  New headline ', welcomeMessage: 'Line one\n\n\n\nLine two', colors: ['Navy', 'Gold', 'Navy'] }, { cookie }));
  assert.equal(res.status, 200);
  const f = evRow('edit-event').fields;
  assert.equal(f.Headline, 'New headline');
  assert.equal(f['Welcome Message'], 'Line one\n\nLine two');
  assert.deepEqual(f.Colors, ['Navy', 'Gold']);
  assert.equal((await updateEvent(post('update-event', { headline: 'x y', colors: ['Navy', 'Gold'] }))).status, 401);
});

test('extend hosting: $19 checkout adds 12 months exactly once', async () => {
  seedEvent('extend-event', { 'Hosting End Date': '2099-03-31', 'Deletion Notice 30 Sent': '2099-03-31' });
  const cookie = hostCookie('extend-event');
  const res = await (await createExtension(post('create-extension-checkout', {}, { cookie }))).json();
  assert.equal(res.ok, true);
  const session = Object.values(stripe.sessions).at(-1);
  assert.equal(session.form.get('line_items[0][price_data][unit_amount]'), '1900');
  assert.equal(session.metadata.kind, 'extension');
  assert.equal(session.form.get('success_url'), 'https://guestphotodrop.test/dashboard/extend-event?extended={CHECKOUT_SESSION_ID}');

  // Unpaid: nothing changes.
  await checkoutStatus(req(`checkout-status?session_id=${session.id}`));
  assert.equal(evRow('extend-event').fields['Hosting End Date'], '2099-03-31');

  session.payment_status = 'paid';
  const st = await (await checkoutStatus(req(`checkout-status?session_id=${session.id}`))).json();
  assert.equal(st.kind, 'extension');
  assert.equal((await stripeWebhook(webhookReq(session))).status, 200);
  await checkoutStatus(req(`checkout-status?session_id=${session.id}`));
  const f = evRow('extend-event').fields;
  assert.equal(f['Hosting End Date'], '2100-03-31');
  assert.equal(f['Deletion Notice 30 Sent'], null, 'warnings reset for the new date');
  const orders = db.tblOrders.filter((o) => o.fields['Stripe Payment ID'] === session.id);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].fields.Product, 'Extend Hosting');
  assert.equal(orders[0].fields.Amount, 19);

  seedEvent('gone-event', { 'Files Deleted On': '2026-01-01' });
  assert.equal((await createExtension(post('create-extension-checkout', {}, { cookie: hostCookie('gone-event') }))).status, 409);
});

test('referrals: active partner code is attached to the event and its order', async () => {
  db.tblPartners.push({ id: 'recPartner1', fields: { 'Partner Name': 'Bloom Planning', 'Ref Code': 'bloom-planning', Active: true } });
  db.tblPartners.push({ id: 'recPartner2', fields: { 'Partner Name': 'Old Venue', 'Ref Code': 'old-venue', Active: false } });
  await createCheckout(post('create-checkout', signup({ eventName: 'Zoe & Ike', ref: 'Bloom-Planning' })));
  const session = Object.values(stripe.sessions).at(-1);
  assert.equal(evRow('zoe-and-ike').fields['Referral Code'], 'bloom-planning');
  session.payment_status = 'paid';
  await checkoutStatus(req(`checkout-status?session_id=${session.id}`));
  const order = db.tblOrders.find((o) => o.fields['Stripe Payment ID'] === session.id);
  assert.deepEqual(order.fields.Partner, ['recPartner1']);
  assert.equal(order.fields['Referral Code'], 'bloom-planning');

  await createCheckout(post('create-checkout', signup({ eventName: 'Kai & Bo', ref: 'old-venue' })));
  assert.equal(evRow('kai-and-bo').fields['Referral Code'], undefined, 'inactive partner ignored');
  await createCheckout(post('create-checkout', signup({ eventName: 'Lu & Max', ref: '<script>' })));
  assert.equal(evRow('lu-and-max').fields['Referral Code'], undefined);
});

test('retention rules: 30-day and 7-day warnings, deletion only after the 7-day warning', () => {
  const base = { rawStatus: 'Active', hostingEndDate: '2027-01-31', ownerEmail: 'h@example.com', notice30Sent: null, notice7Sent: null, filesDeletedOn: null };
  // Files are deleted 2027-03-02 (30 days after hosting ends).
  assert.equal(retentionAction(base, '2027-01-30', true), null);
  assert.deepEqual(retentionAction(base, '2027-01-31', true), { type: 'notice', days: 30, deleteOn: '2027-03-02' });
  assert.equal(retentionAction({ ...base, notice30Sent: '2027-01-31' }, '2027-02-20', true), null);
  assert.equal(retentionAction({ ...base, notice30Sent: '2027-01-31' }, '2027-02-23', true).days, 7);
  assert.equal(retentionAction({ ...base, notice30Sent: '2027-01-31' }, '2027-02-23', false).type, 'blocked');
  // Late 7-day warning pushes deletion back so the host always gets 7 days.
  const warnedLate = { ...base, notice30Sent: '2027-01-31', notice7Sent: '2027-03-01' };
  assert.equal(retentionAction(warnedLate, '2027-03-02', true), null);
  assert.equal(retentionAction(warnedLate, '2027-03-08', true).type, 'delete');
  assert.equal(retentionAction({ ...warnedLate, filesDeletedOn: '2027-03-08' }, '2027-04-01', true), null);
  assert.equal(retentionAction({ ...base, rawStatus: 'Draft' }, '2030-01-01', true), null);
});

test('daily job: emails, then deletes only that event folder', async () => {
  process.env.RESEND_API_KEY = 're_test';
  db.tblEvents.length = 0;
  seedEvent('old-party', { 'Event ID': 'evt_abc123def456', 'Hosting End Date': '2027-01-31', 'Owner Email': 'old@example.com', 'Cover Image URL': 'https://res.cloudinary.com/x.jpg' });
  sentEmails.length = 0;
  cloudinaryDeletes.length = 0;
  const at = (d) => new Date(`${d}T18:00:00Z`);

  let sum = await runRetention({ now: at('2027-02-01') });
  assert.equal(sum.notices, 1);
  assert.match(sentEmails[0].subject, /deleted in 29 days/);
  assert.equal(evRow('old-party').fields['Deletion Notice 30 Sent'], '2027-02-01');
  sum = await runRetention({ now: at('2027-02-02') });
  assert.equal(sum.notices, 0, 'no repeat emails');
  await runRetention({ now: at('2027-02-24') });
  assert.equal(evRow('old-party').fields['Deletion Notice 7 Sent'], '2027-02-24');
  assert.equal(cloudinaryDeletes.length, 0);

  sum = await runRetention({ now: at('2027-03-03') });
  assert.equal(sum.deleted, 1);
  assert.deepEqual([...new Set(cloudinaryDeletes.map((d) => d.prefix))], ['events/evt_abc123def456/']);
  const f = evRow('old-party').fields;
  assert.equal(f['Files Deleted On'], '2027-03-03');
  assert.equal(f.Status, 'Expired');
  assert.equal(f['Cover Image URL'], null);
  assert.equal(sentEmails.length, 2);

  // Without email set up, warnings can't go out, so nothing gets deleted.
  delete process.env.RESEND_API_KEY;
  seedEvent('no-mail', { 'Event ID': 'evt_zzz999yyy888', 'Hosting End Date': '2027-01-31', 'Owner Email': 'x@example.com' });
  sum = await runRetention({ now: at('2027-06-01') });
  assert.equal(sum.blocked, 1);
  assert.equal(evRow('no-mail').fields['Files Deleted On'], undefined);
});

test('admin: own password, separate cookie, events with revenue and storage, actions', async () => {
  db.tblEvents.length = 0;
  db.tblOrders.length = 0;
  seedEvent('admin-a', { 'Owner Email': 'a@example.com', 'Storage Bytes': 1024 ** 3 });
  seedEvent('admin-draft', { Status: 'Draft' });
  db.tblOrders.push({ id: 'recO1', fields: { Event: ['recEvtadmin-a'], Amount: 79, Status: 'Paid' } });
  db.tblOrders.push({ id: 'recO2', fields: { Event: ['recEvtadmin-a'], Amount: 19, Status: 'Paid' } });
  db.tblOrders.push({ id: 'recO3', fields: { Event: ['recEvtadmin-a'], Amount: 79, Status: 'Refunded' } });

  assert.equal((await adminData(req('admin-data'))).status, 401);
  assert.equal((await adminData(req('admin-data', { headers: { cookie: hostCookie('admin-a') } }))).status, 401, 'host session is not admin');
  assert.equal((await adminLogin(post('admin-login', { password: 'nope' }))).status, 401);
  const ok = await adminLogin(post('admin-login', { password: 'owner admin pass' }));
  assert.equal(ok.status, 200);
  const cookie = cookieFrom(ok, 'gpd_admin');
  // The admin cookie does not open a host dashboard.
  assert.equal((await dashboardEvent(req('dashboard-event', { headers: { cookie: cookie.replace('gpd_admin', 'wp_session') } }))).status, 401);

  const data = await (await adminData(req('admin-data', { headers: { cookie } }))).json();
  assert.equal(data.totals.events, 1);
  assert.equal(data.totals.revenue, 98);
  assert.equal(data.totals.unpaidDrafts, 1);
  const a = data.events.find((e) => e.slug === 'admin-a');
  assert.equal(a.revenue, 98);
  assert.equal(a.storage.usedBytes, 1024 ** 3);
  assert.equal(a.storage.capBytes, 25 * 1024 ** 3);
  assert.ok(!JSON.stringify(data).includes('scrypt:'), 'no password hashes');

  const act = async (action) => (await adminAction(post('admin-action', { slug: 'admin-a', action }, { cookie }))).json();
  assert.equal((await act('extend')).hostingEndDate, '2100-01-15');
  const reset = await act('reset_password');
  assert.equal(reset.emailed, false);
  assert.match(reset.link, /^https:\/\/guestphotodrop\.test\/dashboard\/admin-a\?reset=/);
  assert.equal((await act('close')).ok, true);
  assert.equal(evRow('admin-a').fields.Status, 'Closed');
  assert.equal((await adminAction(post('admin-action', { slug: 'admin-a', action: 'close' }))).status, 401);
});
