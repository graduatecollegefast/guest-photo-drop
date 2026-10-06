import { useEffect } from 'react';

// "Silver Red Purple" -> "silver-red-purple"; matches [data-theme] blocks in styles/themes.css
export function themeSlug(name) {
  return String(name || 'Silver Red Purple').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Applies the event's chosen theme to the whole page while it is shown.
export function useEventTheme(theme) {
  useEffect(() => {
    if (!theme) return undefined;
    const root = document.documentElement;
    root.dataset.theme = themeSlug(theme);
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);
}

export function hostsWord(eventType) {
  return eventType === 'Wedding' ? 'the couple' : 'the hosts';
}
