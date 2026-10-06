import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteChrome.jsx';
import { HeartTrio } from '../components/Hearts.jsx';
import { api } from '../services/api.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Welcome() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const [state, setState] = useState({ status: 'checking', data: null, error: '' });
  const canvasRef = useRef(null);

  useEffect(() => {
    document.title = 'You’re all set · Guest Photo Drop';
    let stop = false;
    (async () => {
      for (let i = 0; i < 12 && !stop; i++) {
        try {
          const res = await api.checkoutStatus(sessionId);
          if (res.paid) return !stop && setState({ status: 'ready', data: res, error: '' });
        } catch (err) {
          if (err.status === 400) return !stop && setState({ status: 'error', data: null, error: err.message });
        }
        await sleep(2500);
      }
      if (!stop) setState({ status: 'pending', data: null, error: '' });
    })();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  const guestUrl = state.data ? `${window.location.origin}/e/${state.data.slug}` : '';

  useEffect(() => {
    if (!guestUrl || !canvasRef.current) return;
    import('qrcode').then((QR) => QR.toCanvas(canvasRef.current, guestUrl, { width: 480, margin: 2 }));
  }, [guestUrl]);

  return (
    <div className="site">
      <SiteHeader />
      <main className="start-page">
        {state.status === 'checking' && (
          <section className="card center-card" role="status">
            <p>Confirming your payment…</p>
          </section>
        )}
        {state.status === 'pending' && (
          <section className="card center-card" role="status">
            <p>Your payment is still processing. Refresh this page in a minute.</p>
          </section>
        )}
        {state.status === 'error' && (
          <section className="card center-card" role="alert">
            <p>{state.error}</p>
            <Link to="/start" className="btn btn-primary">
              Back to start
            </Link>
          </section>
        )}
        {state.status === 'ready' && (
          <section className="card welcome-card">
            <p className="login-hearts">
              <HeartTrio size={26} />
            </p>
            <h1 className="names small-names">You’re all set!</h1>
            <p>
              <strong>{state.data.eventName}</strong> is live. Share this link or QR code with your guests.
            </p>
            <div className="qr-block">
              <canvas ref={canvasRef} className="qr" aria-label={`QR code for ${guestUrl}`} role="img" />
              <div>
                <p className="field-label">Guest link</p>
                <p className="guest-url">{guestUrl}</p>
                <div className="actions inline">
                  <button type="button" className="btn btn-secondary" onClick={() => navigator.clipboard && navigator.clipboard.writeText(guestUrl)}>
                    Copy link
                  </button>
                  <a className="btn btn-secondary" href={guestUrl}>
                    View your page
                  </a>
                </div>
              </div>
            </div>
            <Link to={`/dashboard/${state.data.slug}`} className="btn btn-primary btn-block">
              Open your dashboard
            </Link>
            <p className="muted small center">
              Sign in with the password you chose. Bookmark your dashboard: {window.location.origin}/dashboard/{state.data.slug}
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
