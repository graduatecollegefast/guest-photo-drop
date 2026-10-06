// POST /.netlify/functions/stripe-webhook   (Stripe calls this; set it up in the Stripe dashboard)
// Events: checkout.session.completed, checkout.session.async_payment_succeeded

import { handler, json, requireMethod, ensureConfigured, HttpError } from '../lib/http.mjs';
import { verifyWebhook } from '../lib/stripe.mjs';
import { fulfillCheckout } from '../lib/orders.mjs';

const HANDLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export default handler('stripe-webhook', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['STRIPE_WEBHOOK_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'AIRTABLE_ORDERS_TABLE_ID', 'AIRTABLE_CUSTOMERS_TABLE_ID']);
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get('stripe-signature'))) {
    throw new HttpError(400, 'bad_signature', 'Invalid signature');
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'bad_json', 'Invalid body');
  }
  if (HANDLED.has(event.type)) {
    const result = await fulfillCheckout(event.data && event.data.object);
    console.log(`[stripe-webhook] ${event.type} ${event.id}`, JSON.stringify(result));
  }
  return json({ received: true });
});
