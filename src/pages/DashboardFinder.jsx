import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';

// /dashboard with no event: ask for the event link, then go to /dashboard/<slug>.
export default function DashboardFinder() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    const m = value.trim().toLowerCase().match(/([a-z0-9][a-z0-9-]{1,78}[a-z0-9])\/?$/);
    if (!m) return setError('Paste your guest link or the last part of it, like jordan-and-taylor.');
    navigate(`/dashboard/${m[1]}`);
  };
  return (
    <div className="site">
      <SiteHeader />
      <main className="start-page">
        <form className="card login-card" onSubmit={submit}>
          <h1 className="names small-names">Sign in to your event</h1>
          <label className="field">
            <span className="field-label">Your guest link</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="guestphotodrop.com/event/jordan-and-taylor" required />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary">
            Continue
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
