import { useRef } from 'react';

// A cursor-following glow, reactbits'-SpotlightCard-style but hand-rolled
// in CSS: onMouseMove sets --x/--y custom properties, a radial-gradient
// positioned by them does the rest. No animation loop, no dependency.
// Touch devices have no hover concept — `(hover: hover)` gates the
// listener off entirely rather than firing on a tap, both for correctness
// and so budget-Android phones (CLAUDE.md's mobile-first target) don't pay
// for an effect they'll never see.
const canHover =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

export default function SpotlightCard({ children, className = '', spotlightColor = 'var(--vault)' }) {
  const ref = useRef(null);

  function handleMouseMove(e) {
    if (!canHover || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--x', `${e.clientX - rect.left}px`);
    ref.current.style.setProperty('--y', `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={canHover ? handleMouseMove : undefined}
      className={`group relative overflow-hidden ${className}`}
    >
      {canHover && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(220px circle at var(--x, 50%) var(--y, 50%), color-mix(in srgb, ${spotlightColor} 16%, transparent), transparent 70%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
