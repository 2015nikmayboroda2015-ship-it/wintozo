import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { getYouSeed } from "../lib/materialYou";
import "./You_boot.css";

type Phase = "loading" | "settle" | "reveal" | "exit";

/* ============================================================
   Material 3 Expressive: силуэт логотипа continuously перетекает
   между формами — закруглённая плитка → арка → мягкий квадрат →
   круг → органичный «выветренный» блоб (cookie).
   ============================================================ */

interface ShapeSpec {
  /** Показатель суперэллипса: 2 — круг, больше — квадратнее. */
  n: number;
  /** Показатель для нижней половины (арка: сверху кругло, снизу квадратно). */
  nBottom: number;
  /** Амплитуда четырёх лепестков (cookie). */
  lobe: number;
  lobePhase: number;
  /** Мягкие органичные волны силуэта. */
  wobble: number;
  wobblePhase: number;
}

const SHAPE_SEQUENCE: ShapeSpec[] = [
  /* Закруглённая плитка */
  { n: 3.3, nBottom: 3.3, lobe: 0, lobePhase: 0, wobble: 0, wobblePhase: 0 },
  /* Арка: сверху кругло, снизу почти квадрат */
  { n: 2.1, nBottom: 6.5, lobe: 0, lobePhase: 0, wobble: 0, wobblePhase: 0 },
  /* Мягкий квадрат */
  { n: 5, nBottom: 5, lobe: 0, lobePhase: 0, wobble: 0, wobblePhase: 0 },
  /* Круг */
  { n: 2, nBottom: 2, lobe: 0, lobePhase: 0, wobble: 0, wobblePhase: 0 },
  /* «Выветренный» блоб-печенька */
  {
    n: 2.45,
    nBottom: 2.45,
    lobe: 0.13,
    lobePhase: 0.35,
    wobble: 0.045,
    wobblePhase: 1.1,
  },
];

/** Куда форма «садится», когда приложение готово. */
const TILE_SPEC: ShapeSpec = {
  n: 3.6,
  nBottom: 3.6,
  lobe: 0,
  lobePhase: 0,
  wobble: 0,
  wobblePhase: 0,
};

const SHAPE_STEP_MS = 500;
/** Доля шага, когда форма стоит на месте, — чтобы глаз успел её прочитать. */
const SHAPE_HOLD = 0.28;
const SAMPLES = 72;
const VIEW = 200;
const PAD = 4;

/** Минимум, чтобы все формы успели проиграть до фиксации. */
const MIN_LOAD_MS = 2600;
/** Первый запуск / запуск после обновления — вся заставка ~10–13 с. */
const LONG_LOAD_MIN_MS = 7000;
const LONG_LOAD_MAX_MS = 10000;
const SETTLE_MS = 620;
const REVEAL_MS = 1900;
const EXIT_MS = 460;

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Радиус суперэллипса для угла t. */
function superRadius(t: number, n: number): number {
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
}

function lerpSpec(a: ShapeSpec, b: ShapeSpec, k: number): ShapeSpec {
  return {
    n: a.n + (b.n - a.n) * k,
    nBottom: a.nBottom + (b.nBottom - a.nBottom) * k,
    lobe: a.lobe + (b.lobe - a.lobe) * k,
    lobePhase: a.lobePhase + (b.lobePhase - a.lobePhase) * k,
    wobble: a.wobble + (b.wobble - a.wobble) * k,
    wobblePhase: a.wobblePhase + (b.wobblePhase - a.wobblePhase) * k,
  };
}

/**
 * Строит замкнутый сглаженный путь по силуэту и вписывает его
 * в квадрат VIEW×VIEW, чтобы все формы были одного размера.
 */
function shapePath(spec: ShapeSpec): string {
  const points: [number, number][] = [];

  for (let i = 0; i < SAMPLES; i += 1) {
    const t = (i / SAMPLES) * Math.PI * 2;
    const sin = Math.sin(t);
    const n =
      sin > 0
        ? spec.n + (spec.nBottom - spec.n) * smoothstep(Math.min(1, sin))
        : spec.n;
    let r = superRadius(t, n);
    r *= 1 + spec.lobe * Math.cos(4 * t + spec.lobePhase);
    r *= 1 + spec.wobble * Math.cos(3 * t + spec.wobblePhase);
    points.push([Math.cos(t) * r, sin * r]);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const scale = (VIEW - PAD * 2) / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const p = points.map(
    ([x, y]) =>
      [
        (x - cx) * scale + VIEW / 2,
        (y - cy) * scale + VIEW / 2,
      ] as [number, number],
  );

  /* Квадратичные кривые через середины рёбер — гладкий замкнутый контур. */
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const start = mid(p[p.length - 1], p[0]);
  let d = `M ${start[0].toFixed(2)} ${start[1].toFixed(2)}`;
  for (let i = 0; i < p.length; i += 1) {
    const next = mid(p[i], p[(i + 1) % p.length]);
    d += ` Q ${p[i][0].toFixed(2)} ${p[i][1].toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

interface Props {
  /** Сервер готов — форма фиксируется и выезжает «WinChat You». */
  ready: boolean;
  /** Первый запуск или обновление: анимация загрузки заметно длиннее. */
  long?: boolean;
  onDone: () => void;
}

/**
 * Заставка WinChat You (Material 3 Expressive): пастельный тональный фон
 * выбранной палитры, а логотип непрерывно перетекает между expressive-
 * формами. Когда приложение готово, силуэт мягко садится в плитку и снизу
 * проявляется «WinChat You».
 */
export default function BootAnimationYou({ ready, long = false, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const seed = useMemo(() => getYouSeed(), []);
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

  const vars = useMemo(
    () =>
      ({
        "--yb-primary": seed.primary,
        "--yb-on-primary": seed.onPrimary,
        "--yb-primary-strong": seed.primaryStrong,
        "--yb-primary-container": seed.primaryContainer,
        "--yb-secondary": seed.secondary,
        "--yb-secondary-container": seed.secondaryContainer,
        "--yb-tertiary": seed.tertiary,
        "--yb-tertiary-container": seed.tertiaryContainer,
        "--yb-surface": seed.surface,
        "--yb-surface-low": seed.surfaceLow,
        "--yb-surface-high": seed.surfaceHigh,
        "--yb-on-surface": seed.onSurface,
        "--yb-on-surface-variant": seed.onSurfaceVariant,
        "--yb-outline": seed.outline,
      }) as CSSProperties,
    [seed],
  );

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
        const pos = ((now - start) / SHAPE_STEP_MS) % SHAPE_SEQUENCE.length;
        const index = Math.floor(pos);
        const f = pos - index;
        const k =
          f < SHAPE_HOLD
            ? 0
            : easeInOutCubic((f - SHAPE_HOLD) / (1 - SHAPE_HOLD));
        spec = lerpSpec(
          SHAPE_SEQUENCE[index],
          SHAPE_SEQUENCE[(index + 1) % SHAPE_SEQUENCE.length],
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
      style={vars}
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
                      "color-mix(in srgb, var(--yb-secondary) 38%, var(--yb-secondary-container))",
                  }}
                />
                <stop
                  offset="100%"
                  style={{
                    stopColor:
                      "color-mix(in srgb, var(--yb-tertiary) 30%, var(--yb-tertiary-container))",
                  }}
                />
              </linearGradient>
              <radialGradient id={glowId} cx="32%" cy="16%" r="78%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
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
            </g>
          </svg>

          <img
            className="youboot__mark"
            src="/splash-icon.png"
            alt=""
            draggable={false}
          />
        </div>
      </div>

      <div className="youboot__word" aria-hidden="true">
        <span className="youboot__word-main">WinChat</span>
        <span className="youboot__word-you">You</span>
      </div>
    </div>
  );
}
