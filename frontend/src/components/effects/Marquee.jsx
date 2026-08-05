// Seamless infinite scroll: render the children twice back-to-back and
// animate the wrapper left by exactly 50% — when the first copy has fully
// scrolled off, the second copy is sitting exactly where the first
// started, so the loop point is invisible. Pauses on hover/focus (a
// stationary target is easier to read/tap), and respects
// prefers-reduced-motion the same way index.css's other .animate-* rules
// do — this one lives inline since the loop distance depends on content
// width, not a fixed keyframe.
export default function Marquee({ children, durationSeconds = 28, className = '', itemClassName = '' }) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <div className={`marquee-mask overflow-hidden ${className}`}>
      <div className="marquee-track flex w-max gap-3" style={{ '--marquee-duration': `${durationSeconds}s` }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex flex-none gap-3" aria-hidden={copy === 1}>
            {items.map((item, i) => (
              <div key={i} className={`flex-none ${itemClassName}`}>
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
