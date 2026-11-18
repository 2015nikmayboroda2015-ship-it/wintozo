import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  SHAPE_SEQUENCE,
  TILE_SPEC,
  lerpSpec,
  shapePath,
  type ShapeSpec,
} from "../lib/youShapes";
import "./You_boot.css";

type Phase = "loading" | "settle" | "reveal" | "exit";

/* ============================================================
   Material 3 Expressive boot.

   Силуэт перетекает между настоящими формами Material You:
   squircle → arch → diamond → circle → cookie 4 → clover 4 →
   cookie 7 → soft burst (12 лучей) → cookie 9.

   Внутри силуэта — простая чёрная буква «W» (знак WinChat),
   обрезанная формой. Вся заставка держится в голубой
   Material You-палитре (Google Blue).
   ============================================================ */

/* ---------------- Голубая палитра (M3, light) ---------------- */

const BLUE_VARS = {
  "--yb-primary": "#0b57d0",
  "--yb-on-primary": "#ffffff",
  "--yb-primary-strong": "#0842a0",
  "--yb-primary-container": "#d3e3fd",
  "--yb-secondary": "#00639b",
  "--yb-secondary-container": "#c2e7ff",
  "--yb-tertiary": "#006a6a",
  "--yb-tertiary-container": "#c8f0ee",
  "--yb-surface": "#eef4fd",
  "--yb-surface-low": "#f6f9ff",
  "--yb-surface-high": "#e1ecfb",
  "--yb-on-surface": "#0f1c2c",
  "--yb-on-surface-variant": "#3e4c60",
  "--yb-outline": "#6b7b90",
} as CSSProperties;

/* ---------------- Геометрия экспрессивных форм ---------------- */
/* Силуэты и математика общие с кастомизацией You — lib/youShapes.ts. */

const SHAPE_STEP_MS = 400;
/** Доля шага, когда форма стоит на месте, — чтобы глаз успел её прочитать. */
const SHAPE_HOLD = 0.28;
const VIEW = 200;

/** Минимум, чтобы все формы успели проиграть до фиксации. */
const MIN_LOAD_MS = 3800;
/** Первый запуск / запуск после обновления — вся заставка ~8–11 с. */
const LONG_LOAD_MIN_MS = 7000;
const LONG_LOAD_MAX_MS = 10000;
const SETTLE_MS = 620;
const REVEAL_MS = 1900;
const EXIT_MS = 460;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface Props {
  /** Сервер готов — форма фиксируется и выезжает «WinChat You». */
  ready: boolean;
  /** Первый запуск или обновление: анимация загрузки заметно длиннее. */
  long?: boolean;
  onDone: () => void;
}

/**
 * Заставка WinChat You (Material 3 Expressive): голубой тональный фон,
 * чёрная буква «W» внутри силуэта, который непрерывно перетекает между
 * формами Material You. Когда приложение готово, силуэт мягко садится
 * в squircle-плитку и снизу проявляется «WinChat You».
 */
export default function BootAnimationYou({ ready, long = false, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const uid = useId().replace(/:/g, "");
  const gradientId = `you-grad-${uid}`;
  const glowId = `you-glow-${uid}`;
  const clipId = `you-clip-${uid}`;
  const pathId = `you-path-${uid}`;

  /* Длительность фиксируем на маунт (7–10 с при первом запуске/обновлении). */
  const minWaitMs = useMemo(
    () =>
      long
        ? LONG_LOAD_MIN_MS + Math.random() * (LONG_LOAD_MAX_MS - LONG_LOAD_MIN_MS)
        : MIN_LOAD_MS,
    [long],
  );
  const startedAt = useRef(Date.now());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const pathRef = useRef<SVGPathElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const initialPath = useMemo(() => shapePath(SHAPE_SEQUENCE[0]), []);


  /* Живой силуэт: перетекание форм, затем мягкая фиксация в плитку. */
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      path.setAttribute("d", shapePath(TILE_SPEC));
      return;
    }

    const start = performance.now();
    let settleFrom: ShapeSpec | null = null;
    let settleAt = 0;
    let settled = false;
    let lastSpec = SHAPE_SEQUENCE[0];
    let raf = 0;

    const tick = (now: number) => {
      let spec: ShapeSpec;

      if (phaseRef.current === "loading") {
        /* Первый rAF-таймстамп может быть чуть раньше start — не даём
           индексу уйти в -1 (иначе форма пропадает). */
        const elapsed = Math.max(0, now - start);
        const pos = (elapsed / SHAPE_STEP_MS) % SHAPE_SEQUENCE.length;
        const index = Math.floor(pos);
        const f = pos - index;
        const k =
          f < SHAPE_HOLD
            ? 0
            : easeInOutCubic((f - SHAPE_HOLD) / (1 - SHAPE_HOLD));
        spec = lerpSpec(
          SHAPE_SEQUENCE[index] ?? SHAPE_SEQUENCE[0],
          SHAPE_SEQUENCE[(index + 1) % SHAPE_SEQUENCE.length] ?? SHAPE_SEQUENCE[0],
          k,
        );
        lastSpec = spec;
      } else {
        if (!settleFrom) {
          settleFrom = lastSpec;
          settleAt = now;
        }
        const k = Math.min(1, (now - settleAt) / 560);
        spec = lerpSpec(settleFrom, TILE_SPEC, easeOutCubic(k));
        if (k >= 1) settled = true;
      }

      path.setAttribute("d", shapePath(spec));
      if (!settled) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* Загрузка: ждём сервер, но не меньше минимума. */
  useEffect(() => {
    if (phase !== "loading" || !ready) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, minWaitMs - elapsed);
    const timer = window.setTimeout(() => setPhase("settle"), wait);
    return () => window.clearTimeout(timer);
  }, [phase, ready, minWaitMs]);

  /* Дальше фазы идут строго по таймеру. */
  useEffect(() => {
    if (phase === "settle") {
      const timer = window.setTimeout(() => setPhase("reveal"), SETTLE_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "reveal") {
      const timer = window.setTimeout(() => setPhase("exit"), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "exit") {
      const timer = window.setTimeout(() => doneRef.current(), EXIT_MS);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  return (
    <div
      className="youboot"
      data-phase={phase}
      style={BLUE_VARS}
      role="status"
      aria-live="polite"
      aria-label="Загрузка WinChat You"
    >
      <div className="youboot__ambient" aria-hidden="true" />
      <div className="youboot__grain" aria-hidden="true" />

      <div className="youboot__stage" aria-hidden="true">
        <span className="youboot__halo" />
        <div className="youboot__shape">
          <svg className="youboot__blob" viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <defs>
              <linearGradient id={gradientId} x1="14%" y1="6%" x2="88%" y2="96%">
                <stop
                  offset="0%"
                  style={{
                    stopColor:
                      "color-mix(in srgb, var(--yb-primary) 58%, var(--yb-primary-container))",
                  }}
                />
                <stop
                  offset="52%"
                  style={{
                    stopColor:
                      "color-mix(in srgb, var(--yb-secondary) 36%, var(--yb-secondary-container))",
                  }}
                />
                <stop
                  offset="100%"
                  style={{
                    stopColor:
                      "color-mix(in srgb, var(--yb-tertiary) 26%, var(--yb-tertiary-container))",
                  }}
                />
              </linearGradient>
              <radialGradient id={glowId} cx="32%" cy="16%" r="78%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
                <stop offset="52%" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <clipPath id={clipId}>
                <use href={`#${pathId}`} />
              </clipPath>
            </defs>

            <path
              id={pathId}
              ref={pathRef}
              d={initialPath}
              fill={`url(#${gradientId})`}
            />
            <g clipPath={`url(#${clipId})`}>
              <rect width={VIEW} height={VIEW} fill={`url(#${glowId})`} />
              <text
                className="youboot__logo"
                x={VIEW / 2}
                y={VIEW / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={VIEW * 0.56}
                fontWeight={800}
                letterSpacing="-0.02em"
              >
                W
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div className="youboot__word" aria-hidden="true">
        <span className="youboot__word-main">WinChat</span>
        <span className="youboot__word-you">You</span>
      </div>
    </div>
  );
}
