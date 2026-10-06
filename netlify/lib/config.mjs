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
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
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

// File formats accepted end to end. Cloudinary enforces these too (allowed_formats is signed).
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
    CLOUDINARY_CLOUD_NAME: c.cloudinary.cloudName,
    CLOUDINARY_API_KEY: c.cloudinary.apiKey,
    CLOUDINARY_API_SECRET: c.cloudinary.apiSecret,
    SESSION_SECRET: c.dashboard.sessionSecret,
    STRIPE_SECRET_KEY: c.stripe.secretKey,
    STRIPE_WEBHOOK_SECRET: c.stripe.webhookSecret,
    SITE_URL: c.siteUrl,
  };
  return keys.filter((k) => !flat[k]);
}
