import { useEffect } from 'react';
import { themeVars } from './palette.js';

// Applies the event's picked colors to the whole page while it is shown.
export function useEventTheme(colors) {
  const key = Array.isArray(colors) ? colors.join('|') : '';
  useEffect(() => {
    if (!key) return undefined;
    const root = document.documentElement;
    const vars = themeVars(key.split('|'));
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevMeta = meta && meta.getAttribute('content');
    if (meta) meta.setAttribute('content', vars['--primary']);
    return () => {
      Object.keys(vars).forEach((k) => root.style.removeProperty(k));
      if (meta && prevMeta) meta.setAttribute('content', prevMeta);
    };
  }, [key]);
}

export function hostsWord(eventType) {
  return eventType === 'Wedding' ? 'the couple' : 'the hosts';
}
