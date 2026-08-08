import { useMemo, useState } from 'react';
import { formatXaf } from '../lib/format';

// Buy/sell grouped-bar chart, hand-rolled per the dataviz method (no
// charting library — same "hand-rolled, not a dependency" posture as
// frontend/src/components/effects/). Colors are chart-specific steps of
// the app's own vault (buy) / fee (sell) hues, re-derived to clear the
// OKLCH lightness/chroma bands the UI tokens don't sit in — validated with
// scripts/validate_palette.js from the dataviz skill (light: WARN on
// contrast, dark: WARN on CVD — both within the legal floor band and
// mitigated by the direct labels + legend + table view below, never by
// color alone).
const CHART_HEIGHT = 220;
const CHART_WIDTH = 800; // fixed logical viewBox width — the SVG scales to its
// container via CSS, so every day in the range is always visible without a
// horizontal scroll (a scrolling chart defaults to its left edge, which for
// a 30/90-day range hid the one thing that matters: today's bars).
const BAR_MAX_WIDTH = 22;
const MIN_GROUP_GAP = 2;

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatTick(value, measure) {
  if (measure === 'xaf') return formatXaf(Math.round(value));
  return String(Math.round(value));
}

export default function BuySellChart({ days, measure }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const buyKey = measure === 'xaf' ? 'buyXaf' : 'buyCount';
  const sellKey = measure === 'xaf' ? 'sellXaf' : 'sellCount';

  const maxValue = useMemo(() => {
    const peak = days.reduce((m, d) => Math.max(m, d[buyKey], d[sellKey]), 0);
    return niceMax(peak);
  }, [days, buyKey, sellKey]);

  const leftMargin = 40;
  const rightPadding = 8;
  const plotWidth = CHART_WIDTH - leftMargin - rightPadding;
  const slotWidth = plotWidth / days.length;
  const groupWidth = Math.max(4, Math.min(BAR_MAX_WIDTH * 2 + 4, slotWidth - MIN_GROUP_GAP));
  const barW = Math.max(1, Math.min(BAR_MAX_WIDTH, (groupWidth - 2) / 2));
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  const hovered = hoverIndex != null ? days[hoverIndex] : null;

  return (
    <div className="viz-root relative">
      <style>{`
        .viz-root {
          --chart-buy: #3fd08f;
          --chart-sell: #8a5f10;
          --chart-grid: #e1e0d9;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .viz-root {
            --chart-buy: #2aa972;
            --chart-sell: #b8862f;
            --chart-grid: #2c2c2a;
          }
        }
        :root[data-theme="dark"] .viz-root {
          --chart-buy: #2aa972;
          --chart-sell: #b8862f;
          --chart-grid: #2c2c2a;
        }
      `}</style>

      <div className="mb-3 flex items-center gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--chart-buy)' }} />
          Buy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--chart-sell)' }} />
          Sell
        </span>
      </div>

      <div>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 30}`}
          width="100%"
          height={CHART_HEIGHT + 30}
          role="img"
          aria-label={`Daily buy and sell ${measure === 'xaf' ? 'volume in XAF' : 'order counts'}`}
        >
          {/* gridlines + y ticks */}
          {gridSteps.map((step) => {
            const y = 10 + CHART_HEIGHT * (1 - step);
            return (
              <g key={step}>
                <line x1={leftMargin} x2={CHART_WIDTH - rightPadding} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={leftMargin - 4} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted)" className="tab">
                  {formatTick(maxValue * step, measure)}
                </text>
              </g>
            );
          })}

          {/* bars */}
          {days.map((d, i) => {
            const slotX = leftMargin + i * slotWidth;
            const groupX = slotX + (slotWidth - groupWidth) / 2;
            const buyVal = d[buyKey];
            const sellVal = d[sellKey];
            const buyH = maxValue > 0 ? (buyVal / maxValue) * CHART_HEIGHT : 0;
            const sellH = maxValue > 0 ? (sellVal / maxValue) * CHART_HEIGHT : 0;
            const baseY = 10 + CHART_HEIGHT;
            const isHovered = hoverIndex === i;

            return (
              <g key={d.date}>
                {/* hit target — the full slot, bigger than the bars, one tooltip for both series at this date */}
                <rect
                  x={slotX}
                  y={10}
                  width={slotWidth}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  onPointerEnter={() => setHoverIndex(i)}
                  onPointerLeave={() => setHoverIndex((h) => (h === i ? null : h))}
                  onFocus={() => setHoverIndex(i)}
                  onBlur={() => setHoverIndex((h) => (h === i ? null : h))}
                  tabIndex={0}
                  aria-label={`${d.date}: buy ${buyVal}, sell ${sellVal}`}
                />
                <rect
                  x={groupX}
                  y={baseY - buyH}
                  width={barW}
                  height={buyH}
                  rx={4}
                  fill="var(--chart-buy)"
                  opacity={isHovered || hoverIndex === null ? 1 : 0.45}
                  style={{ pointerEvents: 'none' }}
                />
                <rect
                  x={groupX + barW + 4}
                  y={baseY - sellH}
                  width={barW}
                  height={sellH}
                  rx={4}
                  fill="var(--chart-sell)"
                  opacity={isHovered || hoverIndex === null ? 1 : 0.45}
                  style={{ pointerEvents: 'none' }}
                />
                {(i === days.length - 1 ||
                  (i % labelEvery === 0 && i < days.length - 1 - Math.floor(labelEvery / 2))) && (
                  <text
                    x={groupX + groupWidth / 2}
                    y={baseY + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--muted)"
                  >
                    {d.date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-rule bg-card px-3 py-2 text-xs shadow-sm"
          style={{
            left: `${Math.min(92, Math.max(8, ((hoverIndex + 0.5) / days.length) * 100))}%`,
          }}
        >
          <div className="mb-1 font-mono text-[10px] text-muted">{hovered.date}</div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--chart-buy)' }} />
            <span className="text-ink-2">Buy</span>
            <span className="tab font-semibold text-ink">
              {measure === 'xaf' ? `${formatXaf(hovered.buyXaf)} XAF` : hovered.buyCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--chart-sell)' }} />
            <span className="text-ink-2">Sell</span>
            <span className="tab font-semibold text-ink">
              {measure === 'xaf' ? `${formatXaf(hovered.sellXaf)} XAF` : hovered.sellCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
