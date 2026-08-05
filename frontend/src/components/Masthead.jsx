import { Link } from 'react-router-dom';

export default function Masthead() {
  return (
    <div className="border-b border-rule pb-5 pt-6">
      <Link to="/" className="flex w-fit items-center gap-2.5">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--vault)" />
          <circle cx="2" cy="16" r="4.5" fill="var(--paper)" />
          <circle cx="30" cy="16" r="4.5" fill="var(--paper)" />
          <rect x="14" y="6" width="4" height="20" rx="2" fill="var(--paper-2)" transform="rotate(45 16 16)" />
          <rect x="14" y="6" width="4" height="20" rx="2" fill="var(--paper-2)" transform="rotate(-45 16 16)" />
        </svg>
        <div className="text-lg tracking-tight text-ink">
          Crypto<b className="font-semibold">XAF</b>
        </div>
      </Link>
    </div>
  );
}
