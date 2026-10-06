import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';
import { HeartTrio, HeartDivider, IconContext, ICON_NAMES, Heart } from '../components/Hearts.jsx';
import { api } from '../services/api.js';
import { PLANS, EVENT_TYPES, NAME_EXAMPLES, HEADLINE_EXAMPLES, DEFAULT_ICON, slugPreview } from '../utils/plans.js';
import { COLOR_DOTS, STARTER_SETS, DEFAULT_COLORS, themeVars } from '../utils/palette.js';
import { formatDate } from '../utils/format.js';

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
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [icon, setIcon] = useState(DEFAULT_ICON[initialPlan === 'party' ? 'Birthday' : 'Wedding']);
  const [iconTouched, setIconTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Create your event · Guest Photo Drop';
  }, []);

  // The icon follows the event type until the customer picks one themselves.
  useEffect(() => {
    if (!iconTouched) setIcon(DEFAULT_ICON[eventType]);
  }, [eventType, iconTouched]);

  const isWedding = eventType === 'Wedding';
  const chosen = PLANS.find((p) => p.key === plan);
  const fullName = isWedding ? [name1.trim(), name2.trim()].filter(Boolean).join(' & ') : eventName.trim();
  const preview = useMemo(() => slugPreview(fullName) || 'your-event', [fullName]);
  const previewVars = useMemo(() => themeVars(colors), [colors]);

  const pickPlan = (key) => {
    setPlan(key);
    if (key === 'party' && eventType === 'Wedding') setEventType('Birthday');
    if (key !== 'party' && eventType !== 'Wedding') setEventType('Wedding');
  };

  const toggleColor = (name) => {
    setError('');
    setColors((cur) => {
      if (cur.includes(name)) return cur.filter((c) => c !== name);
      if (cur.length >= 3) return [...cur.slice(1), name]; // keep the newest three
      return [...cur, name];
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isWedding && (!name1.trim() || !name2.trim())) return setError('Please enter both names.');
    if (!isWedding && fullName.length < 2) return setError('Please enter a name for your event.');
    if (!eventDate) return setError('Please choose your event date.');
    if (colors.length < 2) return setError('Please pick 2 or 3 colors.');
    if (password.trim().length < 8) return setError('Your dashboard password needs at least 8 characters.');
    setBusy(true);
    try {
      const res = await api.createCheckout({ plan, eventType, eventName: fullName, eventDate, headline, colors, icon, email, password });
      window.location.assign(res.url);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const previewName = fullName || (isWedding ? 'Jordan & Taylor' : NAME_EXAMPLES[eventType]);

  return (
    <div className="site">
      <SiteHeader />
      <main className="start-page wide">
        <h1 className="home-h2">Create your event</h1>
        {params.get('canceled') && (
          <p className="notice" role="status">
            Checkout was canceled. Nothing was charged. You can pick up where you left off.
          </p>
        )}
        <div className="start-grid">
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
                <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={NAME_EXAMPLES[eventType]} maxLength={60} required />
              </label>
            )}

            <label className="field">
              <span className="field-label">Event date</span>
              <input type="date" value={eventDate} min={MIN_DATE} onChange={(e) => setEventDate(e.target.value)} required />
            </label>

            <label className="field">
              <span className="field-label">Headline on your page (optional)</span>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={HEADLINE_EXAMPLES[eventType]} maxLength={100} />
            </label>

            <fieldset className="color-pick">
              <legend className="field-label">Your colors: pick 2 or 3</legend>
              <div className="starter-sets" role="group" aria-label="Starter color sets">
                {STARTER_SETS.map((set) => {
                  const on = set.colors.length === colors.length && set.colors.every((c) => colors.includes(c));
                  return (
                    <button key={set.name} type="button" className={`starter ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setColors(set.colors)}>
                      <span className="mini-dots" aria-hidden="true">
                        {set.colors.map((c) => (
                          <i key={c} style={{ background: COLOR_DOTS.find((d) => d.name === c).hex }} />
                        ))}
                      </span>
                      {set.name}
                    </button>
                  );
                })}
              </div>
              <div className="dots">
                {COLOR_DOTS.map((d) => {
                  const on = colors.includes(d.name);
                  return (
                    <button
                      key={d.name}
                      type="button"
                      className={`dot ${on ? 'is-on' : ''}`}
                      aria-pressed={on}
                      aria-label={d.name}
                      title={d.name}
                      onClick={() => toggleColor(d.name)}
                    >
                      <span className="swatch" style={{ background: d.hex }} />
                      <span className="dot-name">{d.name}</span>
                      {on && <span className="dot-check" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="muted small">Picked: {colors.length ? colors.join(', ') : 'none yet'}</p>
            </fieldset>

            <fieldset className="icon-pick">
              <legend className="field-label">Icon</legend>
              <div className="icons">
                {ICON_NAMES.map((n) => (
                  <label key={n} className={`icon-option ${icon === n ? 'is-on' : ''}`}>
                    <input
                      type="radio"
                      name="icon"
                      value={n}
                      checked={icon === n}
                      onChange={() => {
                        setIcon(n);
                        setIconTouched(true);
                      }}
                    />
                    <Heart icon={n} size={26} color="var(--primary)" />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
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
              Your guest link: <strong>guestphotodrop.com/e/{preview}</strong>
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

          <aside className="preview-col" aria-label="Preview of your guest page">
            <p className="field-label center">Live preview</p>
            <IconContext.Provider value={icon}>
              <div className="phone preview-phone" style={previewVars}>
                <div className="phone-screen">
                  <HeartTrio size={18} />
                  <p className="phone-names">{previewName.toUpperCase()}</p>
                  <p className="phone-date">{eventDate ? formatDate(eventDate).toUpperCase() : 'YOUR DATE'}</p>
                  <HeartDivider />
                  <p className="phone-headline">“{headline || HEADLINE_EXAMPLES[eventType]}”</p>
                  <span className="phone-btn">Add your photos &amp; videos</span>
                  <p className="phone-note">No app or account needed.</p>
                </div>
              </div>
            </IconContext.Provider>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
