// GET /.netlify/functions/admin-data  (admin session)
// Every event with its revenue and storage, plus totals.

import { handler, json, requireMethod, ensureConfigured } from '../lib/http.mjs';
import { requireAdmin } from '../lib/session.mjs';
import { listAll } from '../lib/airtable.mjs';
import { normalize, effectiveStatus, deleteOnDate, storageInfo } from '../lib/events.mjs';
import { config } from '../lib/config.mjs';

export default handler('admin-data', async (req) => {
  requireMethod(req, 'GET');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'AIRTABLE_ORDERS_TABLE_ID']);
  requireAdmin(req);
  const { eventsTable, ordersTable } = config().airtable;
  const [eventRecords, orderRecords] = await Promise.all([
    listAll(eventsTable),
    listAll(ordersTable, { fields: ['Event', 'Amount', 'Status', 'Product'] }),
  ]);

  const revenueByEvent = {};
  for (const o of orderRecords) {
    if (o.fields['Status'] !== 'Paid') continue;
    for (const evId of o.fields['Event'] || []) revenueByEvent[evId] = (revenueByEvent[evId] || 0) + (Number(o.fields['Amount']) || 0);
  }

  const events = eventRecords.map((r) => {
    const e = normalize(r);
    return {
      name: e.name,
      slug: e.slug,
      eventType: e.eventType,
      plan: e.plan,
      status: effectiveStatus(e),
      rawStatus: e.rawStatus,
      eventDate: e.eventDate,
      uploadsCloseDate: e.uploadsCloseDate,
      hostingEndDate: e.hostingEndDate,
      deleteOnDate: deleteOnDate(e),
      filesDeletedOn: e.filesDeletedOn,
      ownerEmail: e.ownerEmail,
      referralCode: e.referralCode,
      uploads: e.counts.photos + e.counts.videos + e.counts.hidden,
      storage: storageInfo(e),
      revenue: Math.round((revenueByEvent[r.id] || 0) * 100) / 100,
      createdAt: r.fields['Created At'] || r.createdTime || null,
    };
  });
  events.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const paid = events.filter((e) => e.status !== 'draft');
  const totals = {
    events: paid.length,
    active: paid.filter((e) => e.status === 'active').length,
    revenue: Math.round(events.reduce((s, e) => s + e.revenue, 0) * 100) / 100,
    storageBytes: paid.reduce((s, e) => s + e.storage.usedBytes, 0),
    unpaidDrafts: events.length - paid.length,
  };
  return json({ ok: true, totals, events });
});
