import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { formatDate, formatBytes } from '../utils/format.js';

// Private owner page: every event with revenue and storage, plus support actions.
// Protected by ADMIN_PASSWORD (set in Netlify). Not linked anywhere and hidden from search.

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const STATUS = { active: 'Active', closed: 'Uploads closed', expired: 'Expired', draft: 'Unpaid draft' };

function AdminLogin({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.adminLogin(password);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not sign in.');
      setBusy(false);
    }
  };
  return (
    <main className="dash-login">
      <form className="card login-card" onSubmit={submit} aria-labelledby="admin-title">
        <h1 id="admin-title" className="names small-names">Admin</h1>
        <p className="login-event-name">Guest Photo Drop</p>
        <label className="field">
          <span className="field-label">Admin password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function StorageBar({ storage }) {
  const pct = Math.min(100, Math.round((storage.usedBytes / storage.capBytes) * 100));
  return (
    <div className="storage-cell">
      <span>{formatBytes(storage.usedBytes)} of {formatBytes(storage.capBytes)}</span>
      <span className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

function EventRow({ ev, onAction, busy }) {
  const paid = ev.status !== 'draft';
  return (
    <tr>
      <td data-label="Event">
        <strong>{ev.name}</strong>
        <div className="muted small">
          <a href={`/e/${ev.slug}`} target="_blank" rel="noopener">/e/{ev.slug}</a> · {ev.eventType} · {ev.plan}
          {ev.referralCode && ` · ref: ${ev.referralCode}`}
        </div>
        <div className="muted small">{ev.ownerEmail}</div>
      </td>
      <td data-label="Status"><span className={`pill pill-${ev.status}`}>{STATUS[ev.status] || ev.status}</span></td>
      <td data-label="Dates" className="small">
        <div>Event: {formatDate(ev.eventDate) || 'n/a'}</div>
        <div>Hosted until: {formatDate(ev.hostingEndDate) || 'n/a'}</div>
        <div>{ev.filesDeletedOn ? `Deleted ${formatDate(ev.filesDeletedOn)}` : ev.deleteOnDate ? `Deletes ${formatDate(ev.deleteOnDate)}` : ''}</div>
      </td>
      <td data-label="Uploads">{ev.uploads.toLocaleString()}</td>
      <td data-label="Storage"><StorageBar storage={ev.storage} /></td>
      <td data-label="Revenue">{money(ev.revenue)}</td>
      <td data-label="Actions">
        {paid ? (
          <div className="admin-actions">
            <button type="button" className="btn btn-small btn-secondary" disabled={busy || Boolean(ev.filesDeletedOn)} onClick={() => onAction(ev, 'extend')}>
              Extend 12 months
            </button>
            <button type="button" className="btn btn-small btn-secondary" disabled={busy} onClick={() => onAction(ev, 'reset_password')}>
              Reset password
            </button>
            <button type="button" className="btn btn-small btn-secondary" disabled={busy || ev.status !== 'active'} onClick={() => onAction(ev, 'close')}>
              Close event
            </button>
          </div>
        ) : (
          <span className="muted small">Checkout not finished</span>
        )}
      </td>
    </tr>
  );
}

const CONFIRM = {
  extend: (ev) => `Add 12 months of hosting to "${ev.name}" at no charge?`,
  reset_password: (ev) => `Send a password reset link for "${ev.name}" to ${ev.ownerEmail || 'the host'}?`,
  close: (ev) => `Close uploads for "${ev.name}" now? Guests won't be able to add more. The gallery stays available until hosting ends.`,
};

export default function Admin() {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [query, setQuery] = useState('');
  const [showDrafts, setShowDrafts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    document.title = 'Admin · Guest Photo Drop';
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.adminData();
      setState({ status: 'ready', data, error: '' });
    } catch (err) {
      if (err.status === 401) setState({ status: 'login', data: null, error: '' });
      else setState({ status: 'error', data: null, error: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const events = useMemo(() => {
    if (!state.data) return [];
    const q = query.trim().toLowerCase();
    return state.data.events.filter(
      (e) => (showDrafts || e.status !== 'draft') && (!q || [e.name, e.slug, e.ownerEmail, e.referralCode].some((v) => String(v || '').toLowerCase().includes(q)))
    );
  }, [state.data, query, showDrafts]);

  const onAction = async (ev, action) => {
    if (!window.confirm(CONFIRM[action](ev))) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api.adminAction(ev.slug, action);
      setResult({ ok: true, message: res.message, link: res.emailed === false ? res.link : null });
      await load();
    } catch (err) {
      if (err.status === 401) setState({ status: 'login', data: null, error: '' });
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (state.status === 'loading') return <div className="page-loading" role="status">Loading…</div>;
  if (state.status === 'login') return <AdminLogin onDone={load} />;
  if (state.status === 'error') {
    return (
      <main className="dash">
        <section className="card center-card">
          <p>{state.error || 'Could not load the admin page.'}</p>
          <button type="button" className="btn btn-primary" onClick={load}>Try again</button>
        </section>
      </main>
    );
  }

  const t = state.data.totals;
  return (
    <main className="dash admin">
      <header className="dash-header">
        <div>
          <h1 className="names dash-names">Admin</h1>
          <p className="date">Guest Photo Drop</p>
        </div>
        <button
          type="button"
          className="btn btn-link"
          onClick={async () => {
            await api.adminLogout().catch(() => {});
            setState({ status: 'login', data: null, error: '' });
          }}
        >
          Sign out
        </button>
      </header>

      <section className="admin-totals" aria-label="Totals">
        <div className="card"><p className="stat-label">Paid events</p><p className="stat-number small">{t.events}</p><p className="stat-note">{t.active} accepting uploads</p></div>
        <div className="card"><p className="stat-label">Revenue</p><p className="stat-number small">{money(t.revenue)}</p><p className="stat-note">Paid orders</p></div>
        <div className="card"><p className="stat-label">Storage used</p><p className="stat-number small">{formatBytes(t.storageBytes)}</p><p className="stat-note">All events</p></div>
        <div className="card"><p className="stat-label">Unpaid drafts</p><p className="stat-number small">{t.unpaidDrafts}</p><p className="stat-note">Checkout not finished</p></div>
      </section>

      {result && (
        <div className={result.ok ? 'notice notice-good' : 'form-error'} role="status">
          <p>{result.message}</p>
          {result.link && (
            <p className="reset-link">
              <input readOnly value={result.link} onFocus={(e) => e.target.select()} aria-label="Reset link" />
              <button type="button" className="btn btn-small" onClick={() => navigator.clipboard?.writeText(result.link)}>Copy</button>
            </p>
          )}
        </div>
      )}

      <div className="admin-tools">
        <label className="field admin-search">
          <span className="field-label">Search</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, link, email or ref code" />
        </label>
        <label className="agree">
          <input type="checkbox" checked={showDrafts} onChange={(e) => setShowDrafts(e.target.checked)} />
          <span>Show unpaid drafts</span>
        </label>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={busy}>Refresh</button>
      </div>

      <div className="card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Status</th>
              <th scope="col">Dates</th>
              <th scope="col">Uploads</th>
              <th scope="col">Storage</th>
              <th scope="col">Revenue</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <EventRow key={ev.slug} ev={ev} onAction={onAction} busy={busy} />
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="empty">No events match.</p>}
      </div>
    </main>
  );
}
