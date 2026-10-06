// Turns the customer's 2 or 3 picked colors into a full, readable page theme.
// Roles are assigned automatically:
//   darkest color   -> names, buttons, key text (darkened if needed so white text stays readable)
//   middle color    -> icons and accents
//   lightest color  -> dividers, soft backgrounds
// Every text color is checked against the background so pages always pass contrast.

export const COLOR_DOTS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Champagne', hex: '#D9C3A5' },
  { name: 'Mocha', hex: '#7A5C4A' },
  { name: 'Black', hex: '#1C1C1C' },
  { name: 'Gold', hex: '#B8923A' },
  { name: 'Silver', hex: '#A9ABB5' },
  { name: 'Sage', hex: '#9CAF88' },
  { name: 'Emerald', hex: '#1F6B4F' },
  { name: 'Dusty Blue', hex: '#7F9DB8' },
  { name: 'Navy', hex: '#1F2D4D' },
  { name: 'Blush', hex: '#E8B4B8' },
  { name: 'Burgundy', hex: '#6E1E2E' },
];

export const STARTER_SETS = [
  { name: 'Nude and Natural', colors: ['Champagne', 'Mocha', 'White'] },
  { name: 'Black and White', colors: ['Black', 'White', 'Silver'] },
  { name: 'Garden', colors: ['Sage', 'White', 'Gold'] },
  { name: 'Navy and Gold', colors: ['Navy', 'Gold', 'White'] },
  { name: 'Romance', colors: ['Blush', 'Burgundy', 'Gold'] },
  { name: 'Coastal', colors: ['Dusty Blue', 'Silver', 'White'] },
];

export const DEFAULT_COLORS = STARTER_SETS[0].colors;
const HEX = Object.fromEntries(COLOR_DOTS.map((c) => [c.name, c.hex]));

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}
export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}
// Darken toward near-black until the color reaches the contrast target against `bg`.
function deepen(hex, bg, target) {
  let out = hex;
  for (let t = 0.08; contrast(out, bg) < target && t <= 1; t += 0.08) out = mix(hex, '#141414', t);
  return out;
}

export function themeVars(colorNames) {
  const picked = (colorNames && colorNames.length ? colorNames : DEFAULT_COLORS).map((n) => HEX[n]).filter(Boolean);
  const byLight = [...picked].sort((a, b) => luminance(a) - luminance(b)); // dark -> light
  const darkest = byLight[0];
  const lightest = byLight[byLight.length - 1];
  const middle = byLight.length > 2 ? byLight[1] : lightest;

  const background = luminance(lightest) > 0.8 ? mix(lightest, darkest, 0.03) : mix(lightest, '#FFFFFF', 0.86);
  const primary = deepen(darkest, '#FFFFFF', 4.6); // white button text stays readable
  const accentBase = middle === lightest && luminance(middle) > 0.75 ? darkest : middle;
  const accent = deepen(accentBase, background, 2.2); // icons visible on the background
  const silver = luminance(lightest) > 0.85 ? mix(primary, '#FFFFFF', 0.62) : lightest;
  const text = deepen(mix(primary, '#141414', 0.45), background, 10);
  const textMuted = deepen(mix(primary, '#6b6b6b', 0.55), background, 4.6);

  return {
    '--primary': primary,
    '--primary-hover': mix(primary, '#000000', 0.18),
    '--primary-contrast': '#FFFFFF',
    '--accent': accent,
    '--accent-soft': mix(accent, '#FFFFFF', 0.85),
    '--secondary': mix(primary, '#FFFFFF', 0.88),
    '--silver': silver,
    '--silver-light': mix(silver, '#FFFFFF', 0.6),
    '--background': background,
    '--text': text,
    '--text-muted': textMuted,
    '--border': mix(primary, '#FFFFFF', 0.82),
    '--silver-gradient': `linear-gradient(90deg, ${mix(silver, '#FFFFFF', 0.5)} 0%, ${silver} 40%, ${mix(silver, '#FFFFFF', 0.75)} 60%, ${silver} 85%, ${mix(silver, '#FFFFFF', 0.5)} 100%)`,
    '--brand-gradient': `linear-gradient(90deg, ${primary} 0%, ${accent} 100%)`,
  };
}
