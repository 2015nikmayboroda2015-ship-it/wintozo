/**
 * Формы WinChat You — те же силуэты Material 3 Expressive, что перетекают
 * в бут-анимации (см. BootAnimation_you.tsx).
 *
 * Геометрия одна на заставку и на интерфейс:
 *  • shapePath()  — замкнутый SVG-путь для больших превью и самой анимации;
 *  • shapeClip()  — CSS clip-path (polygon в процентах) для кнопок.
 *
 * Внутри силуэта — суперэллипс нужной «квадратности» плюс гармоники:
 * лепестки (clover / burst) или вмятины (cookie). Всё считается в
 * полярных координатах, поэтому формы легко перетекают друг в друга.
 */

/** Силуэты из бут-анимации. */
export type ExpressiveYouShape =
  | "squircle"
  | "arch"
  | "diamond"
  | "circle"
  | "cookie4"
  | "clover4"
  | "cookie7"
  | "burst"
  | "cookie9";

/** Стандартные варианты скругления (были в кастомизации изначально). */
export type ClassicYouShape = "pill" | "rounded" | "soft" | "square";

export type YouShape = ExpressiveYouShape | ClassicYouShape;

export type YouShapeGroup = "standard" | "expressive";

/** Одна гармоника силуэта: N-угольность + волна по сторонам. */
export interface Harmonic {
  /** Количество «сторон» / лепестков (только целое — иначе разомкнётся контур). */
  sides: number;
  /** > 0 — лепестки (clover/burst), < 0 — вмятины (cookie). */
  wave: number;
  /** Смешение к правильному N-угольнику (0 — чистый суперэллипс). */
  poly: number;
}

export interface ShapeSpec {
  /** Показатель суперэллипса: 2 — круг, больше — квадратнее. */
  n: number;
  /** Показатель для нижней половины (arch: сверху кругло, снизу квадратно). */
  nBottom: number;
  harmonics: Harmonic[];
  /** Мягкие органичные волны силуэта. */
  wobble: number;
  wobblePhase: number;
}

export const h = (sides: number, wave: number, poly: number): Harmonic => ({
  sides,
  wave,
  poly,
});

const SQUIRCLE: ShapeSpec = {
  n: 3.4,
  nBottom: 3.4,
  harmonics: [],
  wobble: 0,
  wobblePhase: 0,
};

export const YOU_SHAPE_SPECS: Record<ExpressiveYouShape, ShapeSpec> = {
  /* Squircle — «плитка» приложения */
  squircle: SQUIRCLE,
  /* Arch — настоящая M3-форма: сверху кругло, снизу почти квадрат */
  arch: { n: 2, nBottom: 6.4, harmonics: [], wobble: 0, wobblePhase: 0 },
  /* Diamond — мягкий ромб */
  diamond: { n: 1.32, nBottom: 1.32, harmonics: [], wobble: 0, wobblePhase: 0 },
  /* Circle */
  circle: { n: 2, nBottom: 2, harmonics: [], wobble: 0, wobblePhase: 0 },
  /* Cookie 4-sided */
  cookie4: { n: 3, nBottom: 3, harmonics: [h(4, -0.1, 0.26)], wobble: 0, wobblePhase: 0 },
  /* Clover 4 — те же 4 стороны, волна меняет знак (плавно через круг) */
  clover4: { n: 2.2, nBottom: 2.2, harmonics: [h(4, 0.15, 0)], wobble: 0, wobblePhase: 0 },
  /* Cookie 7-sided */
  cookie7: { n: 2.7, nBottom: 2.7, harmonics: [h(7, -0.085, 0.3)], wobble: 0, wobblePhase: 0 },
  /* Soft burst — 12 мягких лучей */
  burst: { n: 2, nBottom: 2, harmonics: [h(12, 0.115, 0)], wobble: 0, wobblePhase: 0 },
  /* Cookie 9-sided */
  cookie9: { n: 2.5, nBottom: 2.5, harmonics: [h(9, -0.075, 0.28)], wobble: 0, wobblePhase: 0 },
};

/** Порядок перетекания в бут-анимации. */
export const SHAPE_SEQUENCE: ShapeSpec[] = [
  YOU_SHAPE_SPECS.squircle,
  YOU_SHAPE_SPECS.arch,
  YOU_SHAPE_SPECS.diamond,
  YOU_SHAPE_SPECS.circle,
  YOU_SHAPE_SPECS.cookie4,
  YOU_SHAPE_SPECS.clover4,
  YOU_SHAPE_SPECS.cookie7,
  YOU_SHAPE_SPECS.burst,
  YOU_SHAPE_SPECS.cookie9,
];

/** Куда форма «садится», когда приложение готово. */
export const TILE_SPEC: ShapeSpec = {
  n: 3.6,
  nBottom: 3.6,
  harmonics: [],
  wobble: 0,
  wobblePhase: 0,
};

export const DEFAULT_YOU_SHAPE: YouShape = "rounded";

export interface YouShapeOption {
  id: YouShape;
  name: string;
  /** Подсказка при наведении. */
  hint: string;
  group: YouShapeGroup;
  /** Силуэт есть только у expressive-форм. */
  spec?: ShapeSpec;
  /** Радиусы для элементов без clip-path (поиск, композер, строки). */
  r: string;
  rSm: string;
  rLg: string;
  /** Готовый CSS clip-path (polygon в процентах) или none. */
  clip: string;
}

const OPTION_META: {
  id: YouShape;
  name: string;
  hint: string;
  group: YouShapeGroup;
  r: string;
  rSm: string;
  rLg: string;
}[] = [
  /* ---------- Стандартные (как было до expressive-форм) ---------- */
  {
    id: "pill",
    name: "Пилюли",
    hint: "Полностью круглые кнопки",
    group: "standard",
    r: "28px",
    rSm: "20px",
    rLg: "999px",
  },
  {
    id: "rounded",
    name: "Закруглённая",
    hint: "Стандартная форма — мягкие углы",
    group: "standard",
    r: "22px",
    rSm: "14px",
    rLg: "28px",
  },
  {
    id: "soft",
    name: "Мягкая",
    hint: "Небольшое скругление",
    group: "standard",
    r: "14px",
    rSm: "10px",
    rLg: "18px",
  },
  {
    id: "square",
    name: "Квадратная",
    hint: "Почти прямые углы",
    group: "standard",
    r: "8px",
    rSm: "6px",
    rLg: "10px",
  },

  /* ---------- Expressive-формы из бут-анимации ---------- */
  {
    id: "squircle",
    name: "Плитка",
    hint: "Скруглённый квадрат — финальная форма заставки",
    group: "expressive",
    r: "26px",
    rSm: "18px",
    rLg: "34px",
  },
  {
    id: "arch",
    name: "Арка",
    hint: "Сверху кругло, снизу почти квадрат",
    group: "expressive",
    r: "22px",
    rSm: "16px",
    rLg: "30px",
  },
  {
    id: "diamond",
    name: "Ромб",
    hint: "Мягкий ромб",
    group: "expressive",
    r: "18px",
    rSm: "12px",
    rLg: "26px",
  },
  {
    id: "circle",
    name: "Круг",
    hint: "Полностью круглые кнопки",
    group: "expressive",
    r: "999px",
    rSm: "999px",
    rLg: "999px",
  },
  {
    id: "cookie4",
    name: "Печенье",
    hint: "Четыре мягкие вмятины по углам",
    group: "expressive",
    r: "26px",
    rSm: "18px",
    rLg: "34px",
  },
  {
    id: "clover4",
    name: "Клевер",
    hint: "Четыре лепестка — как в Material You",
    group: "expressive",
    r: "30px",
    rSm: "22px",
    rLg: "40px",
  },
  {
    id: "cookie7",
    name: "Звезда",
    hint: "Семилучевая форма с вмятинами",
    group: "expressive",
    r: "24px",
    rSm: "16px",
    rLg: "32px",
  },
  {
    id: "burst",
    name: "Вспышка",
    hint: "Мягкое сияние из двенадцати лучей",
    group: "expressive",
    r: "28px",
    rSm: "20px",
    rLg: "38px",
  },
  {
    id: "cookie9",
    name: "Цветок",
    hint: "Девять мягких вмятин — форма-цветок",
    group: "expressive",
    r: "26px",
    rSm: "18px",
    rLg: "34px",
  },
];

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Радиус суперэллипса для угла t. */
function superRadius(t: number, n: number): number {
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
}

/** Радиус правильного N-угольника (апофема = 1). */
function polygonRadius(t: number, sides: number): number {
  const seg = (Math.PI * 2) / sides;
  const a = (((t % seg) + seg) % seg) - seg / 2;
  return 1 / Math.cos(a);
}

/** Радиус силуэта для угла t (без масштабирования). */
function specRadius(spec: ShapeSpec, t: number): number {
  const sin = Math.sin(t);
  const n =
    sin > 0
      ? spec.n + (spec.nBottom - spec.n) * smoothstep(Math.min(1, sin))
      : spec.n;
  let r = superRadius(t, n);

  for (const harm of spec.harmonics) {
    const pr = polygonRadius(t, harm.sides);
    r = r * (1 - harm.poly) + pr * harm.poly;
    r *= 1 + harm.wave * Math.cos(harm.sides * t);
  }

  return r * (1 + spec.wobble * Math.cos(3 * t + spec.wobblePhase));
}

/**
 * Перетекание двух силуэтов. Гармоники с разным числом сторон не
 * интерполируются по частоте (иначе рвётся контур), а перекрёстно
 * затухают: старые лепестки гаснут, новые проявляются.
 */
export function lerpSpec(a: ShapeSpec, b: ShapeSpec, k: number): ShapeSpec {
  const harmonics: Harmonic[] = [];
  const seen = new Set<number>();

  for (const ha of a.harmonics) {
    if (seen.has(ha.sides)) continue;
    seen.add(ha.sides);
    const hb = b.harmonics.find((x) => x.sides === ha.sides);
    harmonics.push({
      sides: ha.sides,
      wave: ha.wave + ((hb?.wave ?? 0) - ha.wave) * k,
      poly: ha.poly + ((hb?.poly ?? 0) - ha.poly) * k,
    });
  }
  for (const hb of b.harmonics) {
    if (seen.has(hb.sides)) continue;
    seen.add(hb.sides);
    harmonics.push({ ...hb, wave: hb.wave * k, poly: hb.poly * k });
  }

  return {
    n: a.n + (b.n - a.n) * k,
    nBottom: a.nBottom + (b.nBottom - a.nBottom) * k,
    harmonics: harmonics.filter(
      (x) => Math.abs(x.wave) > 0.0005 || Math.abs(x.poly) > 0.0005,
    ),
    wobble: a.wobble + (b.wobble - a.wobble) * k,
    wobblePhase: a.wobblePhase + (b.wobblePhase - a.wobblePhase) * k,
  };
}

/**
 * Строит замкнутый сглаженный SVG-путь по силуэту и вписывает его
 * в квадрат view×view, чтобы все формы были одного размера.
 */
export function shapePath(
  spec: ShapeSpec,
  view = 200,
  pad = 4,
  samples = 252,
): string {
  const points: [number, number][] = [];

  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const r = specRadius(spec, t);
    points.push([Math.cos(t) * r, Math.sin(t) * r]);
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
  const scale = (view - pad * 2) / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const p = points.map(
    ([x, y]) =>
      [
        (x - cx) * scale + view / 2,
        (y - cy) * scale + view / 2,
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

/**
 * CSS clip-path для элемента: polygon в процентах, поэтому форма
 * растягивается по размеру кнопки, но остаётся тем же силуэтом.
 */
function polygonClip(spec: ShapeSpec, samples = 96): string {
  const points: [number, number][] = [];
  let maxAbs = 0;

  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const r = specRadius(spec, t);
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y));
    points.push([x, y]);
  }

  const k = 50 / (maxAbs || 1);
  return `polygon(${points
    .map(([x, y]) => `${(50 + x * k).toFixed(2)}% ${(50 + y * k).toFixed(2)}%`)
    .join(", ")})`;
}

const clipCache = new Map<ExpressiveYouShape, string>();

/** Готовый CSS clip-path для expressive-формы (кэшируется). */
export function shapeClip(id: ExpressiveYouShape): string {
  const cached = clipCache.get(id);
  if (cached) return cached;
  const clip = polygonClip(YOU_SHAPE_SPECS[id]);
  clipCache.set(id, clip);
  return clip;
}

export const YOU_SHAPES: YouShapeOption[] = OPTION_META.map((meta) => {
  const expressive = meta.group === "expressive";
  return {
    ...meta,
    spec: expressive
      ? YOU_SHAPE_SPECS[meta.id as ExpressiveYouShape]
      : undefined,
    clip: expressive ? shapeClip(meta.id as ExpressiveYouShape) : "none",
  } satisfies YouShapeOption;
});

const SHAPE_BY_ID = new Map<YouShape, YouShapeOption>(
  YOU_SHAPES.map((s) => [s.id, s]),
);

export function getYouShapeOption(id: YouShape): YouShapeOption {
  return SHAPE_BY_ID.get(id) ?? SHAPE_BY_ID.get(DEFAULT_YOU_SHAPE)!;
}

export function normalizeYouShape(raw: string | null | undefined): YouShape {
  if (!raw) return DEFAULT_YOU_SHAPE;
  return SHAPE_BY_ID.has(raw as YouShape) ? (raw as YouShape) : DEFAULT_YOU_SHAPE;
}
