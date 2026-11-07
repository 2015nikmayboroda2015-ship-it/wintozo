/**
 * Живой фон WinChat You: органические блобы, цветок-«облако»
 * и росчерки в духе Material 3 Expressive.
 */
export default function YouBackdrop() {
  const petals = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    return {
      cx: 100 + Math.cos(angle) * 56,
      cy: 100 + Math.sin(angle) * 56,
    };
  });

  return (
    <div className="you-backdrop" aria-hidden>
      <span className="you-blob you-blob-a" />
      <span className="you-blob you-blob-b" />
      <span className="you-blob you-blob-c" />
      <span className="you-blob you-blob-d" />

      <svg className="you-flower" viewBox="0 0 200 200">
        <g fill="var(--you-primary-strong)">
          {petals.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={30} />
          ))}
          <circle cx={100} cy={100} r={72} />
        </g>
      </svg>

      <svg className="you-squiggle" viewBox="0 0 300 300" fill="none">
        <path
          d="M20 160 C 60 40, 120 40, 150 120 S 250 220, 285 100"
          stroke="var(--you-primary)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M10 230 C 70 150, 130 250, 190 180 S 260 150, 295 210"
          stroke="var(--you-secondary)"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
