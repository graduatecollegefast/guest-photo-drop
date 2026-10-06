# Guest Photo Drop

Guests scan a QR code and drop their photos and videos into one private album. No app, no account.
Focus: weddings. Also built for birthdays, showers, graduations and reunions.

This repository is the standalone product. It started from the single-wedding MVP and is fully separate
from it: its own code, its own Airtable base, its own storage folders and its own Netlify site.

## Plans (one-time per event unless noted)

| Plan | Price | Uploads open | Gallery hosted |
|---|---|---|---|
| Party Drop | $29 | 3 months | 6 months |
| Wedding Drop | $79 | 12 months | 12 months |
| Forever Keepsake | $149 | 12 months | 2 years |
| Extend hosting | $19 | | +12 months |
| Pro (planners, venues, photographers) | $49 / month | up to 8 events a month | per event plan |

## Airtable base: Guest Photo Drop

Tables: Customers, Events, Uploads, Orders. Each Event belongs to a Customer, carries its Plan,
Event Type, dates (Event, Uploads Close, Hosting End), Colors, Icon and its own dashboard password hash.
(The older Theme field is no longer used.)
Every guest page is generated from its Event record, so a new event goes live as soon as its record exists.

## How a customer gets their page

1. Home page (`/`) shows the plans. "Create your event" opens `/start`.
2. `/start`: plan, event type, names (examples match the event type), date, optional headline, 2 or 3 colors
   from 12 dots (or a starter set), an icon (Hearts, Bells, Ribbons, Rings, Florals, Sparkles), email and
   dashboard password, with a live preview of the guest page.
3. `create-checkout` validates everything, creates the Customer and a **Draft** Event (password stored only
   as a scrypt hash), then opens Stripe Checkout. Prices come from `netlify/lib/plans.mjs`, never the browser.
4. After payment Stripe returns to `/welcome`. `checkout-status` confirms the payment and switches the event
   to **Active** with its Uploads Close and Hosting End dates. `stripe-webhook` does the same thing from
   Stripe's side. Both are safe to run more than once: one Order per payment.
5. The welcome page shows the guest link, the QR code and `/dashboard/<link>`.

Guest pages (`/e/<link>`) are built from the Event record. `src/utils/palette.js` turns the picked colors into
a full theme: darkest color for names and buttons, middle for icons, lightest for dividers and backgrounds,
with contrast checked so every one of the 286 possible picks stays readable (`tests/palette.test.mjs`).
Old `/event/<link>` addresses redirect to `/e/<link>`.
Status follows the plan dates: open until Uploads Close, closed after, expired after Hosting End.

## Environment variables (Netlify)

| Name | Secret | Value |
|---|---|---|
| AIRTABLE_ACCESS_TOKEN | yes | Token for the Guest Photo Drop base (records read and write) |
| AIRTABLE_BASE_ID | no | Guest Photo Drop base ID |
| AIRTABLE_EVENTS_TABLE_ID, AIRTABLE_UPLOADS_TABLE_ID, AIRTABLE_CUSTOMERS_TABLE_ID, AIRTABLE_ORDERS_TABLE_ID | no | Table IDs |
| CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY | no | Cloudinary |
| CLOUDINARY_API_SECRET | yes | Cloudinary |
| STRIPE_SECRET_KEY | yes | `sk_test_...` while testing, `sk_live_...` at launch |
| STRIPE_WEBHOOK_SECRET | yes | `whsec_...` from the webhook below |
| SESSION_SECRET | yes | Long random string |
| SITE_URL | no | e.g. `https://guestphotodrop.com` |

## Stripe webhook

Stripe dashboard > Developers > Webhooks > Add endpoint:
`<SITE_URL>/.netlify/functions/stripe-webhook`, events `checkout.session.completed` and
`checkout.session.async_payment_succeeded`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## Tests

`npm test` runs the server tests offline (fake Airtable and fake Stripe).
`npm run build && node tests/mock-server.mjs` then `python3 tests/ui-flow.py` runs the browser walkthrough.

## Next steps

Pro plan for planners and venues, moving storage to Cloudflare R2, confirmation emails, and a custom domain.

The original single-event setup guide is kept in docs/mvp-setup.md for reference.
