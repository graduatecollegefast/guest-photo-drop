import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';
import { SUPPORT_EMAIL } from '../utils/support.js';

const GUEST_GUIDES = [
  ['How do I upload?', (
    <ol>
      <li>Scan the QR code at the event, or open the link the hosts shared.</li>
      <li>Tap <strong>Add your photos &amp; videos</strong> and choose them from your phone. You can pick many at once.</li>
      <li>Add your name if you like, then tap <strong>Upload</strong>.</li>
      <li>Keep the page open until each file shows as done. You’ll see a thank-you message when everything is in.</li>
    </ol>
  )],
  ['Do I need an app or an account?', <p>No. It works in your phone’s web browser. There’s nothing to install and no sign-up.</p>],
  ['What can I upload?', <p>Photos (JPG, PNG, HEIC, WebP) up to 10 MB each and videos (MP4, MOV, M4V, 3GP, WebM) up to 100 MB each, as many as 50 at a time. Some events accept only photos or only videos.</p>],
  ['An upload failed. What do I do?', <p>Each file uploads on its own and retries automatically. If one still fails, tap <strong>Try again</strong> on just that file. Your other files are safe. Weak venue Wi-Fi is the usual cause, so switching to mobile data often helps.</p>],
  ['It says the album is full or uploads are closed.', <p>The hosts’ album has reached its storage limit or its upload period has ended. Please let the hosts know; they can contact us.</p>],
  ['Who can see my photos?', <p>Only the hosts, from their private dashboard. Guests can’t see each other’s uploads, and event pages don’t show up in search engines.</p>],
  ['Can I remove something I uploaded?', <p>Yes. Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the event name and roughly when you uploaded it, and we’ll remove it.</p>],
];

const HOST_GUIDES = [
  ['How do I sign in?', <p>Go to your dashboard link (it looks like guestphotodrop.com/dashboard/your-event) or tap <Link to="/dashboard">Sign in</Link> at the top of our site and enter your event link. Then type the password you chose at checkout.</p>],
  ['I forgot my password.', <p>On the sign-in page, tap <strong>Forgot password?</strong> and enter the email you used at checkout. We’ll email you a link to choose a new one. It works once and expires in 1 hour.</p>],
  ['How do I download everything?', (
    <ol>
      <li>Sign in and tap <strong>Download all</strong>.</li>
      <li>Tap <strong>Prepare download</strong>. Your photos and videos are bundled into ZIP files in their original quality.</li>
      <li>Tap each part to save it. Large albums are split into several parts.</li>
      <li>Links work for about an hour. If one stops working, tap <strong>Refresh links</strong>.</li>
    </ol>
  )],
  ['How do I hide a photo or video?', <p>In <strong>View gallery</strong>, open the item and tap <strong>Hide</strong>. Hidden items stay safe in the <strong>Hidden</strong> tab and are left out of downloads. Open one and tap <strong>Restore</strong> to bring it back.</p>],
  ['Where is my QR code?', <p>Open <strong>Event settings</strong> and tap <strong>Download QR code</strong> to save a print-ready image, or <strong>Copy link</strong> to share it by text or email.</p>],
  ['How do I change my headline, message or colors?', <p>Open <strong>Event settings</strong>, go to <strong>Edit your page</strong>, make your changes and tap <strong>Save changes</strong>. Guests see them within a minute.</p>],
  ['How do I add a photo of us to the page?', <p>Open <strong>Event settings</strong> and tap <strong>Add your photo</strong> under <strong>Your photo</strong>. It shows at the top of your guest page.</p>],
  ['How long do my photos stay online?', <p>Until the “Gallery hosted until” date in your dashboard. Files are permanently deleted 30 days after that date, and we email you about 30 and 7 days before. Download everything before then.</p>],
  ['Can I keep my gallery longer?', <p>Yes. In <strong>Event settings</strong>, tap <strong>Extend hosting</strong> to add 12 more months for $19.</p>],
  ['What happens when my album is full?', <p>Each plan has a storage limit (Party Drop 5 GB, Wedding Drop 25 GB, Forever Keepsake 50 GB). Your dashboard shows how much you’ve used. When it’s full, guests can’t add more. Email us if you need help.</p>],
];

function Guides({ id, title, intro, items }) {
  return (
    <section className="help-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="home-h2">{title}</h2>
      <p className="muted">{intro}</p>
      <div className="faq">
        {items.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <div className="faq-answer">{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function Help() {
  const { hash } = useLocation();
  useEffect(() => {
    document.title = 'Help · Guest Photo Drop';
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <div className="site">
      <SiteHeader />
      <main className="legal wide">
        <h1 className="home-h2">Help center</h1>
        <p className="help-jump">
          <a href="#guests" className="btn btn-secondary">I’m a guest</a>
          <a href="#hosts" className="btn btn-secondary">I’m a host</a>
        </p>
        <Guides id="guests" title="For guests" intro="Adding photos and videos to an event." items={GUEST_GUIDES} />
        <Guides id="hosts" title="For hosts" intro="Managing your album from the dashboard." items={HOST_GUIDES} />
        <section className="card help-contact" aria-labelledby="contact-title">
          <h2 id="contact-title" className="section-title">Still need help?</h2>
          <p>
            Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and include your event name.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
