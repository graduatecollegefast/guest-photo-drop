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

// Example text for the event name, by event type (weddings use two name fields).
export const NAME_EXAMPLES = {
  Birthday: 'Maya’s 30th Birthday',
  Shower: 'Ava’s Baby Shower',
  Graduation: 'Marcus’s Class of 2027',
  Reunion: 'Johnson Family Reunion',
  Other: 'Our Celebration',
};

export const HEADLINE_EXAMPLES = {
  Wedding: 'Help us remember the day through your eyes.',
  Birthday: 'Share your favorite moments from the party.',
  Shower: 'Share your favorite moments from the shower.',
  Graduation: 'Share your favorite moments from the celebration.',
  Reunion: 'Share your favorite moments from the reunion.',
  Other: 'Share your favorite moments with us.',
};

export const DEFAULT_ICON = { Wedding: 'Hearts', Shower: 'Florals', Birthday: 'Sparkles', Graduation: 'Sparkles', Reunion: 'Sparkles', Other: 'Sparkles' };

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
