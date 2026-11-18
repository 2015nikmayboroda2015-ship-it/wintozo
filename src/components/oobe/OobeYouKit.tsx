import {
  useEffect,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  SHAPE_SEQUENCE,
  TILE_SPEC,
  lerpSpec,
  shapePath,
  type ShapeSpec,
} from "../../lib/youShapes";
import { getYouSeed, getYouSeedId } from "../../lib/materialYou";
import { useLiteMotion } from "../../lib/devicePerf";
import { cn } from "../../utils/cn";
import "./oobe-you.css";

/**
 * Пока открыт OOBE, гасим фоновые анимации WinPro на <html>: их полноэкранный
 * слой рисуется поверх страницы и на телефонах выглядит как мерцание цветами.
 */
export function useOobeShell() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("oobe-active");
    return () => root.classList.remove("oobe-active");
  }, []);
}

/* ============================================================
   OOBE You — общий Material You-набор для приветственных экранов.
   Формы берутся из бут-анимации (lib/youShapes.ts): ими живут
   фон, логотип-силуэт и финальная плитка.
   ============================================================ */

/** CSS-переменные палитры You для корня OOBE (без глобальных side-effect). */
export function youPaletteStyle(seedId = getYouSeedId()): CSSProperties {
  const s = getYouSeed(seedId);
  const hex = s.surface.replace("#", "");
  const rv = parseInt(hex.slice(0, 2), 16) || 0;
  const gv = parseInt(hex.slice(2, 4), 16) || 0;
  const bv = parseInt(hex.slice(4, 6), 16) || 0;
  const lum = (0.2126 * rv + 0.7152 * gv + 0.0722 * bv) / 255;

  return {
    "--you-primary": s.primary,
    "--you-on-primary": s.onPrimary,
    "--you-primary-strong": s.primaryStrong,
    "--you-primary-container": s.primaryContainer,
    "--you-on-primary-container": s.onPrimaryContainer,
    "--you-secondary": s.secondary,
    "--you-on-secondary": s.onSecondary,
    "--you-secondary-container": s.secondaryContainer,
    "--you-on-secondary-container": s.onSecondaryContainer,
    "--you-tertiary": s.tertiary,
    "--you-on-tertiary": s.onTertiary,
    "--you-tertiary-container": s.tertiaryContainer,
    "--you-on-tertiary-container": s.onTertiaryContainer,
    "--you-surface": s.surface,
    "--you-surface-low": s.surfaceLow,
    "--you-surface-container": s.surfaceContainer,
    "--you-surface-high": s.surfaceHigh,
    "--you-surface-highest": s.surfaceHighest,
    "--you-on-surface": s.onSurface,
    "--you-on-surface-variant": s.onSurfaceVariant,
    "--you-outline": s.outline,
    "--you-outline-variant": s.outlineVariant,
    colorScheme: lum < 0.45 ? "dark" : "light",
  } as CSSProperties;
}

/* ------------------------------------------------------------
   Живой фон: большие силуэты из заставки плавно перетекают
   друг в друга, размываются и медленно дрейфуют.
   ------------------------------------------------------------ */

const ORB_LAYERS = [
  // период (мс), сдвиг фазы, число сэмплов контура
  { cls: "oobe-you-orb-a", period: 24000, offset: 0, samples: 76 },
  { cls: "oobe-you-orb-b", period: 31500, offset: 0.37, samples: 72 },
  { cls: "oobe-you-orb-c", period: 19800, offset: 0.71, samples: 64 },
  { cls: "oobe-you-orb-outline", period: 42000, offset: 0.18, samples: 96 },
];

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const SHAPE_HOLD = 0.3;

const SPARKS = [
  { left: "12%", top: "24%", size: 9, delay: 0, duration: 9, color: "var(--you-primary)" },
  { left: "83%", top: "18%", size: 13, delay: 1.4, duration: 11, color: "var(--you-secondary)" },
  { left: "74%", top: "72%", size: 7, delay: 2.2, duration: 8, color: "var(--you-tertiary)" },
  { left: "21%", top: "80%", size: 11, delay: 3.1, duration: 12, color: "var(--you-primary-container)" },
  { left: "52%", top: "10%", size: 6, delay: 4.2, duration: 10, color: "var(--you-secondary-container)" },
  { left: "90%", top: "48%", size: 8, delay: 0.8, duration: 13, color: "var(--you-tertiary-container)" },
];

export function OobeYouBackdrop() {
  const uid = useId().replace(/:/g, "");
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const lite = useLiteMotion();
  /* На телефонах оставляем два статичных силуэта вместо четырёх живых. */
  const layers = useMemo(
    () => (lite ? ORB_LAYERS.slice(0, 2) : ORB_LAYERS),
    [lite],
  );

  useEffect(() => {
    const paths = pathRefs.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced || lite) {
      layers.forEach((layer, i) => {
        const spec =
          SHAPE_SEQUENCE[
            Math.floor(layer.offset * SHAPE_SEQUENCE.length) % SHAPE_SEQUENCE.length
          ];
        paths[i]?.setAttribute(
          "d",
          shapePath(spec, 200, 6, lite ? 44 : layer.samples),
        );
      });
      return;
    }

    const start = performance.now();
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      if (now - last >= 32) {
        last = now;
        const elapsed = now - start;

        layers.forEach((layer, i) => {
          const total = SHAPE_SEQUENCE.length;
          const pos = ((elapsed / layer.period + layer.offset) % 1) * total;
          const index = Math.floor(pos);
          const f = pos - index;
          const k =
            f < SHAPE_HOLD ? 0 : easeInOutCubic((f - SHAPE_HOLD) / (1 - SHAPE_HOLD));
          const spec = lerpSpec(
            SHAPE_SEQUENCE[index] ?? SHAPE_SEQUENCE[0],
            SHAPE_SEQUENCE[(index + 1) % total] ?? SHAPE_SEQUENCE[0],
            k,
          );
          paths[i]?.setAttribute("d", shapePath(spec, 200, 6, layer.samples));
        });
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lite, layers]);

  return (
    <div className="oobe-you-bg" aria-hidden>
      {layers.map((layer, i) => {
        const gradientId = `${uid}-orb-${i}`;
        const isOutline = layer.cls === "oobe-you-orb-outline";
        return (
          <svg
            key={layer.cls}
            className={cn("oobe-you-orb", layer.cls)}
            viewBox="0 0 200 200"
          >
            {!isOutline && (
              <defs>
                <linearGradient id={gradientId} x1="8%" y1="4%" x2="94%" y2="98%">
                  {i === 0 && (
                    <>
                      <stop offset="0%" stopColor="var(--you-primary)" stopOpacity="0.94" />
                      <stop offset="58%" stopColor="var(--you-secondary)" stopOpacity="0.72" />
                      <stop offset="100%" stopColor="var(--you-primary-strong)" stopOpacity="0.86" />
                    </>
                  )}
                  {i === 1 && (
                    <>
                      <stop offset="0%" stopColor="var(--you-tertiary)" stopOpacity="0.8" />
                      <stop offset="52%" stopColor="var(--you-tertiary-container)" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="var(--you-primary-container)" stopOpacity="0.85" />
                    </>
                  )}
                  {i === 2 && (
                    <>
                      <stop offset="0%" stopColor="var(--you-secondary)" stopOpacity="0.72" />
                      <stop offset="55%" stopColor="var(--you-secondary-container)" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="var(--you-tertiary)" stopOpacity="0.6" />
                    </>
                  )}
                </linearGradient>
              </defs>
            )}
            <path
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              fill={isOutline ? "none" : `url(#${gradientId})`}
            />
          </svg>
        );
      })}

      <div className="oobe-you-sparks">
        {SPARKS.map((s, i) => (
          <span
            key={i}
            style={{
              left: s.left,
              top: s.top,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.color,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Логотип: тот же перетекающий силуэт, что и в заставке.
   Внутри — знак «W», вырезанный по форме.
   ------------------------------------------------------------ */

export function OobeMorphMark({
  className,
  settle = false,
}: {
  className?: string;
  /** Плавно зафиксировать силуэт в squircle-плитку (финальный экран). */
  settle?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `${uid}-grad`;
  const glowId = `${uid}-glow`;
  const clipId = `${uid}-clip`;
  const pathId = `${uid}-path`;
  const pathRef = useRef<SVGPathElement>(null);
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const lite = useLiteMotion();
  /* Телефонам хватает 96 точек контура — визуально то же, работы втрое меньше. */
  const samples = lite ? 96 : 220;

  const initialPath = useMemo(
    () => shapePath(settleRef.current ? TILE_SPEC : SHAPE_SEQUENCE[0], 200, 4, samples),
    [samples],
  );

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    if (
      lite ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      path.setAttribute(
        "d",
        shapePath(settleRef.current ? TILE_SPEC : SHAPE_SEQUENCE[0], 200, 4, samples),
      );
      return;
    }

    const start = performance.now();
    const STEP = 1900;
    let lastSpec: ShapeSpec = SHAPE_SEQUENCE[0];
    let settleFrom: ShapeSpec | null = null;
    let settleAt = 0;
    let fixed = false;
    let raf = 0;

    const tick = (now: number) => {
      let spec: ShapeSpec;

      if (settleRef.current) {
        if (!settleFrom) {
          settleFrom = lastSpec;
          settleAt = now;
        }
        const k = Math.min(1, (now - settleAt) / 720);
        const e = 1 - Math.pow(1 - k, 3);
        spec = lerpSpec(settleFrom, TILE_SPEC, e);
        if (k >= 1) fixed = true;
      } else {
        const total = SHAPE_SEQUENCE.length;
        const pos = ((now - start) / STEP) % total;
        const index = Math.floor(pos);
        const f = pos - index;
        const k = f < 0.34 ? 0 : easeInOutCubic((f - 0.34) / 0.66);
        spec = lerpSpec(
          SHAPE_SEQUENCE[index] ?? SHAPE_SEQUENCE[0],
          SHAPE_SEQUENCE[(index + 1) % total] ?? SHAPE_SEQUENCE[0],
          k,
        );
        lastSpec = spec;
      }

      path.setAttribute("d", shapePath(spec, 200, 4, samples));
      if (!fixed) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lite, samples]);

  return (
    <div className={cn("oobe-you-mark", className)} aria-hidden>
      <span className="oobe-you-mark-glow" />
      <span className="oobe-you-mark-orbit">
        <i />
      </span>
      <svg className="oobe-you-mark-svg" viewBox="0 0 200 200">
        <defs>
          <linearGradient id={gradientId} x1="10%" y1="0%" x2="92%" y2="100%">
            <stop offset="0%" stopColor="var(--you-primary)" stopOpacity="0.94" />
            <stop offset="52%" stopColor="var(--you-secondary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--you-tertiary)" stopOpacity="0.88" />
          </linearGradient>
          <radialGradient id={glowId} cx="30%" cy="18%" r="82%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.56" />
            <stop offset="46%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <use href={`#${pathId}`} />
          </clipPath>
        </defs>

        <path id={pathId} ref={pathRef} d={initialPath} fill={`url(#${gradientId})`} />
        <g clipPath={`url(#${clipId})`}>
          <rect width="200" height="200" fill={`url(#${glowId})`} />
          <text
            x="100"
            y="102"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="112"
            fontWeight="800"
            letterSpacing="-6"
            fill="#0b1a2b"
            fillOpacity="0.94"
            style={{
              fontFamily:
                '"Google Sans", "Outfit", "Roboto", ui-sans-serif, system-ui, sans-serif',
            }}
          >
            W
          </text>
        </g>
        <use
          href={`#${pathId}`}
          fill="none"
          stroke="var(--you-on-surface)"
          strokeOpacity="0.22"
          strokeWidth="1.3"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------
   Шапка и прогресс
   ------------------------------------------------------------ */

export function OobeYouTopBar({
  subtitle,
  badge = "6.0",
}: {
  subtitle: string;
  badge?: string;
}) {
  return (
    <header className="oobe-you-topbar">
      <div className="oobe-you-brand">
        <span className="oobe-you-brand-logo">
          <img
            src="/logo.jpg"
            alt=""
            width={42}
            height={42}
            decoding="async"
            onError={(e) => {
              /* Логотип не загрузился — остаётся градиентная плитка, без «белого квадрата». */
              e.currentTarget.style.display = "none";
            }}
          />
        </span>
        <span className="oobe-you-brand-text">
          <strong>WinChat</strong>
          <small>{subtitle}</small>
        </span>
      </div>
      <span className="oobe-you-version">{badge}</span>
    </header>
  );
}

export function OobeYouSteps({
  value,
  total = 3,
}: {
  value: number;
  total?: number;
}) {
  return (
    <div className="oobe-you-steps" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "oobe-you-steps-seg",
            i < value && "is-done",
            i === value && "is-active",
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------
   Кнопка Material 3 (filled / tonal / text)
   ------------------------------------------------------------ */

export function OobeYouButton({
  label,
  onClick,
  type = "button",
  variant = "filled",
  disabled,
  loading,
  leading,
  className,
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "filled" | "tonal" | "text";
  disabled?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "oobe-you-action",
        `oobe-you-action-${variant}`,
        className,
      )}
    >
      {leading && !loading && <span className="oobe-you-action-leading">{leading}</span>}
      <span className="oobe-you-action-label">{label}</span>
      <span className="oobe-you-action-arrow">
        {loading ? <Loader2 className="oobe-you-spin" /> : <ArrowRight />}
      </span>
    </button>
  );
}
