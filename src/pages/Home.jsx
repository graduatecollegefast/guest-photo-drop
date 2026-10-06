import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';
import { Heart, HeartTrio, HeartDivider } from '../components/Hearts.jsx';
import { PLANS } from '../utils/plans.js';

const STEPS = [
  ['Create your page', 'Pick a plan, add your names and date, and choose your colors. Your page is ready in minutes.'],
  ['Share your QR code', 'Print your QR code for tables, signs and programs. Guests scan it with their phone camera.'],
  ['Guests drop their photos', 'Photos and videos go straight into your private album. Download every original anytime.'],
];

const INCLUDED = [
  'Unlimited photos and videos',
  'Full-quality originals, never compressed',
  'Download everything in one click',
  'Private: not public or searchable',
  'Your own photo at the top of your page',
  'Four color themes to match your event',
  'Printable QR code',
  'Works on weak venue Wi-Fi with automatic retries',
];

const FAQ = [
  ['Do guests need an app or an account?', 'No. Guests scan your QR code, tap the button and choose their photos. That’s it.'],
  ['Who can see the photos?', 'Only you, from your password-protected dashboard. Your page isn’t listed or searchable.'],
  ['What if the Wi-Fi is bad?', 'Each photo uploads on its own and retries automatically. If one fails, guests tap to retry just that one.'],
  ['Is this a subscription?', 'No. You pay once per event. Hosting length depends on your plan.'],
];

export default function Home() {
  useEffect(() => {
    document.title = 'Guest Photo Drop · Every guest’s photos in one private album';
  }, []);
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="eyebrow">For weddings and every celebration</p>
            <h1 className="home-title">Every guest’s photos. One private album.</h1>
            <p className="home-sub">
              Guests scan a QR code and drop their photos and videos straight into your album. No app. No account.
            </p>
            <div className="actions inline">
              <Link to="/start?plan=wedding" className="btn btn-primary">
                <Heart size={16} color="currentColor" /> Create your event
              </Link>
              <a href="#pricing" className="btn btn-secondary">
                See pricing
              </a>
            </div>
            <p className="muted small">One-time price per event. From $29.</p>
          </div>
          <div className="phone" aria-hidden="true">
            <div className="phone-screen">
              <HeartTrio size={18} />
              <p className="phone-names">JORDAN &amp; TAYLOR</p>
              <p className="phone-date">JUNE 12, 2027</p>
              <HeartDivider />
              <p className="phone-headline">“Help us remember the day through your eyes.”</p>
              <span className="phone-btn">Add your photos &amp; videos</span>
              <p className="phone-note">No app or account needed.</p>
            </div>
          </div>
        </section>

        <section className="home-section" aria-labelledby="how-title">
          <h2 id="how-title" className="home-h2">How it works</h2>
          <ol className="steps">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="step">
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section" id="pricing" aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="home-h2">Simple, one-time pricing</h2>
          <p className="home-lead">No subscription. Pay once per event.</p>
          <div className="pricing">
            {PLANS.map((p) => (
              <article key={p.key} className={`price-card ${p.popular ? 'is-popular' : ''}`}>
                {p.popular && <p className="badge">Most popular</p>}
                <h3>{p.name}</h3>
                <p className="price">
                  ${p.price}
                  <span> one time</span>
                </p>
                <p className="muted small">{p.for}</p>
                <ul>
                  {p.points.map((pt) => (
                    <li key={pt}>
                      <Heart size={12} /> {pt}
                    </li>
                  ))}
                </ul>
                <Link to={`/start?plan=${p.key}`} className={`btn ${p.popular ? 'btn-primary' : 'btn-secondary'} btn-block`}>
                  Choose {p.name}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="inc-title">
          <h2 id="inc-title" className="home-h2">Included with every event</h2>
          <ul className="included">
            {INCLUDED.map((x) => (
              <li key={x}>
                <span aria-hidden="true">✓</span> {x}
              </li>
            ))}
          </ul>
        </section>

        <section className="home-section" aria-labelledby="faq-title">
          <h2 id="faq-title" className="home-h2">Questions</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="home-cta">
          <h2 className="home-h2">Ready for your guests’ photos?</h2>
          <Link to="/start?plan=wedding" className="btn btn-primary">
            Create your event
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
