// Daily retention job: warns hosts 30 and 7 days before their files are deleted, then deletes
// the files DELETE_AFTER_DAYS (30) after the hosting end date.
//
// Safety rules:
//   - Files are only deleted after the 7-day warning was actually sent at least 7 days earlier.
//     If email isn't set up, nothing is deleted (the job logs why).
//   - Only the event's own Cloudinary folder (events/<Event ID>/) is ever deleted.
//   - At most MAX_DELETIONS_PER_RUN events are deleted per run; the rest wait for the next day.

import { config } from './config.mjs';
import { listAll, updateRecord, formulaString } from './airtable.mjs';
import { normalize, deleteOnDate, addDays, todayIn, clearEventCache } from './events.mjs';
import { deleteByPrefix } from './cloudinary.mjs';
import { sendEmail, emailConfigured, deletionNoticeEmail } from './email.mjs';

export const MAX_DELETIONS_PER_RUN = 5;

function longDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// What should happen to one event today. Pure function, easy to test.
export function retentionAction(event, today, canEmail) {
  if (event.rawStatus === 'Draft' || event.filesDeletedOn || !event.hostingEndDate) return null;
  const deleteOn = deleteOnDate(event);
  const warn30 = addDays(deleteOn, -30);
  const warn7 = addDays(deleteOn, -7);
  if (today < warn30) return null;

  if (today >= warn7 && !event.notice7Sent) return canEmail || !event.ownerEmail ? { type: 'notice', days: 7, deleteOn } : { type: 'blocked', reason: 'email_not_configured' };
  if (today < warn7 && !event.notice30Sent) return canEmail || !event.ownerEmail ? { type: 'notice', days: 30, deleteOn } : { type: 'blocked', reason: 'email_not_configured' };
  if (today >= deleteOn && event.notice7Sent && today >= addDays(event.notice7Sent, 7)) return { type: 'delete', deleteOn };
  return null;
}

export async function runRetention({ now = new Date() } = {}) {
  const c = config();
  const today = todayIn(c.timezone, now);
  const canEmail = emailConfigured();
  const records = await listAll(c.airtable.eventsTable, {
    filterByFormula: `AND({Status} != ${formulaString('Draft')}, {Files Deleted On} = BLANK(), {Hosting End Date} != BLANK())`,
  });
  const summary = { today, checked: records.length, notices: 0, deleted: 0, blocked: 0, errors: 0, deferred: 0 };
  let deletions = 0;

  for (const record of records) {
    const event = normalize(record);
    const action = retentionAction(event, today, canEmail);
    if (!action) continue;
    try {
      if (action.type === 'blocked') {
        summary.blocked += 1;
        console.warn(`[retention] ${event.slug}: notice due but email is not set up (RESEND_API_KEY). Files will not be deleted until notices go out.`);
      } else if (action.type === 'notice') {
        if (event.ownerEmail) {
          const daysLeft = Math.max(1, Math.round((Date.parse(action.deleteOn) - Date.parse(today)) / 86400000));
          const msg = deletionNoticeEmail({
            eventName: event.name,
            deleteOnText: longDate(action.deleteOn),
            daysLeft,
            dashboardUrl: `${c.siteUrl}/dashboard/${event.slug}`,
          });
          const res = await sendEmail({ to: event.ownerEmail, ...msg });
          if (!res.sent) throw new Error(`email not sent: ${res.reason}`);
        }
        const field = action.days === 7 ? 'Deletion Notice 7 Sent' : 'Deletion Notice 30 Sent';
        await updateRecord(c.airtable.eventsTable, event.recordId, { [field]: today });
        summary.notices += 1;
      } else if (action.type === 'delete') {
        if (deletions >= MAX_DELETIONS_PER_RUN) {
          summary.deferred += 1;
          continue;
        }
        deletions += 1;
        const result = await deleteByPrefix(`events/${event.eventId}/`);
        await updateRecord(c.airtable.eventsTable, event.recordId, {
          'Files Deleted On': today,
          Status: 'Expired',
          'Cover Image URL': null,
        });
        clearEventCache(event.slug);
        console.log(`[retention] ${event.slug}: deleted ${result.deleted} files`);
        summary.deleted += 1;
      }
    } catch (err) {
      summary.errors += 1;
      console.error(`[retention] ${event.slug}: ${err.message}`);
    }
  }
  return summary;
}
