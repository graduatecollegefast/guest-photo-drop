// Plans and prices live on the server only. The browser sends a plan key; the price and
// the dates always come from here, so nobody can change what they pay.

export const PLANS = {
  party: {
    key: 'party',
    name: 'Party Drop',
    priceCents: 2900,
    uploadMonths: 3,
    hostingMonths: 6,
    description: 'Uploads open 3 months, gallery hosted 6 months',
  },
  wedding: {
    key: 'wedding',
    name: 'Wedding Drop',
    priceCents: 7900,
    uploadMonths: 12,
    hostingMonths: 12,
    description: 'Uploads open 12 months, gallery hosted 12 months',
  },
  forever: {
    key: 'forever',
    name: 'Forever Keepsake',
    priceCents: 14900,
    uploadMonths: 12,
    hostingMonths: 24,
    description: 'Uploads open 12 months, gallery hosted 2 years',
  },
};

export const EVENT_TYPES = ['Wedding', 'Birthday', 'Shower', 'Graduation', 'Reunion', 'Other'];
export const THEMES = ['Silver Red Purple', 'Classic Ivory', 'Blush', 'Midnight'];

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
