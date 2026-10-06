// Creating draft events at checkout and switching them on after payment.

import crypto from 'node:crypto';
import { config } from './config.mjs';
import { listRecords, createRecord, updateRecord, formulaString } from './airtable.mjs';
import { findEventRecord, normalize, clearEventCache, todayIn } from './events.mjs';
import { PLANS, EXTENSION, planDates, addMonths } from './plans.mjs';
import { HttpError } from './http.mjs';
import { claimOnce } from './ratelimit.mjs';

export const REF_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

// Finds a partner by ref code. With activeOnly, inactive partners are ignored.
export async function findPartner(code, { activeOnly = true } = {}) {
  const { partnersTable } = config().airtable;
  const ref = String(code || '').trim().toLowerCase();
  if (!partnersTable || !REF_RE.test(ref)) return null;
  const page = await listRecords(partnersTable, {
    filterByFormula: `LOWER({Ref Code}) = ${formulaString(ref)}`,
    maxRecords: 1,
    pageSize: 1,
  });
  const rec = page.records[0];
  if (!rec || (activeOnly && rec.fields['Active'] !== true)) return null;
  return { id: rec.id, code: ref };
}

const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';
export function randomToken(len) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => ALPHA[b % ALPHA.length]).join('');
}

// "Shaun & Shatoya" -> "shaun-and-shatoya"; "Maya's 30th!" -> "mayas-30th"
export function slugify(name) {
  const s = String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s.length >= 3 ? s : `event-${randomToken(6)}`;
}

export async function uniqueSlug(name) {
  const base = slugify(name);
  if (!(await findEventRecord(base))) return base;
  for (let i = 0; i < 6; i++) {
    const candidate = `${base.slice(0, 54)}-${randomToken(4)}`;
    if (!(await findEventRecord(candidate))) return candidate;
  }
  throw new HttpError(500, 'slug_unavailable', 'We could not create your link. Please try again.');
}

export async function findOrCreateCustomer({ email, name, customerType }) {
  const { customersTable } = config().airtable;
  const found = await listRecords(customersTable, {
    filterByFormula: `LOWER({Email}) = ${formulaString(email.toLowerCase())}`,
    maxRecords: 1,
    pageSize: 1,
  });
  if (found.records[0]) return found.records[0].id;
  const rec = await createRecord(customersTable, { Email: email, Name: name, 'Customer Type': customerType, 'Pro Subscription Status': 'None' });
  return rec.id;
}

// Called by both the Stripe webhook and the welcome page. Safe to run more than once.
export async function fulfillCheckout(session) {
  if (!session || session.payment_status !== 'paid') return { fulfilled: false, reason: 'not_paid' };
  if (session.metadata && session.metadata.kind === 'extension') return fulfillExtension(session);
  const slug = session.metadata && session.metadata.event_slug;
  const plan = PLANS[session.metadata && session.metadata.plan];
  if (!slug || !plan) throw new HttpError(400, 'bad_session', 'This payment is not linked to an event.', `session ${session.id} missing metadata`);

  const record = await findEventRecord(slug);
  if (!record) throw new HttpError(404, 'event_not_found', "We couldn't find this event.", `paid session ${session.id} for missing event ${slug}`);
  const event = normalize(record);
  if (event.stripeSessionId && event.stripeSessionId !== session.id) {
    throw new HttpError(409, 'session_mismatch', 'This payment does not match the event.', `session ${session.id} vs ${event.stripeSessionId}`);
  }
  if (session.amount_total !== plan.priceCents) {
    throw new HttpError(409, 'amount_mismatch', 'This payment does not match the plan.', `paid ${session.amount_total} for ${plan.key}`);
  }

  const { eventsTable, ordersTable, customersTable } = config().airtable;
  const alreadyActive = event.rawStatus !== 'Draft';
  if (!alreadyActive) {
    const dates = planDates(plan, event.eventDate || todayIn(config().timezone), todayIn(config().timezone));
    await updateRecord(eventsTable, event.recordId, {
      Status: 'Active',
      'Uploads Close Date': dates.uploadsCloseDate,
      'Hosting End Date': dates.hostingEndDate,
      'Stripe Session ID': session.id,
    });
    clearEventCache(slug);
  }

  const existingOrder = await listRecords(ordersTable, {
    filterByFormula: `{Stripe Payment ID} = ${formulaString(session.id)}`,
    maxRecords: 1,
    pageSize: 1,
  });
  if (!existingOrder.records.length) {
    const customer = (record.fields['Customer'] || [])[0];
    const partner = event.referralCode ? await findPartner(event.referralCode, { activeOnly: false }) : null;
    await createRecord(ordersTable, {
      Partner: partner ? [partner.id] : undefined,
      'Referral Code': partner ? partner.code : undefined,
      'Order ID': `ord_${randomToken(12)}`,
      Customer: customer ? [customer] : undefined,
      Event: [event.recordId],
      Product: plan.name,
      Amount: session.amount_total / 100,
      'Stripe Payment ID': session.id,
      Status: 'Paid',
      'Paid At': new Date().toISOString(),
    });
    if (customer && typeof session.customer === 'string') {
      await updateRecord(customersTable, customer, { 'Stripe Customer ID': session.customer });
    }
  }
  return { fulfilled: true, alreadyActive, slug, eventName: event.name };
}

// "Extend hosting": adds EXTENSION.months to the hosting end date, once per payment.
export async function fulfillExtension(session) {
  const slug = session.metadata && session.metadata.event_slug;
  const record = slug ? await findEventRecord(slug) : null;
  if (!record) throw new HttpError(404, 'event_not_found', "We couldn't find this event.", `extension ${session.id} for missing event ${slug}`);
  const event = normalize(record);
  if (event.eventId !== session.metadata.event_id) {
    throw new HttpError(409, 'session_mismatch', 'This payment does not match the event.', `extension ${session.id} event id mismatch`);
  }
  if (session.amount_total !== EXTENSION.priceCents) {
    throw new HttpError(409, 'amount_mismatch', 'This payment does not match the price.', `paid ${session.amount_total} for extension`);
  }
  const done = { fulfilled: true, kind: 'extension', slug, eventName: event.name };
  if (event.appliedExtensions.includes(session.id)) return { ...done, alreadyApplied: true, hostingEndDate: event.hostingEndDate };
  // Webhook and return page can arrive together; only the first one applies the extension.
  if (!(await claimOnce(`extension:${session.id}`))) return { ...done, alreadyApplied: true, hostingEndDate: event.hostingEndDate };

  const c = config();
  const today = todayIn(c.timezone);
  const base = event.hostingEndDate && event.hostingEndDate > today ? event.hostingEndDate : today;
  const hostingEndDate = addMonths(base, EXTENSION.months);
  if (event.filesDeletedOn) console.error(`[extension] ${session.id} paid after files were deleted for ${slug}; refund it in Stripe`);
  await updateRecord(c.airtable.eventsTable, event.recordId, {
    'Hosting End Date': hostingEndDate,
    'Applied Extensions': [...event.appliedExtensions, session.id].join('\n'),
    'Deletion Notice 30 Sent': null,
    'Deletion Notice 7 Sent': null,
    ...(event.rawStatus === 'Expired' ? { Status: 'Active' } : {}),
  });
  clearEventCache(slug);

  const customer = (record.fields['Customer'] || [])[0];
  await createRecord(c.airtable.ordersTable, {
    'Order ID': `ord_${randomToken(12)}`,
    Customer: customer ? [customer] : undefined,
    Event: [event.recordId],
    Product: EXTENSION.name,
    Amount: session.amount_total / 100,
    'Stripe Payment ID': session.id,
    Status: 'Paid',
    'Paid At': new Date().toISOString(),
  });
  return { ...done, hostingEndDate };
}
