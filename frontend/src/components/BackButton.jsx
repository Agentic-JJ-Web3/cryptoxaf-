import { useNavigate } from 'react-router-dom';

// Explicit in-app back nav, not just a reliance on the browser/OS back
// gesture — installed as a standalone PWA (CLAUDE.md's "feels like an
// app" requirement), there may be no browser chrome to fall back on.
// Prefers real history back (preserves scroll position, feels native);
// falls back to a fixed route when there's no prior in-app history (e.g.
// a bookmarked or shared link opened directly).
export default function BackButton({ fallback = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();

  function handleClick() {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
