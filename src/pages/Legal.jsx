import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';
import { SUPPORT_EMAIL, COMPANY, MAILING_ADDRESS } from '../utils/support.js';

const UPDATED = 'October 5, 2026';
const Mail = () => <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

function Terms() {
  return (
    <>
      <p>
        These terms cover your use of Guest Photo Drop (“we”, “us”), a service operated by {COMPANY}. By creating an event,
        uploading photos or videos, or using an event page, you agree to these terms.
      </p>

      <h2>The service</h2>
      <p>
        Guest Photo Drop gives the person who buys an event (the “host”) a private page and QR code. Guests use it to upload
        photos and videos, and the host views and downloads them from a password-protected dashboard. Guests do not need an
        account.
      </p>

      <h2>Plans, hosting and storage</h2>
      <ul>
        <li>Party Drop: uploads open 3 months, gallery hosted 6 months, up to 5 GB.</li>
        <li>Wedding Drop: uploads open 12 months, gallery hosted 12 months, up to 25 GB.</li>
        <li>Forever Keepsake: uploads open 12 months, gallery hosted 2 years, up to 50 GB.</li>
        <li>Extend Hosting: $19 adds 12 more months of hosting.</li>
      </ul>
      <p>
        Time periods start on the event date, or on the purchase date if the event has already happened. When an album
        reaches its storage limit, it stops accepting new uploads. Prices are one-time charges, not subscriptions.
      </p>

      <h2>How long files are kept and when they are deleted</h2>
      <p>
        Photos and videos stay available until the hosting end date shown in your dashboard. We permanently delete all of an
        event’s photos and videos 30 days after its hosting end date. We email the host at the address used at checkout about
        30 days and again about 7 days before deletion. Files are never deleted until at least 7 days after that second
        email. Deleted files cannot be recovered, so download everything you want to keep before then.
      </p>

      <h2>Who owns the photos</h2>
      <p>
        Guests keep ownership of the photos and videos they upload. By uploading, a guest gives the host a permanent,
        free permission to keep, download, copy and share those files for personal use. The guest also gives us a limited
        permission to store, process and display the files only to provide the service to the host. We do not sell guest
        uploads, use them in advertising, or share them publicly.
      </p>
      <p>Only upload photos and videos you took yourself or have the right to share.</p>

      <h2>Acceptable use</h2>
      <p>
        Do not upload anything illegal, anything that infringes someone else’s rights, sexual content involving minors,
        malware, or content meant to harass or harm someone. We may remove content or close an event that breaks these
        rules, and we may report illegal content to the authorities.
      </p>

      <h2>Removing content</h2>
      <p>
        Hosts can hide any photo or video from their album at any time from the dashboard. To have a file permanently
        removed, the host, or a guest who uploaded it or appears in it, can email <Mail /> with the event name and a
        description of the file. We aim to respond within 5 business days. Hosts can also ask us to delete their whole event
        early.
      </p>

      <h2>Your account and password</h2>
      <p>
        The host is responsible for keeping the dashboard password private and for anyone who signs in with it. Use “Forgot
        password” on the sign-in page if you lose it.
      </p>

      <h2>Payments and refunds</h2>
      <p>
        Payments are processed by Stripe. We never see or store your card number. Refunds follow our{' '}
        <Link to="/refunds">Refund Policy</Link>.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep the service running and your files safe, but the service is provided “as is”. We recommend
        downloading your photos rather than relying on us as your only copy. To the extent the law allows, our total
        liability for any claim is limited to the amount you paid for the event involved.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change materially affects an event you already bought, we will email the host before
        it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        {COMPANY}, {MAILING_ADDRESS}. Email <Mail />. These terms are governed by the laws of the State of Kansas.
      </p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p>This policy explains what Guest Photo Drop, operated by {COMPANY}, collects and how it is used.</p>

      <h2>What we collect</h2>
      <ul>
        <li>From hosts: email address, event name, event date, page wording and colors, and a scrambled (hashed) dashboard password. We never store your password itself.</li>
        <li>From guests: the photos and videos they upload, an optional name, the file details (such as size and type) and the browser type, used to keep uploads working and secure.</li>
        <li>For security: your internet address may be used briefly to limit repeated password attempts.</li>
        <li>For payments: Stripe handles card details. We receive confirmation of payment and the amount, not your card number.</li>
        <li>For partner referrals: if you arrive through a partner link, your browser remembers that partner for 60 days so they can be credited for your purchase.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run the service: show the event page, store uploads, let the host view and download them, send account emails
        (such as password resets and deletion warnings), take payment, and prevent abuse. We do not sell personal information
        and we do not run advertising trackers.
      </p>

      <h2>Who can see uploads</h2>
      <p>
        Only the host, through the password-protected dashboard. Event pages are hidden from search engines, and guests cannot
        see each other’s uploads.
      </p>

      <h2>Service providers</h2>
      <p>
        We use trusted providers to run the service: Netlify (website hosting), Cloudinary (photo and video storage), Airtable
        (event records), Stripe (payments) and Resend (email). They process data only on our behalf.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        We use a secure sign-in cookie for the host dashboard. Your browser may also keep upload progress and a partner
        referral code. We do not use advertising cookies.
      </p>

      <h2>How long we keep data</h2>
      <p>
        Photos and videos are deleted 30 days after the event’s hosting end date, after the warning emails described in our{' '}
        <Link to="/terms">Terms of Service</Link>. Order and payment records are kept as long as needed for tax and accounting.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask to see, correct or delete your information, or ask us to remove a photo or video you uploaded or appear in,
        by emailing <Mail />. Guest Photo Drop is not meant for children under 13 to use on their own.
      </p>

      <h2>Contact</h2>
      <p>
        {COMPANY}, {MAILING_ADDRESS}. Email <Mail />.
      </p>
    </>
  );
}

function Refunds() {
  return (
    <>
      <h2>Event plans</h2>
      <ul>
        <li>
          <strong>Before any uploads:</strong> if no guest has uploaded a photo or video yet, you can get a full refund within 14
          days of purchase.
        </li>
        <li>
          <strong>After uploads start:</strong> once guests have uploaded, the purchase is not refundable, because storage and
          hosting are already in use.
        </li>
        <li>
          <strong>If it doesn’t work:</strong> if Guest Photo Drop does not work as described for your event and we cannot fix
          it, we refund you in full.
        </li>
      </ul>

      <h2>Hosting extensions</h2>
      <p>A $19 hosting extension can be refunded within 14 days of purchase.</p>

      <h2>How to ask</h2>
      <p>
        Email <Mail /> from the address you used at checkout, with your event name. Approved refunds go back to your original
        payment method through Stripe, usually within 5 to 10 business days. When an event plan is refunded, the event is
        closed and its files are deleted.
      </p>
    </>
  );
}

const DOCS = {
  terms: { title: 'Terms of Service', Body: Terms },
  privacy: { title: 'Privacy Policy', Body: Privacy },
  refunds: { title: 'Refund Policy', Body: Refunds },
};

export default function Legal({ doc }) {
  const { title, Body } = DOCS[doc];
  useEffect(() => {
    document.title = `${title} · Guest Photo Drop`;
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="site">
      <SiteHeader />
      <main className="legal wide">
        <h1 className="home-h2">{title}</h1>
        <p className="muted small">Last updated {UPDATED}</p>
        <Body />
      </main>
      <SiteFooter />
    </div>
  );
}
