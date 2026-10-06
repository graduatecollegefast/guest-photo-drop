import React, { useState } from 'react';
import { HeartTrio } from '../components/Hearts.jsx';
import { api } from '../services/api.js';
import { SUPPORT_EMAIL } from '../utils/support.js';

// "The Wedding Album", "The Birthday Album", and so on. "Other" reads "The Event Album".
export function albumTitle(eventType) {
  if (!eventType || eventType === 'Other') return 'The Event Album';
  return `The ${eventType} Album`;
}

function LoginHeader({ event }) {
  return (
    <>
      <p className="login-hearts"><HeartTrio size={24} /></p>
      <h1 id="login-title" className="names small-names">{event ? albumTitle(event.eventType) : 'Your Event Album'}</h1>
      {event && <p className="login-event-name">{event.name}</p>}
    </>
  );
}

function ForgotForm({ slug, onBack }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState({ status: 'sending', message: '' });
    try {
      const res = await api.forgotPassword(slug, email.trim());
      setState({ status: 'sent', message: res.message });
    } catch (err) {
      setState({ status: 'error', message: err.message || 'Something went wrong. Please try again.' });
    }
  };
  return (
    <form onSubmit={submit} noValidate>
      <h2 className="login-sub">Reset your password</h2>
      {state.status === 'sent' ? (
        <p className="notice" role="status">{state.message}</p>
      ) : (
        <>
          <p className="muted small">Enter the email you used at checkout and we’ll send you a link to choose a new password.</p>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
          </label>
          {state.status === 'error' && <p className="form-error" role="alert">{state.message}</p>}
          <button type="submit" className="btn btn-primary" disabled={state.status === 'sending'}>
            {state.status === 'sending' ? 'Sending…' : 'Email me a reset link'}
          </button>
        </>
      )}
      <button type="button" className="btn btn-link" onClick={onBack}>Back to sign in</button>
    </form>
  );
}

export function ResetPasswordForm({ slug, token, event, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.trim().length < 8) return setError('Your new password needs at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    try {
      await api.resetPassword(slug, token, password);
      onDone();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };
  return (
    <main className="dash-login">
      <form className="card login-card" onSubmit={submit} aria-labelledby="login-title" noValidate>
        <LoginHeader event={event} />
        <h2 className="login-sub">Choose a new password</h2>
        <label className="field">
          <span className="field-label">New password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus required />
        </label>
        <label className="field">
          <span className="field-label">Type it again</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save and sign in'}
        </button>
        <p className="muted small">Signing in with the new password signs out any other devices.</p>
      </form>
    </main>
  );
}

export default function DashboardLogin({ onLogin, expired, event, slug }) {
  const [mode, setMode] = useState('login');
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
      <div className="card login-card" aria-labelledby="login-title">
        <LoginHeader event={event} />
        {mode === 'forgot' ? (
          <ForgotForm slug={slug} onBack={() => setMode('login')} />
        ) : (
          <form onSubmit={submit}>
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
            <button type="button" className="btn btn-link" onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          </form>
        )}
        <p className="login-help small">
          <a href="/help#hosts">Help for hosts</a> · <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </main>
  );
}
