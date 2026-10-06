import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useEventTheme } from '../utils/theme.js';
import { useDashboardAuth } from '../hooks/useDashboardAuth.js';
import DashboardLogin, { ResetPasswordForm } from './DashboardLogin.jsx';
import { SUPPORT_EMAIL } from '../utils/support.js';
import { formatBytes } from '../utils/format.js';
import DashboardStats from '../components/DashboardStats.jsx';
import Gallery from '../components/Gallery.jsx';
import DownloadPanel from '../components/DownloadPanel.jsx';
import SettingsPanel from '../components/SettingsPanel.jsx';
import { formatDate } from '../utils/format.js';
import { Heart, IconContext } from '../components/Hearts.jsx';
import { api } from '../services/api.js';

export default function Dashboard() {
  const { slug } = useParams();
  const auth = useDashboardAuth(slug);
  // Public event details (name, type, colors, icon) so the sign-in page can show whose album it is.
  const [publicEvent, setPublicEvent] = useState(null);
  useEffect(() => {
    let live = true;
    if (slug) {
      api
        .getEvent(slug)
        .then((res) => live && res.event?.name && setPublicEvent(res.event))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [slug]);
  useEventTheme(auth.event?.colors || publicEvent?.colors);
  const [view, setView] = useState('gallery');
  const [expired, setExpired] = useState(false);
  const [params, setParams] = useSearchParams();
  const resetToken = params.get('reset');
  const extendedSession = params.get('extended');
  const [flash, setFlash] = useState('');

  // Back from Stripe after "Extend hosting": confirm the payment, then show the new date.
  useEffect(() => {
    if (!extendedSession || auth.status !== 'authed') return;
    let live = true;
    (async () => {
      for (let i = 0; i < 6 && live; i++) {
        try {
          const res = await api.checkoutStatus(extendedSession);
          if (res.paid) {
            await auth.refresh();
            if (live) setFlash(`Thank you! Your gallery is now hosted until ${formatDate(res.hostingEndDate)}.`);
            break;
          }
        } catch {
          /* try again */
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (live) setParams({}, { replace: true });
    })();
    return () => {
      live = false;
    };
  }, [extendedSession, auth.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = auth.event ? `${auth.event.name} · Album` : 'Event album';
  }, [auth.event]);

  if (resetToken) {
    return (
      <IconContext.Provider value={publicEvent?.icon || 'Hearts'}>
        <ResetPasswordForm
          slug={slug}
          token={resetToken}
          event={publicEvent}
          onDone={async () => {
            setParams({}, { replace: true });
            setExpired(false);
            setFlash('Your new password is saved.');
            await auth.refresh();
          }}
        />
      </IconContext.Provider>
    );
  }

  if (auth.status === 'checking') return <div className="page-loading" role="status">Loading…</div>;

  if (auth.status === 'anonymous') {
    return (
      <IconContext.Provider value={publicEvent?.icon || 'Hearts'}>
      <DashboardLogin
        event={publicEvent}
        slug={slug}
        expired={expired}
        onLogin={async (pw) => {
          await auth.login(pw);
          setExpired(false);
        }}
      />
      </IconContext.Provider>
    );
  }

  if (auth.status === 'error' || !auth.event) {
    return (
      <main className="dash">
        <section className="card center-card">
          <p>We couldn’t load your album. Please check your connection.</p>
          <button type="button" className="btn btn-primary" onClick={auth.refresh}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  const event = auth.event;
  const onUnauthorized = () => {
    setExpired(true);
    auth.expire();
  };

  return (
    <IconContext.Provider value={event.icon || 'Hearts'}>
    <main className="dash">
      <header className="dash-header">
        <div>
          <h1 className="names dash-names">
            {event.name} <Heart size={26} className="title-heart" />
          </h1>
          <p className="date">{formatDate(event.eventDate)}</p>
        </div>
        <button type="button" className="btn btn-link" onClick={auth.logout}>
          Sign out
        </button>
      </header>

      {flash && (
        <p className="notice notice-good" role="status">
          {flash}
        </p>
      )}
      {event.filesDeletedOn ? (
        <p className="notice" role="status">
          Hosting for this event ended and its photos and videos were permanently deleted on {formatDate(event.filesDeletedOn)}.
        </p>
      ) : (
        event.status === 'expired' && (
          <p className="notice" role="status">
            Hosting has ended and uploads are closed. Everything will be permanently deleted on {formatDate(event.deleteOnDate)}.
            Download what you want to keep, or extend hosting in Event settings.
          </p>
        )
      )}
      {!event.filesDeletedOn && event.storage?.full && (
        <p className="notice" role="status">
          Your album is full ({formatBytes(event.storage.capBytes)}), so guests can’t add more right now. Email {SUPPORT_EMAIL} if you need help.
        </p>
      )}

      <DashboardStats event={event} />

      <nav className="dash-nav" aria-label="Album sections">
        <button type="button" className={`btn ${view === 'gallery' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}>
          View gallery
        </button>
        <button type="button" className={`btn ${view === 'download' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={view === 'download'} onClick={() => setView('download')}>
          Download all
        </button>
        <button type="button" className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={view === 'settings'} onClick={() => setView('settings')}>
          Event settings
        </button>
      </nav>

      {view === 'gallery' && <Gallery onChanged={auth.refresh} onUnauthorized={onUnauthorized} />}
      {view === 'download' && <DownloadPanel onUnauthorized={onUnauthorized} />}
      {view === 'settings' && <SettingsPanel event={event} onChanged={auth.refresh} onUnauthorized={onUnauthorized} />}

      <footer className="dash-footer">
        <a href="/help#hosts">Help for hosts</a>
        <span aria-hidden="true"> · </span>
        <span>
          Support: <a href={`mailto:${event.supportEmail || SUPPORT_EMAIL}`}>{event.supportEmail || SUPPORT_EMAIL}</a>
        </span>
      </footer>
    </main>
    </IconContext.Provider>
  );
}
