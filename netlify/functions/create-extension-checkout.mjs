// POST /.netlify/functions/create-extension-checkout  (requires session)
// Starts a Stripe Checkout for "Extend hosting": 12 more months for $19.
// Hosting is extended only after Stripe confirms payment (see lib/orders.mjs).

import { handler, json, requireMethod, ensureConfigured, HttpError } from '../lib/http.mjs';
import { requireSession, assertCurrentPassword } from '../lib/session.mjs';
import { findEventBySlug, effectiveStatus } from '../lib/events.mjs';
import { createCheckoutSession } from '../lib/stripe.mjs';
import { EXTENSION } from '../lib/plans.mjs';
import { config } from '../lib/config.mjs';

export default handler('create-extension-checkout', async (req) => {
  requireMethod(req, 'POST');
  ensureConfigured(['SESSION_SECRET', 'AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_EVENTS_TABLE_ID', 'STRIPE_SECRET_KEY', 'SITE_URL']);
  const session = requireSession(req);
  const event = await findEventBySlug(session.eventSlug, { fresh: true });
  assertCurrentPassword(session, event);
  if (effectiveStatus(event) === 'draft') throw new HttpError(403, 'not_paid', 'This event is not active yet.');
  if (event.filesDeletedOn) throw new HttpError(409, 'files_deleted', 'The files for this event were already deleted, so hosting can’t be extended.');

  const c = config();
  const meta = { kind: 'extension', event_id: event.eventId, event_slug: event.slug };
  const stripeSession = await createCheckoutSession(
    {
      mode: 'payment',
      customer_email: event.ownerEmail || undefined,
      client_reference_id: event.eventId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: EXTENSION.priceCents,
            product_data: { name: `${EXTENSION.name}: ${event.name}`, description: EXTENSION.description },
          },
        },
      ],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: `${c.siteUrl}/dashboard/${event.slug}?extended={CHECKOUT_SESSION_ID}`,
      cancel_url: `${c.siteUrl}/dashboard/${event.slug}`,
    },
    `extend_${event.eventId}_${Date.now()}`
  );
  return json({ ok: true, url: stripeSession.url });
});
