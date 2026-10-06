import React, { useState } from 'react';
import { api } from '../services/api.js';
import { COLOR_DOTS, STARTER_SETS } from '../utils/palette.js';

// Host edits the headline, welcome message and colors guests see.
export default function EditEventPanel({ event, onChanged, onUnauthorized }) {
  const [headline, setHeadline] = useState(event.headline || '');
  const [welcome, setWelcome] = useState(event.welcomeMessage || '');
  const [colors, setColors] = useState(event.colors || []);
  const [state, setState] = useState({ status: 'idle', message: '' });

  const toggle = (name) =>
    setColors((cur) => {
      if (cur.includes(name)) return cur.filter((c) => c !== name);
      if (cur.length >= 3) return [...cur.slice(1), name];
      return [...cur, name];
    });

  const save = async (e) => {
    e.preventDefault();
    if (headline.trim().length < 2) return setState({ status: 'error', message: 'Please enter a headline.' });
    if (colors.length < 2) return setState({ status: 'error', message: 'Please pick 2 or 3 colors.' });
    setState({ status: 'saving', message: '' });
    try {
      await api.updateEvent({ headline, welcomeMessage: welcome, colors });
      setState({ status: 'saved', message: 'Saved. Guests will see the changes within a minute.' });
      onChanged && onChanged();
    } catch (err) {
      if (err.status === 401) return onUnauthorized();
      setState({ status: 'error', message: err.message || 'We couldn’t save your changes. Please try again.' });
    }
  };

  return (
    <form className="edit-event" onSubmit={save} noValidate aria-labelledby="edit-title">
      <h3 id="edit-title" className="sub-title">Edit your page</h3>
      <label className="field">
        <span className="field-label">Headline</span>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={100} required />
      </label>
      <label className="field">
        <span className="field-label">Welcome message (optional)</span>
        <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={500} rows={4} />
        <span className="muted small">{welcome.length}/500</span>
      </label>
      <fieldset className="color-pick">
        <legend className="field-label">Colors: pick 2 or 3</legend>
        <div className="starter-sets" role="group" aria-label="Starter color sets">
          {STARTER_SETS.map((set) => {
            const on = set.colors.length === colors.length && set.colors.every((c) => colors.includes(c));
            return (
              <button key={set.name} type="button" className={`starter ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setColors(set.colors)}>
                <span className="mini-dots" aria-hidden="true">
                  {set.colors.map((c) => (
                    <i key={c} style={{ background: COLOR_DOTS.find((d) => d.name === c).hex }} />
                  ))}
                </span>
                {set.name}
              </button>
            );
          })}
        </div>
        <div className="dots">
          {COLOR_DOTS.map((d) => {
            const on = colors.includes(d.name);
            return (
              <button key={d.name} type="button" className={`dot ${on ? 'is-on' : ''}`} aria-pressed={on} aria-label={d.name} title={d.name} onClick={() => toggle(d.name)}>
                <span className="swatch" style={{ background: d.hex }} />
                <span className="dot-name">{d.name}</span>
                {on && <span className="dot-check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
        <p className="muted small">Picked: {colors.length ? colors.join(', ') : 'none yet'}</p>
      </fieldset>
      {state.message && (
        <p className={state.status === 'error' ? 'form-error' : 'notice notice-good'} role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={state.status === 'saving'}>
        {state.status === 'saving' ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
