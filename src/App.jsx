import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import EventPage from './pages/EventPage.jsx';
import NotFound from './pages/NotFound.jsx';

// Guests on slow connections download only the upload page; everything else loads on demand.
const Home = lazy(() => import('./pages/Home.jsx'));
const Start = lazy(() => import('./pages/Start.jsx'));
const Welcome = lazy(() => import('./pages/Welcome.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const DashboardFinder = lazy(() => import('./pages/DashboardFinder.jsx'));

const wrap = (el) => <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>{el}</Suspense>;

// Older /event/<link> addresses still work and move to /e/<link>.
function OldEventLink() {
  const { slug } = useParams();
  return <Navigate to={`/e/${slug}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={wrap(<Home />)} />
      <Route path="/start" element={wrap(<Start />)} />
      <Route path="/welcome" element={wrap(<Welcome />)} />
      <Route path="/e/:slug" element={<EventPage />} />
      <Route path="/event/:slug" element={<OldEventLink />} />
      <Route path="/dashboard" element={wrap(<DashboardFinder />)} />
      <Route path="/dashboard/:slug" element={wrap(<Dashboard />)} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
