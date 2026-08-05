import { useEffect, useRef, useState } from 'react';

// Fade + slide-up entrance the first time a section scrolls into view.
// One IntersectionObserver hook, no animation library. Skips the
// transition entirely under prefers-reduced-motion (checked once, not
// reactively — a mid-session OS setting change is not worth listening for
// here) and if the element is already on-screen at mount (nothing to
// "reveal" on first paint).
export default function RevealOnScroll({ children, className = '', delayMs = 0, id }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion || !ref.current) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(14px)',
        transition: `opacity 0.5s ease ${delayMs}ms, transform 0.5s ease ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}
