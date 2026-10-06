import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEventTheme } from '../utils/theme.js';
import { useDashboardAuth } from '../hooks/useDashboardAuth.js';
import DashboardLogin from './DashboardLogin.jsx';
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

  useEffect(() => {
    document.title = auth.event ? `${auth.event.name} · Album` : 'Event album';
  }, [auth.event]);

  if (auth.status === 'checking') return <div className="page-loading" role="status">Loading…</div>;

  if (auth.status === 'anonymous') {
    return (
      <IconContext.Provider value={publicEvent?.icon || 'Hearts'}>
      <DashboardLogin
        event={publicEvent}
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

      {event.status === 'expired' && (
        <p className="notice" role="status">
          This gallery has expired. Uploads are closed. Download anything you want to keep.
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
    </main>
    </IconContext.Provider>
  );
}
