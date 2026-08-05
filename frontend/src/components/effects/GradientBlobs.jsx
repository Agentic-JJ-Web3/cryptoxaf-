// The lightweight, dependency-free stand-in for reactbits' Aurora
// background (which pulls in three.js + @react-three/fiber — too heavy
// for CLAUDE.md's budget-Android mobile-first target). Two blurred radial
// gradients in the design tokens' own colors, absolutely positioned behind
// the hero content. `pointer-events-none` so it never intercepts a tap.
export default function GradientBlobs() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
      <div
        className="absolute -left-24 -top-24 h-[340px] w-[340px] rounded-full opacity-[0.16] blur-[90px]"
        style={{ background: 'var(--vault)' }}
      />
      <div
        className="absolute -right-20 top-16 h-[280px] w-[280px] rounded-full opacity-[0.14] blur-[90px]"
        style={{ background: 'var(--live)' }}
      />
    </div>
  );
}
