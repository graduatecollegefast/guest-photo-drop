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
Event Type, dates (Event, Uploads Close, Hosting End), Theme and its own dashboard password hash.
Every guest page is generated from its Event record, so a new event goes live as soon as its record exists.

## Status

- Working today (inherited from the MVP): guest QR page, reliable multi-file uploads with retry,
  signed direct uploads, idempotent records, password dashboard, gallery, viewer, hide, ZIP download,
  QR code, couple photo upload.
- Next to build: self-serve event creation and Stripe checkout, per-event dashboard passwords and
  themes, plan-based dates, storage moved to Cloudflare R2, marketing site at guestphotodrop.com.

The original single-event setup guide (Airtable fields, Cloudinary, Netlify, troubleshooting) still
applies to the inherited code and is kept in docs/mvp-setup.md.
