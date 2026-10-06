import React from 'react';
import { Link } from 'react-router-dom';
import { HeartTrio } from './Hearts.jsx';
import { SUPPORT_EMAIL } from '../utils/support.js';

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Guest Photo Drop home">
        <HeartTrio size={14} />
        <span>Guest Photo Drop</span>
      </Link>
      <nav className="site-nav" aria-label="Main">
        <a href="/#pricing">Pricing</a>
        <Link to="/help">Help</Link>
        <Link to="/dashboard">Sign in</Link>
        <Link to="/start" className="btn btn-primary btn-small-nav">
          Create your event
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <strong>Guest Photo Drop</strong> · Your guests’ photos, all in one private album.
      </p>
      <nav className="footer-links" aria-label="Footer">
        <Link to="/help">Help</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/refunds">Refunds</Link>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </nav>
      <p className="muted small">A product of The Digital Comeback.</p>
    </footer>
  );
}
