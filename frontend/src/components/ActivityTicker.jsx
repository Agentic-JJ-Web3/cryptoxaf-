import Marquee from './effects/Marquee';
import { useRecentActivity } from '../lib/useRecentActivity';
import { formatXaf } from '../lib/format';
import { CHAIN_LABELS } from '../lib/chains';

// Real, anonymized completed orders only — see CLAUDE.md's Reviews/Live
// activity section. Renders nothing at all when there's no recent
// activity: never a fake placeholder, never "no urgency the product
// hasn't earned."
export default function ActivityTicker() {
  const { activity } = useRecentActivity();

  if (activity.length === 0) return null;

  return (
    <Marquee durationSeconds={activity.length * 4}>
      {activity.map((entry, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-full border border-rule-soft bg-paper-2 px-3.5 py-2 text-xs text-ink-2"
        >
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-live" />
          <span className="tab">~{formatXaf(entry.roundedXaf)} XAF</span>
          <span className="text-muted">swapped on {CHAIN_LABELS[entry.chain]}</span>
          <span className="text-muted">· {entry.minutesAgo === 0 ? 'just now' : `${entry.minutesAgo}m ago`}</span>
        </div>
      ))}
    </Marquee>
  );
}
