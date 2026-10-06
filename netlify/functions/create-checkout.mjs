// POST /.netlify/functions/create-checkout
// { plan, eventType, eventName, eventDate, headline, email, password, theme }
// Creates the customer and a Draft event, then a Stripe Checkout session. The event only
// switches on after Stripe confirms payment (see stripe-webhook and checkout-status).

import { handler, json, requireMethod, readJson, ensureConfigured, HttpError, cleanText } from '../lib/http.mjs';
import { PLANS, EVENT_TYPES, THEMES } from '../lib/plans.mjs';
import { hashPassword } from '../lib/session.mjs';
import { createRecord, updateRecord } from '../lib/airtable.mjs';
import { uniqueSlug, findOrCreateCustomer, randomToken } from '../lib/orders.mjs';
import { createCheckoutSession } from '../lib/stripe.mjs';
import { todayIn, addDays } from '../lib/events.mjs';
import { config } from '../lib/config.mjs';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_HEADLINES = {
  Wedding: 'Help us remember the day through your eyes.',
  Birthday: 'Share your favorite moments from the party.',
  Shower: 'Share your favorite moments from the shower.',
  Graduation: 'Share your favorite moments from the celebration.',
  Reunion: 'Share your favorite moments from the reunion.',
  Other: 'Share your favorite moments with us.',
};

function bad(message) {
  return new HttpError(400, 'invalid_form', message);
}

export function validateSignup(body, today) {
  const plan = PLANS[body.plan];
  if (!plan) throw bad('Please choose a plan.');
  const eventType = EVENT_TYPES.includes(body.eventType) ? body.eventType : null;
  if (!eventType) throw bad('Please choose what kind of event this is.');
  if (plan.key === 'party' && eventType === 'Wedding') throw bad('Weddings use the Wedding Drop or Forever Keepsake plan.');
  const eventName = cleanText(body.eventName, 60);
  if (eventName.length < 2) throw bad('Please enter the names for your event.');
  const eventDate = typeof body.eventDate === 'string' && DATE_RE.test(body.eventDate) ? body.eventDate : null;
  if (!eventDate || eventDate < addDays(today, -365) || eventDate > addDays(today, 3 * 365)) {
    throw bad('Please enter a valid event date.');
  }
  const email = cleanText(body.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad('Please enter a valid email address.');
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (password.length < 8 || password.length > 128) throw bad('Your dashboard password needs at least 8 characters.');
  const theme = THEMES.includes(body.theme) ? body.theme : THEMES[0];
  const headline = cleanText(body.headline, 100) || DEFAULT_HEADLINES[eventType];
  return { plan, eventType, eventName, eventDate, email, password, theme, headline };
}

export default handler('create-checkout', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured([
    'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'AIRTABLE_CUSTOMERS_TABLE_ID',
    'STRIPE_SECRET_KEY', 'SITE_URL',
  ]);
  const c = config();
  const form = validateSignup(await readJson(req, 4000), todayIn(c.timezone));

  const slug = await uniqueSlug(form.eventName);
  const customerId = await findOrCreateCustomer({
    email: form.email,
    name: form.eventName,
    customerType: form.eventType === 'Wedding' ? 'Couple' : 'Host',
  });
  const eventId = `evt_${randomToken(12)}`;
  const record = await createRecord(c.airtable.eventsTable, {
    'Event ID': eventId,
    'Event Name': form.eventName,
    'Event Slug': slug,
    'Event Type': form.eventType,
    Plan: form.plan.name,
    'Event Date': form.eventDate,
    Status: 'Draft',
    Headline: form.headline,
    Theme: form.theme,
    'Allow Photos': true,
    'Allow Videos': true,
    'Maximum Files Per Upload': 50,
    'Dashboard Password Hash': hashPassword(form.password),
    'Owner Email': form.email,
    Customer: [customerId],
  });

  const session = await createCheckoutSession(
    {
      mode: 'payment',
      customer_email: form.email,
      client_reference_id: eventId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: form.plan.priceCents,
            product_data: { name: `${form.plan.name}: ${form.eventName}`, description: form.plan.description },
          },
        },
      ],
      metadata: { event_id: eventId, event_slug: slug, plan: form.plan.key },
      payment_intent_data: { metadata: { event_id: eventId, event_slug: slug, plan: form.plan.key } },
      success_url: `${c.siteUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${c.siteUrl}/start?plan=${form.plan.key}&canceled=1`,
    },
    `checkout_${eventId}`
  );
  await updateRecord(c.airtable.eventsTable, record.id, { 'Stripe Session ID': session.id });
  return json({ ok: true, url: session.url });
});
