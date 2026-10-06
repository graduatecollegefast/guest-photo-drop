import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';
import { api } from '../services/api.js';
import { PLANS, EVENT_TYPES, THEMES, slugPreview } from '../utils/plans.js';

const MIN_DATE = new Date(Date.now() - 364 * 86400000).toISOString().slice(0, 10);

export default function Start() {
  const [params] = useSearchParams();
  const initialPlan = PLANS.some((p) => p.key === params.get('plan')) ? params.get('plan') : 'wedding';
  const [plan, setPlan] = useState(initialPlan);
  const [eventType, setEventType] = useState(initialPlan === 'party' ? 'Birthday' : 'Wedding');
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [headline, setHeadline] = useState('');
  const [theme, setTheme] = useState(THEMES[0].name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Create your event · Guest Photo Drop';
  }, []);

  const isWedding = eventType === 'Wedding';
  const chosen = PLANS.find((p) => p.key === plan);
  const fullName = isWedding ? [name1.trim(), name2.trim()].filter(Boolean).join(' & ') : eventName.trim();
  const preview = useMemo(() => slugPreview(fullName) || 'your-event', [fullName]);

  const pickPlan = (key) => {
    setPlan(key);
    if (key === 'party' && eventType === 'Wedding') setEventType('Birthday');
    if (key !== 'party' && eventType !== 'Wedding') setEventType('Wedding');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isWedding && (!name1.trim() || !name2.trim())) return setError('Please enter both names.');
    if (!isWedding && fullName.length < 2) return setError('Please enter a name for your event.');
    if (!eventDate) return setError('Please choose your event date.');
    if (password.trim().length < 8) return setError('Your dashboard password needs at least 8 characters.');
    setBusy(true);
    try {
      const res = await api.createCheckout({ plan, eventType, eventName: fullName, eventDate, headline, theme, email, password });
      window.location.assign(res.url);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="site">
      <SiteHeader />
      <main className="start-page">
        <h1 className="home-h2">Create your event</h1>
        {params.get('canceled') && (
          <p className="notice" role="status">
            Checkout was canceled. Nothing was charged. You can pick up where you left off.
          </p>
        )}
        <form className="card start-form" onSubmit={submit} noValidate>
          <fieldset className="plan-pick">
            <legend className="field-label">Plan</legend>
            {PLANS.map((p) => (
              <label key={p.key} className={`plan-option ${plan === p.key ? 'is-on' : ''}`}>
                <input type="radio" name="plan" value={p.key} checked={plan === p.key} onChange={() => pickPlan(p.key)} />
                <span className="plan-name">{p.name}</span>
                <span className="plan-price">${p.price}</span>
                <span className="plan-for">{p.points[1] || p.points[0]}</span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span className="field-label">Type of event</span>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_TYPES.filter((t) => (plan === 'party' ? t !== 'Wedding' : true)).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>

          {isWedding ? (
            <div className="two-col">
              <label className="field">
                <span className="field-label">First name</span>
                <input value={name1} onChange={(e) => setName1(e.target.value)} placeholder="Jordan" maxLength={28} required />
              </label>
              <label className="field">
                <span className="field-label">Partner’s first name</span>
                <input value={name2} onChange={(e) => setName2(e.target.value)} placeholder="Taylor" maxLength={28} required />
              </label>
            </div>
          ) : (
            <label className="field">
              <span className="field-label">Event name</span>
              <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Maya’s 30th" maxLength={60} required />
            </label>
          )}

          <label className="field">
            <span className="field-label">Event date</span>
            <input type="date" value={eventDate} min={MIN_DATE} onChange={(e) => setEventDate(e.target.value)} required />
          </label>

          <label className="field">
            <span className="field-label">Headline on your page (optional)</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={isWedding ? 'Help us remember the day through your eyes.' : 'Share your favorite moments with us.'}
              maxLength={100}
            />
          </label>

          <fieldset className="theme-pick">
            <legend className="field-label">Colors</legend>
            {THEMES.map((t) => (
              <label key={t.name} className={`theme-option ${theme === t.name ? 'is-on' : ''}`}>
                <input type="radio" name="theme" value={t.name} checked={theme === t.name} onChange={() => setTheme(t.name)} />
                <span className="swatches" aria-hidden="true">
                  {t.swatch.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span>{t.name}</span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span className="field-label">Your email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
          </label>

          <label className="field">
            <span className="field-label">Dashboard password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            <span className="muted small">At least 8 characters. You’ll use it to see and download your photos.</span>
          </label>

          <p className="link-preview">
            Your guest link: <strong>guestphotodrop.com/event/{preview}</strong>
          </p>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Opening secure checkout…' : `Continue to payment · $${chosen.price}`}
          </button>
          <p className="muted small center">Secure payment by Stripe. One-time charge, no subscription.</p>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
