// POST /.netlify/functions/admin-action  { slug, action }   (admin session)
//   extend          -> 12 more months of hosting at no charge
//   reset_password  -> emails the host a reset link (valid 24 hours) and returns it here too
//   close           -> stops uploads now (the gallery stays available until hosting ends)

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError, cleanText } from '../lib/http.mjs';
import { requireAdmin } from '../lib/session.mjs';
import { findEventBySlug, clearEventCache, todayIn } from '../lib/events.mjs';
import { updateRecord } from '../lib/airtable.mjs';
import { EXTENSION, addMonths } from '../lib/plans.mjs';
import { issueResetLink, ADMIN_RESET_HOURS } from '../lib/password-reset.mjs';
import { sendEmail, resetPasswordEmail } from '../lib/email.mjs';
import { config } from '../lib/config.mjs';

export default handler('admin-action', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'SITE_URL']);
  requireAdmin(req);
  const body = await readJson(req, 1000);
  const event = await findEventBySlug(cleanText(body.slug, 80), { fresh: true });
  if (event.rawStatus === 'Draft') throw new HttpError(409, 'not_paid', 'This event was never paid for.');
  const c = config();

  if (body.action === 'extend') {
    if (event.filesDeletedOn) throw new HttpError(409, 'files_deleted', 'Files for this event were already deleted.');
    const today = todayIn(c.timezone);
    const base = event.hostingEndDate && event.hostingEndDate > today ? event.hostingEndDate : today;
    const hostingEndDate = addMonths(base, EXTENSION.months);
    await updateRecord(c.airtable.eventsTable, event.recordId, {
      'Hosting End Date': hostingEndDate,
      'Deletion Notice 30 Sent': null,
      'Deletion Notice 7 Sent': null,
      ...(event.rawStatus === 'Expired' ? { Status: 'Active' } : {}),
    });
    clearEventCache(event.slug);
    return json({ ok: true, message: `Hosting now ends ${hostingEndDate}.`, hostingEndDate });
  }

  if (body.action === 'reset_password') {
    const link = await issueResetLink(event, ADMIN_RESET_HOURS);
    let emailed = false;
    if (event.ownerEmail) {
      const res = await sendEmail({ to: event.ownerEmail, ...resetPasswordEmail({ eventName: event.name, link, hours: ADMIN_RESET_HOURS }) });
      emailed = res.sent;
    }
    return json({
      ok: true,
      emailed,
      link,
      message: emailed ? `Reset link emailed to ${event.ownerEmail}. It works for 24 hours.` : 'Email is not set up, so copy this link and send it to the host. It works for 24 hours.',
    });
  }

  if (body.action === 'close') {
    await updateRecord(c.airtable.eventsTable, event.recordId, { Status: 'Closed' });
    clearEventCache(event.slug);
    return json({ ok: true, message: 'Uploads are closed for this event.' });
  }

  throw new HttpError(400, 'bad_action', 'Unknown action.');
});
