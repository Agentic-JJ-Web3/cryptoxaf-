const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.7z';

function Star({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
      <path d={STAR_PATH} fill={filled ? 'var(--fee)' : 'none'} stroke="var(--fee)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Read-only display by default; pass `onChange` for the interactive
// picker used on the review-submission form.
export default function StarRating({ value, onChange, size = 'sm' }) {
  const interactive = typeof onChange === 'function';
  const dim = size === 'lg' ? 26 : 16;

  return (
    <div role={interactive ? 'radiogroup' : undefined} aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <svg width={dim} height={dim} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={STAR_PATH}
                fill={n <= value ? 'var(--fee)' : 'none'}
                stroke="var(--fee)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <Star key={n} filled={n <= value} />
        ),
      )}
    </div>
  );
}
