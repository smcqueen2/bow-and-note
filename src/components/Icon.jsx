const paths = {
  note: <><path d="M9 18V5l12-2v13M9 9l12-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="18" cy="16" rx="3" ry="2" /></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" /></>,
  previous: <path d="m15 5-7 7 7 7" />,
  next: <path d="m9 5 7 7-7 7" />,
  restart: <><path d="M4 11a8 8 0 1 1 2 6m-2-11v5h5" /></>,
  pause: <path d="M9 5v14m6-14v14" />,
  play: <path d="m9 5 10 7-10 7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  tools: <><path d="M4 7h16M4 17h16" /><rect x="8" y="4" width="3" height="6" rx="1" fill="currentColor" /><rect x="14" y="14" width="3" height="6" rx="1" fill="currentColor" /></>,
  down: <path d="m5 9 7 7 7-7" />,
  pulse: <path d="M2 12h4l3-7 5 14 3-7h5" />,
  strings: <><path d="M4 6h16M4 12h16M4 18h16M9 4v16M16 4v16" /><circle cx="16" cy="12" r="2.6" fill="currentColor" /></>,
};

/** Draw a small interface icon. Interactive controls provide their own label. */
export default function Icon({ name, size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
