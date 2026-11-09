import { useEffect, useState } from "react";
import { getYouSeedId } from "../lib/materialYou";

/**
 * Живой фон WinChat You.
 * У каждой палитры — своя композиция: цветок, волны, листья, солнце,
 * лепестки, орбиты, звёзды, молнии, цитрус или бумажные дуги.
 */
export default function YouBackdrop() {
  const [seed, setSeed] = useState<string>(() => getYouSeedId());

  useEffect(() => {
    const onChange = () => setSeed(getYouSeedId());
    window.addEventListener("winchat-you-seed-change", onChange);
    return () => window.removeEventListener("winchat-you-seed-change", onChange);
  }, []);

  const petals = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    return {
      cx: 100 + Math.cos(angle) * 56,
      cy: 100 + Math.sin(angle) * 56,
    };
  });

  const bubbles = [
    { left: 8, size: 2.4, delay: 0, duration: 17 },
    { left: 18, size: 4.2, delay: 4, duration: 24 },
    { left: 31, size: 1.8, delay: 8, duration: 15 },
    { left: 46, size: 3.4, delay: 2, duration: 21 },
    { left: 62, size: 2.2, delay: 10, duration: 18 },
    { left: 74, size: 5, delay: 6, duration: 27 },
    { left: 88, size: 2.8, delay: 12, duration: 20 },
  ];

  const leaves = [
    { left: 6, top: -8, size: 4.6, delay: 0, duration: 17, rotate: 18 },
    { left: 18, top: -14, size: 3.4, delay: 5, duration: 21, rotate: -24 },
    { left: 34, top: -6, size: 5.2, delay: 9, duration: 19, rotate: 42 },
    { left: 51, top: -16, size: 3.8, delay: 3, duration: 23, rotate: -12 },
    { left: 66, top: -10, size: 4.4, delay: 12, duration: 18, rotate: 28 },
    { left: 79, top: -4, size: 3, delay: 7, duration: 22, rotate: -36 },
    { left: 91, top: -12, size: 4.8, delay: 15, duration: 20, rotate: 8 },
  ];

  const cherryPetals = Array.from({ length: 12 }, (_, i) => ({
    left: (i * 8.3 + 3) % 100,
    size: 2.2 + ((i * 7) % 10) / 4,
    delay: (i * 1.7) % 12,
    duration: 12 + ((i * 3) % 9),
    rotate: (i * 47) % 360,
  }));

  const stars = Array.from({ length: 34 }, (_, i) => ({
    left: (i * 29 + 7) % 100,
    top: (i * 17 + 11) % 92,
    size: 0.18 + ((i * 5) % 10) / 22,
    delay: (i * 0.37) % 4,
    duration: 2.4 + ((i * 3) % 12) / 4,
  }));

  return (
    <div className="you-backdrop" data-seed={seed} aria-hidden>
      <span className="you-blob you-blob-a" />
      <span className="you-blob you-blob-b" />
      <span className="you-blob you-blob-c" />
      <span className="you-blob you-blob-d" />

      {seed === "lavender" && (
        <>
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
        </>
      )}

      {seed === "ocean" && (
        <>
          <div className="you-waves">
            <svg viewBox="0 0 1200 320" preserveAspectRatio="none">
              <path
                className="you-wave you-wave-a"
                d="M0 210 C 150 150, 300 270, 450 210 S 750 150, 900 225 S 1100 255, 1200 205 L1200 320 L0 320 Z"
              />
              <path
                className="you-wave you-wave-b"
                d="M0 250 C 140 200, 280 300, 430 250 S 720 195, 880 260 S 1080 290, 1200 245 L1200 320 L0 320 Z"
              />
              <path
                className="you-wave you-wave-c"
                d="M0 285 C 170 250, 320 320, 480 285 S 770 245, 930 295 S 1110 315, 1200 285 L1200 320 L0 320 Z"
              />
            </svg>
          </div>
          <div className="you-bubbles">
            {bubbles.map((b, i) => (
              <span
                key={i}
                style={{
                  left: `${b.left}%`,
                  width: `${b.size}vmax`,
                  height: `${b.size}vmax`,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {seed === "forest" && (
        <div className="you-leaves">
          {leaves.map((l, i) => (
            <span
              key={i}
              style={{
                left: `${l.left}%`,
                top: `${l.top}%`,
                width: `${l.size}vmax`,
                height: `${l.size * 1.35}vmax`,
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.duration}s`,
                rotate: `${l.rotate}deg`,
              }}
            />
          ))}
        </div>
      )}

      {seed === "sunset" && (
        <>
          <div className="you-sun-rays" />
          <div className="you-sun" />
          <div className="you-horizon" />
        </>
      )}

      {seed === "cherry" && (
        <div className="you-petals">
          {cherryPetals.map((p, i) => (
            <span
              key={i}
              style={{
                left: `${p.left}%`,
                width: `${p.size}vmax`,
                height: `${p.size * 1.5}vmax`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                rotate: `${p.rotate}deg`,
              }}
            />
          ))}
        </div>
      )}

      {seed === "indigo" && (
        <div className="you-orbits">
          <span />
          <span />
          <span />
          <span />
          <i />
        </div>
      )}

      {seed === "dark" && (
        <>
          <div className="you-stars">
            {stars.map((s, i) => (
              <span
                key={i}
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: `${s.size}vmax`,
                  height: `${s.size}vmax`,
                  animationDelay: `${s.delay}s`,
                  animationDuration: `${s.duration}s`,
                }}
              />
            ))}
          </div>
          <div className="you-moon" />
        </>
      )}

      {seed === "red" && (
        <>
          <div className="you-stripes" />
          <svg className="you-bolts" viewBox="0 0 200 300" fill="none">
            <path
              d="M126 4 L58 132 L112 132 L72 296 L176 104 L124 104 Z"
              stroke="var(--you-primary)"
              strokeWidth="8"
              strokeLinejoin="round"
            />
            <path
              d="M42 48 L18 104 L44 104 L26 168 L68 96 L44 96 Z"
              stroke="var(--you-secondary)"
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </svg>
        </>
      )}

      {seed === "orange" && (
        <div className="you-citrus">
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

      {seed === "beige" && (
        <div className="you-arcs">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
