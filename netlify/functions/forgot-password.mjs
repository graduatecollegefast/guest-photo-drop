// POST /.netlify/functions/forgot-password  { slug, email }
// Emails a one-time reset link to the event's owner email. The reply is always the same,
// so nobody can use this to find out which emails or events exist.

import { handler, json, requireMethod, readJson, ensureConfigured, cleanText } from '../lib/http.mjs';
import { findEventBySlug, effectiveStatus } from '../lib/events.mjs';
import { takeAttempt, clientIp } from '../lib/ratelimit.mjs';
import { issueResetLink, RESET_HOURS } from '../lib/password-reset.mjs';
import { sendEmail, resetPasswordEmail } from '../lib/email.mjs';

const GENERIC = 'If that email matches this event, a reset link is on its way. It expires in 1 hour.';

export default handler('forgot-password', async (req, context) => {
  requireMethod(req, 'POST');
  ensureConfigured(['AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'SITE_URL']);
  const body = await readJson(req, 2000);
  const slug = cleanText(body.slug, 80);
  const email = cleanText(body.email, 254).toLowerCase();
  await takeAttempt('forgot', `${clientIp(req, context)}|${slug}`);

  let event = null;
  try {
    event = await findEventBySlug(slug, { fresh: true });
  } catch (err) {
    if (err.code !== 'event_not_found') throw err;
  }
  if (event && effectiveStatus(event) !== 'draft' && email && event.ownerEmail.toLowerCase() === email) {
    const link = await issueResetLink(event, RESET_HOURS);
    const msg = resetPasswordEmail({ eventName: event.name, link, hours: RESET_HOURS });
    await sendEmail({ to: event.ownerEmail, ...msg });
  } else {
    await new Promise((r) => setTimeout(r, 400)); // similar timing either way
  }
  return json({ ok: true, message: GENERIC });
});
