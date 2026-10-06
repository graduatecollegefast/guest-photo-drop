// Scheduled function: runs once a day (midnight UTC) on Netlify.
// Sends the 30-day and 7-day deletion warnings and deletes files 30 days after hosting ends.
// See lib/retention.mjs for the rules.

import { runRetention } from '../lib/retention.mjs';
import { missingConfig } from '../lib/config.mjs';

export default async () => {
  const missing = missingConfig(['AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'SITE_URL']);
  if (missing.length) {
    console.error(`[daily-maintenance] not configured: ${missing.join(', ')}`);
    return new Response('not configured', { status: 503 });
  }
  const summary = await runRetention();
  console.log('[daily-maintenance]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { headers: { 'Content-Type': 'application/json' } });
};

export const config = { schedule: '@daily' };
