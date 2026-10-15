import React, { useState } from 'react';
import { api } from '../services/api.js';

// "Download all": the server lists every visible file with a signed link, and the browser
// fetches them straight from storage and builds the ZIP files itself. Albums are split into
// parts of about 300 MB so phones and laptops can handle each one comfortably.
const PART_BYTES = 300 * 1024 * 1024;

export function splitIntoParts(files, partBytes = PART_BYTES) {
  const parts = [];
  for (const type of ['image', 'video']) {
    const list = files.filter((f) => f.type === type);
    let current = [];
    let size = 0;
    for (const f of list) {
      if (current.length && size + f.bytes > partBytes) {
        parts.push({ type, files: current, bytes: size });
        current = [];
        size = 0;
      }
      current.push(f);
      size += f.bytes;
    }
    if (current.length) parts.push({ type, files: current, bytes: size });
  }
  // Labels like "Photos, part 1 of 3".
  for (const type of ['image', 'video']) {
    const ofType = parts.filter((p) => p.type === type);
    ofType.forEach((p, i) => {
      const label = type === 'image' ? 'Photos' : 'Videos';
      p.label = ofType.length > 1 ? `${label}, part ${i + 1} of ${ofType.length}` : label;
      p.fileName = `${type === 'image' ? 'photos' : 'videos'}${ofType.length > 1 ? `-part-${i + 1}` : ''}.zip`;
    });
  }
  return parts;
}

const mb = (bytes) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`);

async function saveZip(part, eventName, onFile) {
  const { downloadZip } = await import('client-zip');
  let done = 0;
  async function* entries() {
    for (const f of part.files) {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`Could not fetch ${f.name}`);
      yield { name: f.name, input: res };
      done += 1;
      onFile(done);
    }
  }
  const zip = downloadZip(entries());
  const suggestedName = `${eventName}-${part.fileName}`;
  if (typeof window.showSaveFilePicker === 'function') {
    // Desktop Chrome and Edge: stream straight to disk.
    const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: 'ZIP file', accept: { 'application/zip': ['.zip'] } }] });
    const writable = await handle.createWritable();
    await zip.body.pipeTo(writable);
    return;
  }
  const blob = await zip.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function DownloadPanel({ onUnauthorized }) {
  const [state, setState] = useState({ status: 'idle', data: null, parts: [], error: '' });
  const [progress, setProgress] = useState({}); // label -> { done, status }

  const prepare = async () => {
    setState({ status: 'loading', data: null, parts: [], error: '' });
    setProgress({});
    try {
      const data = await api.prepareDownload();
      setState({ status: 'ready', data, parts: splitIntoParts(data.files), error: '' });
    } catch (err) {
      if (err.status === 401) return onUnauthorized();
      setState({ status: 'error', data: null, parts: [], error: 'We couldn’t prepare the download. Please try again.' });
    }
  };

  const download = async (part) => {
    const set = (patch) => setProgress((p) => ({ ...p, [part.label]: { ...(p[part.label] || {}), ...patch } }));
    set({ status: 'working', done: 0 });
    try {
      await saveZip(part, state.data.name, (done) => set({ done }));
      set({ status: 'done' });
    } catch (err) {
      if (err && err.name === 'AbortError') return set({ status: 'idle' });
      set({ status: 'error' });
    }
  };

  const busy = Object.values(progress).some((p) => p.status === 'working');

  return (
    <section className="card panel" aria-labelledby="dl-title">
      <h2 id="dl-title" className="section-title">Download all</h2>
      <p className="muted">
        Downloads include every visible photo and video as original files, in ZIP parts of about 300 MB. Hidden items are
        left out. Keep this page open while a part downloads.
      </p>

      {state.status !== 'ready' && (
        <button type="button" className="btn btn-primary" onClick={prepare} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Preparing…' : 'Prepare download'}
        </button>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <p>
            {state.data.totals.photos} photos and {state.data.totals.videos} videos.
          </p>
          {state.parts.length === 0 ? (
            <p className="muted">Nothing to download yet.</p>
          ) : (
            <ul className="download-list">
              {state.parts.map((p) => {
                const pr = progress[p.label] || {};
                return (
                  <li key={p.label}>
                    <button type="button" className="btn btn-secondary btn-block" onClick={() => download(p)} disabled={busy}>
                      {pr.status === 'working'
                        ? `${p.label}: ${pr.done || 0} of ${p.files.length}…`
                        : pr.status === 'done'
                        ? `${p.label}: saved ✓`
                        : `${p.label} (${p.files.length}, ${mb(p.bytes)})`}
                    </button>
                    {pr.status === 'error' && (
                      <p className="form-error small" role="alert">
                        This part didn’t finish. Tap it to try again.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="btn btn-link" onClick={prepare} disabled={busy}>
            Refresh links
          </button>
        </>
      )}
    </section>
  );
}
