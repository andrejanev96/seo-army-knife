// Lucide-style icon set. Every glyph uses the same 24x24 viewBox, stroke 2,
// round caps/joins so density and weight stay consistent across the app.
//
// Sources: simplified from Lucide (https://lucide.dev — ISC). Inlined so we
// don't pull a runtime dep just for ~10 glyphs.

function Svg({ children, size = 16, className, title, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function WrenchIcon(props) {
  return (
    <Svg {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  );
}

// Ammo.com chevron mark — the brand-guide-approved nav-and-favicon variant
// of the shield. Per the brand guide: "favicon used for consistent branding
// without distraction... 16px minimum web."
//
// Faithful to brand colors: navy header (#083167), red-and-white stripes
// (#99161D + #fff), with a small white star at the bottom. Outline is the
// brand-guide intermediate black (#1d1d1d).
export function AmmoShieldIcon({ size = 24, className, title, mono = false, ...rest }) {
  const navy = mono ? '#1d1d1d' : '#083167';
  const red = mono ? '#1d1d1d' : '#99161D';
  const white = '#ffffff';
  const outline = '#1d1d1d';
  const clipId = `shield-clip-${size}-${mono ? 'm' : 'c'}`;
  return (
    <svg
      width={size}
      height={(size * 28) / 24}
      viewBox="0 0 24 28"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M2 2 L22 2 L22 17.5 Q22 18.5 21.3 19.2 L12.7 26.5 Q12 27.1 11.3 26.5 L2.7 19.2 Q2 18.5 2 17.5 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Navy header bar */}
        <rect x="0" y="0" width="24" height="7.5" fill={navy} />
        {/* White body */}
        <rect x="0" y="7.5" width="24" height="20.5" fill={white} />
        {/* Red vertical stripes */}
        <rect x="2.5" y="7.5" width="2.8" height="20.5" fill={red} />
        <rect x="8" y="7.5" width="2.8" height="20.5" fill={red} />
        <rect x="13.2" y="7.5" width="2.8" height="20.5" fill={red} />
        <rect x="18.7" y="7.5" width="2.8" height="20.5" fill={red} />
        {/* White star near the bottom point */}
        <polygon
          points="12,19.5 12.95,21.4 15.05,21.7 13.5,23.1 13.9,25.2 12,24.2 10.1,25.2 10.5,23.1 8.95,21.7 11.05,21.4"
          fill={white}
        />
      </g>
      {/* Shield outline */}
      <path
        d="M2 2 L22 2 L22 17.5 Q22 18.5 21.3 19.2 L12.7 26.5 Q12 27.1 11.3 26.5 L2.7 19.2 Q2 18.5 2 17.5 Z"
        fill="none"
        stroke={outline}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronIcon({ direction = 'right', ...props }) {
  const r = { right: 0, left: 180, down: 90, up: -90 };
  return (
    <Svg style={{ transform: `rotate(${r[direction]}deg)` }} {...props}>
      <polyline points="9 6 15 12 9 18" />
    </Svg>
  );
}

export function AlertCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

export function XCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </Svg>
  );
}

export function InfoIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  );
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function ImageIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </Svg>
  );
}

export function ClipboardIcon(props) {
  return (
    <Svg {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </Svg>
  );
}

export function DotIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </Svg>
  );
}

// Severity → icon dispatch for OG Checker issues and Link Cleaner warnings.
export function SeverityIcon({ severity, ...props }) {
  switch (severity) {
    case 'error':   return <XCircleIcon {...props} />;
    case 'warning': return <AlertTriangleIcon {...props} />;
    case 'info':    return <InfoIcon {...props} />;
    default:        return <InfoIcon {...props} />;
  }
}
