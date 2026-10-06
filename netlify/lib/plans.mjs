// Plans and prices live on the server only. The browser sends a plan key; the price and
// the dates always come from here, so nobody can change what they pay.

export const PLANS = {
  party: {
    key: 'party',
    name: 'Party Drop',
    priceCents: 2900,
    uploadMonths: 3,
    hostingMonths: 6,
    storageGB: 5,
    description: 'Uploads open 3 months, gallery hosted 6 months',
  },
  wedding: {
    key: 'wedding',
    name: 'Wedding Drop',
    priceCents: 7900,
    uploadMonths: 12,
    hostingMonths: 12,
    storageGB: 25,
    description: 'Uploads open 12 months, gallery hosted 12 months',
  },
  forever: {
    key: 'forever',
    name: 'Forever Keepsake',
    priceCents: 14900,
    uploadMonths: 12,
    hostingMonths: 24,
    storageGB: 50,
    description: 'Uploads open 12 months, gallery hosted 2 years',
  },
};

// Add-on sold from the host dashboard: 12 more months of hosting for $19.
export const EXTENSION = {
  key: 'extension',
  name: 'Extend Hosting',
  priceCents: 1900,
  months: 12,
  description: 'Keeps your gallery online 12 more months',
};

// Files are deleted this many days after the hosting end date (hosts get emails 30 and 7 days before).
export const DELETE_AFTER_DAYS = 30;

const GB = 1024 ** 3;
export function planByName(name) {
  return Object.values(PLANS).find((p) => p.name === name) || null;
}
// Storage cap in bytes for an event's plan. Unknown plans get the Wedding Drop cap.
export function storageCapBytes(planName) {
  return (planByName(planName) || PLANS.wedding).storageGB * GB;
}

export const EVENT_TYPES = ['Wedding', 'Birthday', 'Shower', 'Graduation', 'Reunion', 'Other'];
// The 12 color dots customers pick 2 or 3 from (most-used wedding colors).
export const COLORS = ['White', 'Champagne', 'Mocha', 'Black', 'Gold', 'Silver', 'Sage', 'Emerald', 'Dusty Blue', 'Navy', 'Blush', 'Burgundy'];
export const ICONS = ['Hearts', 'Bells', 'Ribbons', 'Rings', 'Florals', 'Sparkles'];
export const DEFAULT_ICON = { Wedding: 'Hearts', Shower: 'Florals', Birthday: 'Sparkles', Graduation: 'Sparkles', Reunion: 'Sparkles', Other: 'Sparkles' };
export const DEFAULT_COLORS = ['Champagne', 'Mocha', 'White'];

export function addMonths(isoDate, months) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

// Dates are counted from the event date, or from the purchase date if the event already happened.
export function planDates(plan, eventDate, today) {
  const start = eventDate > today ? eventDate : today;
  return {
    uploadsCloseDate: addMonths(start, plan.uploadMonths),
    hostingEndDate: addMonths(start, plan.hostingMonths),
  };
}
