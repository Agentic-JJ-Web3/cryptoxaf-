import SpotlightCard from './effects/SpotlightCard';
import StarRating from './StarRating';
import { CHAIN_LABELS } from '../lib/chains';

export default function TestimonialCard({ review, className = '' }) {
  return (
    <SpotlightCard
      className={`rounded-xl border border-rule bg-card px-5 py-5 ${className}`}
      spotlightColor="var(--live)"
    >
      <div className="flex items-center justify-between gap-3">
        <StarRating value={review.rating} />
        <span className="tab flex-none text-[11px] text-muted">
          {new Date(review.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}
        </span>
      </div>
      {review.comment && <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{review.comment}</p>}
      <div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">
        Swapped on {CHAIN_LABELS[review.chain]}
      </div>
    </SpotlightCard>
  );
}
