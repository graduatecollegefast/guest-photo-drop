// Central server-side configuration. Values come only from environment variables.

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function config() {
  return {
    airtable: {
      token: process.env.AIRTABLE_ACCESS_TOKEN || '',
      baseId: process.env.AIRTABLE_BASE_ID || '',
      eventsTable: process.env.AIRTABLE_EVENTS_TABLE_ID || '',
      uploadsTable: process.env.AIRTABLE_UPLOADS_TABLE_ID || '',
      customersTable: process.env.AIRTABLE_CUSTOMERS_TABLE_ID || '',
      ordersTable: process.env.AIRTABLE_ORDERS_TABLE_ID || '',
      partnersTable: process.env.AIRTABLE_PARTNERS_TABLE_ID || '',
    },
    // Cloudflare R2 (S3-compatible) for photos and videos.
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET || '',
    },
    dashboard: {
      sessionSecret: process.env.SESSION_SECRET || '',
      sessionDays: num('SESSION_DAYS', 7),
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    // Public site address used in Stripe return links, e.g. https://guestphotodrop.com
    siteUrl: (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, ''),
    limits: {
      maxImageMB: num('MAX_IMAGE_MB', 10),
      maxVideoMB: num('MAX_VIDEO_MB', 100),
    },
    timezone: process.env.EVENT_TIMEZONE || 'America/Chicago',
  };
}

// File formats accepted end to end (checked in the browser and again on the server).
export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
export const VIDEO_FORMATS = ['mp4', 'mov', 'm4v', '3gp', 'webm'];

export function missingConfig(keys) {
  const c = config();
  const flat = {
    AIRTABLE_ACCESS_TOKEN: c.airtable.token,
    AIRTABLE_BASE_ID: c.airtable.baseId,
    AIRTABLE_EVENTS_TABLE_ID: c.airtable.eventsTable,
    AIRTABLE_UPLOADS_TABLE_ID: c.airtable.uploadsTable,
    AIRTABLE_CUSTOMERS_TABLE_ID: c.airtable.customersTable,
    AIRTABLE_ORDERS_TABLE_ID: c.airtable.ordersTable,
    AIRTABLE_PARTNERS_TABLE_ID: c.airtable.partnersTable,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
    R2_ACCOUNT_ID: c.r2.accountId,
    R2_ACCESS_KEY_ID: c.r2.accessKeyId,
    R2_SECRET_ACCESS_KEY: c.r2.secretAccessKey,
    R2_BUCKET: c.r2.bucket,
    SESSION_SECRET: c.dashboard.sessionSecret,
    STRIPE_SECRET_KEY: c.stripe.secretKey,
    STRIPE_WEBHOOK_SECRET: c.stripe.webhookSecret,
    SITE_URL: c.siteUrl,
  };
  return keys.filter((k) => !flat[k]);
}

export const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

// Browser MIME types for each accepted extension (used when the file has no usable type).
export const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', '3gp': 'video/3gpp', webm: 'video/webm',
};
