import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/swap', label: 'Start a swap' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/orders', label: 'Order history' },
  { to: '/closed', label: 'Operating hours' },
];

// A slide-in panel + backdrop, not a route — no new routing dependency.
// Locks body scroll while open and closes on Escape, the two things that
// make a sheet feel native rather than "a div that happens to be fixed."
export default function MobileNavSheet({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: open ? 0.4 : 0 }}
      />
      <div
        className="absolute right-0 top-0 flex h-full w-[78%] max-w-[300px] flex-col bg-paper px-5 pb-6 shadow-xl transition-transform duration-200"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 20px)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-rule text-ink-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={onClose}
              className="rounded-md px-3 py-3 text-[15px] font-medium text-ink hover:bg-paper-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
