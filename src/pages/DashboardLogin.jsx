import React, { useState } from 'react';
import { HeartTrio } from '../components/Hearts.jsx';

// "The Wedding Album", "The Birthday Album", and so on. "Other" reads "The Event Album".
export function albumTitle(eventType) {
  if (!eventType || eventType === 'Other') return 'The Event Album';
  return `The ${eventType} Album`;
}

export default function DashboardLogin({ onLogin, expired, event }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await onLogin(password);
    } catch (err) {
      setError(err.code === 'wrong_password' ? 'That password is not right. Please try again.' : err.message || 'Could not sign in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <main className="dash-login">
      <form className="card login-card" onSubmit={submit} aria-labelledby="login-title">
        <p className="login-hearts"><HeartTrio size={24} /></p>
        <h1 id="login-title" className="names small-names">{event ? albumTitle(event.eventType) : 'Your Event Album'}</h1>
        {event && <p className="login-event-name">{event.name}</p>}
        {expired && <p className="notice" role="status">Your session ended. Please sign in again.</p>}
        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
