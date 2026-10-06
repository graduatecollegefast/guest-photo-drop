import React, { createContext, useContext } from 'react';

// The event's chosen icon (Hearts, Bells, Ribbons, Rings, Florals, Sparkles).
// Pages wrap their content in <IconContext.Provider value={event.icon}>; everything that
// draws an icon (the trio, dividers, buttons) then uses it. Defaults to Hearts.
export const IconContext = createContext('Hearts');
export const ICON_NAMES = ['Hearts', 'Bells', 'Ribbons', 'Rings', 'Florals', 'Sparkles'];

function Shape({ name, color }) {
  switch (name) {
    case 'Bells':
      return (
        <path
          fill={color}
          d="M12 2.2c.9 0 1.6.7 1.6 1.6v.6c2.9.7 4.9 3.3 4.9 6.3v4.1l1.9 2.3v1.1H3.6v-1.1l1.9-2.3v-4.1c0-3 2-5.6 4.9-6.3v-.6c0-.9.7-1.6 1.6-1.6zM9.6 19.4h4.8a2.4 2.4 0 0 1-4.8 0z"
        />
      );
    case 'Ribbons':
      return (
        <path
          fill={color}
          d="M12 10.6c-1.4-3-4.6-5.8-7.4-4.7-2.4 1-2.1 4.8.3 6.2 1.8 1.1 4.3.7 5.8-.2L7.9 19.6l2.6-.6 1.5 2.4 1.5-2.4 2.6.6-2.8-7.7c1.5.9 4 1.3 5.8.2 2.4-1.4 2.7-5.2.3-6.2-2.8-1.1-6 1.7-7.4 4.7zm0 0a1.6 1.6 0 1 1 0 .1z"
        />
      );
    case 'Rings':
      return (
        <g fill="none" stroke={color} strokeWidth="2.4">
          <circle cx="9" cy="14.2" r="5.6" />
          <circle cx="15" cy="14.2" r="5.6" />
          <path d="M15 3.2l1.9 2.4L15 8l-1.9-2.4z" fill={color} stroke="none" />
        </g>
      );
    case 'Florals':
      return (
        <g fill={color}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="12" cy="6.8" rx="3.3" ry="4.6" transform={`rotate(${deg} 12 12)`} />
          ))}
          <circle cx="12" cy="12" r="2.6" fill="#ffffff" opacity="0.75" />
        </g>
      );
    case 'Sparkles':
      return (
        <g fill={color}>
          <path d="M11 2.5c.6 4.8 2.4 7 7.2 7.6-4.8.6-6.6 2.8-7.2 7.6-.6-4.8-2.4-7-7.2-7.6 4.8-.6 6.6-2.8 7.2-7.6z" />
          <path d="M18.6 14.4c.3 2.3 1.1 3.1 3.4 3.4-2.3.3-3.1 1.1-3.4 3.4-.3-2.3-1.1-3.1-3.4-3.4 2.3-.3 3.1-1.1 3.4-3.4z" />
        </g>
      );
    case 'Hearts':
    default:
      return (
        <path
          fill={color}
          d="M12 21.2s-7.6-4.6-9.6-9.4C1 8.5 3 5 6.6 5c2.1 0 3.6 1.1 4.4 2.6h2C13.8 6.1 15.3 5 17.4 5 21 5 23 8.5 21.6 11.8c-2 4.8-9.6 9.4-9.6 9.4z"
        />
      );
  }
}

// Decorative icon. Purely visual, hidden from screen readers.
export function Heart({ size = 24, color = 'var(--accent)', className = '', style, icon }) {
  const ctx = useContext(IconContext);
  return (
    <svg className={`heart ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={style}>
      <Shape name={icon || ctx} color={color} />
    </svg>
  );
}

// Three icons in the event's colors.
export function HeartTrio({ size = 22, icon }) {
  return (
    <span className="heart-trio" aria-hidden="true">
      <Heart icon={icon} size={size * 0.8} color="var(--silver)" className="tilt-left" />
      <Heart icon={icon} size={size * 1.25} color="var(--accent)" />
      <Heart icon={icon} size={size * 0.8} color="var(--primary)" className="tilt-right" />
    </span>
  );
}

// Thin rule with an icon in the middle.
export function HeartDivider({ icon }) {
  return (
    <span className="heart-divider" aria-hidden="true">
      <span className="rule" />
      <Heart icon={icon} size={14} />
      <span className="rule" />
    </span>
  );
}
