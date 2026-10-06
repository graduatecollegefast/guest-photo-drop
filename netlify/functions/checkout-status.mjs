// GET /.netlify/functions/checkout-status?session_id=cs_...
// The welcome page calls this after Stripe sends the customer back. If the payment is done,
// the event is switched on right away (the webhook does the same thing; both are safe to repeat).

import { handler, json, requireMethod, ensureConfigured, HttpError } from '../lib/http.mjs';
import { getCheckoutSession } from '../lib/stripe.mjs';
import { fulfillCheckout } from '../lib/orders.mjs';

export default handler('checkout-status', async (req) => {
  requireMethod(req, 'GET');
  ensureConfigured(['STRIPE_SECRET_KEY', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'AIRTABLE_ORDERS_TABLE_ID', 'AIRTABLE_CUSTOMERS_TABLE_ID']);
  const id = new URL(req.url).searchParams.get('session_id') || '';
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) throw new HttpError(400, 'bad_session', 'We could not find this payment.');
  const session = await getCheckoutSession(id);
  if (session.payment_status !== 'paid') return json({ ok: true, paid: false });
  const result = await fulfillCheckout(session);
  return json({ ok: true, paid: true, slug: result.slug, eventName: result.eventName });
});
