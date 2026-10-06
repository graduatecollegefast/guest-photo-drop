// Display copy for plans. Prices charged are set on the server (netlify/lib/plans.mjs).
export const PLANS = [
  {
    key: 'party',
    name: 'Party Drop',
    price: 29,
    for: 'Birthdays, showers, graduations and reunions',
    points: ['Uploads open for 3 months', 'Gallery hosted for 6 months', 'Unlimited photos and videos', 'Download everything'],
  },
  {
    key: 'wedding',
    name: 'Wedding Drop',
    price: 79,
    for: 'Weddings',
    popular: true,
    points: ['Uploads open for 12 months', 'Gallery hosted for 12 months', 'Unlimited photos and videos', 'Your photo on your page', 'Download everything'],
  },
  {
    key: 'forever',
    name: 'Forever Keepsake',
    price: 149,
    for: 'Weddings',
    points: ['Everything in Wedding Drop', 'Gallery hosted for 2 years', 'Uploads open for 12 months'],
  },
];

export const EVENT_TYPES = ['Wedding', 'Birthday', 'Shower', 'Graduation', 'Reunion', 'Other'];

export const THEMES = [
  { name: 'Silver Red Purple', swatch: ['#4a2266', '#b0172f', '#a9a9b6'] },
  { name: 'Classic Ivory', swatch: ['#2f2723', '#a8875a', '#e9dccb'] },
  { name: 'Blush', swatch: ['#8a3b55', '#d4708c', '#f3e1e6'] },
  { name: 'Midnight', swatch: ['#1d2a4d', '#b8923a', '#e3e6ee'] },
];

export function slugPreview(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
