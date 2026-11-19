/**
 * WinChat You — палитры Material You (Material 3 Expressive).
 *
 * В настоящем Material You схема строится из обоев устройства (dynamic color).
 * В вебе обоев нет, поэтому мы даём выбор «seed»-цвета, а из него собираем
 * выразительную схему: насыщенные контейнеры, контрастные акценты (коралл,
 * лайм), крупные формы и тональные поверхности.
 */

import type { CSSProperties } from "react";
import {
  DEFAULT_YOU_SHAPE,
  getYouShapeOption,
  normalizeYouShape,
  type YouShape,
} from "./youShapes";

export { YOU_SHAPES, type YouShape } from "./youShapes";

export interface YouSeed {
  id: string;
  name: string;
  seed: string;
  /** Основной цвет бренда и заливок. */
  primary: string;
  onPrimary: string;
  primaryStrong: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  /** Тёплый контрастный акцент (коралл / малина). */
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  /** Второй контрастный акцент (лайм / мята / голубой). */
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  surface: string;
  surfaceLow: string;
  surfaceContainer: string;
  surfaceHigh: string;
  surfaceHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
}

export const YOU_SEEDS: YouSeed[] = [
  {
    id: "lavender",
    name: "Лаванда",
    seed: "#7c4dff",
    primary: "#7c4dff",
    onPrimary: "#ffffff",
    primaryStrong: "#5b2ee0",
    primaryContainer: "#e4d7ff",
    onPrimaryContainer: "#2a0a5e",
    secondary: "#ff7a6b",
    onSecondary: "#4a0f08",
    secondaryContainer: "#ffdad4",
    onSecondaryContainer: "#410002",
    tertiary: "#a8e06a",
    onTertiary: "#1b3400",
    tertiaryContainer: "#d7f5b0",
    onTertiaryContainer: "#1e3700",
    surface: "#efe5ff",
    surfaceLow: "#f7f0ff",
    surfaceContainer: "#ebe0ff",
    surfaceHigh: "#e3d5ff",
    surfaceHighest: "#dbc9ff",
    onSurface: "#1d1233",
    onSurfaceVariant: "#54406f",
    outline: "#8873a3",
    outlineVariant: "#d6c4ec",
  },
  {
    id: "ocean",
    name: "Океан",
    seed: "#0077b6",
    primary: "#00639b",
    onPrimary: "#ffffff",
    primaryStrong: "#00456e",
    primaryContainer: "#c9e6ff",
    onPrimaryContainer: "#001d33",
    secondary: "#ff8b5e",
    onSecondary: "#451200",
    secondaryContainer: "#ffdbcc",
    onSecondaryContainer: "#2f0b00",
    tertiary: "#24c9b0",
    onTertiary: "#00382d",
    tertiaryContainer: "#a2f2e2",
    onTertiaryContainer: "#00201a",
    surface: "#e7f3ff",
    surfaceLow: "#f4faff",
    surfaceContainer: "#d7ecfd",
    surfaceHigh: "#c8e3f7",
    surfaceHighest: "#b8d9f1",
    onSurface: "#071d2c",
    onSurfaceVariant: "#3c5567",
    outline: "#698398",
    outlineVariant: "#bdd3e2",
  },
  {
    id: "laguna",
    name: "Лагуна",
    seed: "#00897b",
    primary: "#00786b",
    onPrimary: "#ffffff",
    primaryStrong: "#00594f",
    primaryContainer: "#b4ece1",
    onPrimaryContainer: "#00201b",
    secondary: "#ff8a65",
    onSecondary: "#4a1500",
    secondaryContainer: "#ffdbcf",
    onSecondaryContainer: "#341000",
    tertiary: "#5b64d6",
    onTertiary: "#ffffff",
    tertiaryContainer: "#e0e2ff",
    onTertiaryContainer: "#12175e",
    surface: "#e6f5f1",
    surfaceLow: "#f2fbf8",
    surfaceContainer: "#d7eeea",
    surfaceHigh: "#c8e7e1",
    surfaceHighest: "#b8ded7",
    onSurface: "#0a201c",
    onSurfaceVariant: "#3d5a54",
    outline: "#6b8a82",
    outlineVariant: "#bfdcd4",
  },
  {
    id: "forest",
    name: "Лес",
    seed: "#2e7d32",
    primary: "#2e7d32",
    onPrimary: "#ffffff",
    primaryStrong: "#1b5e20",
    primaryContainer: "#c8f7c5",
    onPrimaryContainer: "#002204",
    secondary: "#ff7a6b",
    onSecondary: "#4a0f08",
    secondaryContainer: "#ffdad4",
    onSecondaryContainer: "#410002",
    tertiary: "#7cd4c8",
    onTertiary: "#002b26",
    tertiaryContainer: "#b8f0e8",
    onTertiaryContainer: "#00201c",
    surface: "#e7f6e4",
    surfaceLow: "#f3fbf1",
    surfaceContainer: "#ddf1d9",
    surfaceHigh: "#d2ebcd",
    surfaceHighest: "#c6e4c1",
    onSurface: "#101f10",
    onSurfaceVariant: "#3f5240",
    outline: "#6e826f",
    outlineVariant: "#c0d4bf",
  },
  {
    id: "sunset",
    name: "Закат",
    seed: "#e65100",
    primary: "#e65100",
    onPrimary: "#ffffff",
    primaryStrong: "#b23c00",
    primaryContainer: "#ffdcc4",
    onPrimaryContainer: "#3a1100",
    secondary: "#ff5d8f",
    onSecondary: "#4d0023",
    secondaryContainer: "#ffd9e3",
    onSecondaryContainer: "#3e001c",
    tertiary: "#9ccc65",
    onTertiary: "#1c3400",
    tertiaryContainer: "#d4f5a8",
    onTertiaryContainer: "#142600",
    surface: "#fff0e4",
    surfaceLow: "#fff8f1",
    surfaceContainer: "#ffe8d6",
    surfaceHigh: "#ffdfc7",
    surfaceHighest: "#ffd5b8",
    onSurface: "#2a1200",
    onSurfaceVariant: "#6b4a2e",
    outline: "#96724f",
    outlineVariant: "#e6c8ac",
  },
  {
    id: "cherry",
    name: "Вишня",
    seed: "#d81b60",
    onPrimary: "#ffffff",
    primaryStrong: "#a70046",
    primary: "#d81b60",
    primaryContainer: "#ffd9e2",
    onPrimaryContainer: "#3e001d",
    secondary: "#ff9e6d",
    onSecondary: "#4a1c00",
    secondaryContainer: "#ffe0cc",
    onSecondaryContainer: "#3a1400",
    tertiary: "#9ad6ff",
    onTertiary: "#002f47",
    tertiaryContainer: "#cbe8ff",
    onTertiaryContainer: "#001e30",
    surface: "#ffe8ef",
    surfaceLow: "#fff5f8",
    surfaceContainer: "#ffdfe9",
    surfaceHigh: "#ffd3e1",
    surfaceHighest: "#ffc7d8",
    onSurface: "#2a0a14",
    onSurfaceVariant: "#6b3b4a",
    outline: "#9a6a78",
    outlineVariant: "#e6bcc8",
  },
  {
    id: "indigo",
    name: "Индиго",
    seed: "#5b5bff",
    primary: "#5b5bff",
    onPrimary: "#ffffff",
    primaryStrong: "#3b3bdb",
    primaryContainer: "#dfe0ff",
    onPrimaryContainer: "#0c0a6b",
    secondary: "#ff7a6b",
    onSecondary: "#4a0f08",
    secondaryContainer: "#ffdad4",
    onSecondaryContainer: "#410002",
    tertiary: "#8ce99a",
    onTertiary: "#00340c",
    tertiaryContainer: "#c9f7cf",
    onTertiaryContainer: "#002106",
    surface: "#e8e8ff",
    surfaceLow: "#f3f3ff",
    surfaceContainer: "#dfdfFA",
    surfaceHigh: "#d3d4f6",
    surfaceHighest: "#c6c8f0",
    onSurface: "#13132b",
    onSurfaceVariant: "#46465f",
    outline: "#74748e",
    outlineVariant: "#c7c7e0",
  },
  {
    id: "red",
    name: "Красный",
    seed: "#cf2e3c",
    primary: "#cf2e3c",
    onPrimary: "#ffffff",
    primaryStrong: "#a32431",
    primaryContainer: "#ffdfe1",
    onPrimaryContainer: "#4e0b12",
    secondary: "#ff7a5c",
    onSecondary: "#430b03",
    secondaryContainer: "#ffd8cd",
    onSecondaryContainer: "#3c0903",
    tertiary: "#b18cff",
    onTertiary: "#2a1045",
    tertiaryContainer: "#e0d2ff",
    onTertiaryContainer: "#241040",
    surface: "#fff1ef",
    surfaceLow: "#fdf6f5",
    surfaceContainer: "#ffe9e6",
    surfaceHigh: "#ffe2db",
    surfaceHighest: "#ffd8cf",
    onSurface: "#2b0d0a",
    onSurfaceVariant: "#6b3c35",
    outline: "#9a5f58",
    outlineVariant: "#e8c9c3",
  },
  {
    id: "orange",
    name: "Оранжевый",
    seed: "#ee7b1d",
    primary: "#ee7b1d",
    onPrimary: "#ffffff",
    primaryStrong: "#c96612",
    primaryContainer: "#ffe0bd",
    onPrimaryContainer: "#3a1800",
    secondary: "#ff5c52",
    onSecondary: "#4a0d08",
    secondaryContainer: "#ffd7cf",
    onSecondaryContainer: "#3a0a06",
    tertiary: "#8ce99a",
    onTertiary: "#00340c",
    tertiaryContainer: "#c9f7cf",
    onTertiaryContainer: "#002106",
    surface: "#fff3e8",
    surfaceLow: "#fdf8f2",
    surfaceContainer: "#fbe8d8",
    surfaceHigh: "#f8dec6",
    surfaceHighest: "#f4d5b8",
    onSurface: "#301a0c",
    onSurfaceVariant: "#6b4a2e",
    outline: "#8f6a45",
    outlineVariant: "#e6c8a8",
  },
  {
    id: "beige",
    name: "Бежевый",
    seed: "#7c4a20",
    primary: "#7c4a20",
    onPrimary: "#fff6ea",
    primaryStrong: "#5f360f",
    primaryContainer: "#ecd9c0",
    onPrimaryContainer: "#3a2412",
    secondary: "#c26a35",
    onSecondary: "#fff3ea",
    secondaryContainer: "#f5d9c6",
    onSecondaryContainer: "#40200c",
    tertiary: "#8a9a4e",
    onTertiary: "#2c3813",
    tertiaryContainer: "#e2e8c6",
    onTertiaryContainer: "#333d12",
    surface: "#f2e9dc",
    surfaceLow: "#f8f2e9",
    surfaceContainer: "#eee2d2",
    surfaceHigh: "#e7d8c4",
    surfaceHighest: "#e0cfb6",
    onSurface: "#2b2118",
    onSurfaceVariant: "#6b5a48",
    outline: "#96795a",
    outlineVariant: "#d9c8b2",
  },
  {
    id: "amber",
    name: "Янтарь",
    seed: "#c98a00",
    primary: "#8a5a00",
    onPrimary: "#ffffff",
    primaryStrong: "#6b4400",
    primaryContainer: "#ffdfa8",
    onPrimaryContainer: "#2b1b00",
    secondary: "#b0305c",
    onSecondary: "#ffffff",
    secondaryContainer: "#ffd9e2",
    onSecondaryContainer: "#3c0021",
    tertiary: "#1565c0",
    onTertiary: "#ffffff",
    tertiaryContainer: "#d6e3ff",
    onTertiaryContainer: "#001a41",
    surface: "#fff5e1",
    surfaceLow: "#fffbf3",
    surfaceContainer: "#fbe9ca",
    surfaceHigh: "#f5ddb2",
    surfaceHighest: "#eed2a0",
    onSurface: "#2b1c00",
    onSurfaceVariant: "#6b5636",
    outline: "#947f58",
    outlineVariant: "#e3d0aa",
  },
  {
    id: "sakura",
    name: "Сакура",
    seed: "#b03a63",
    primary: "#a8385f",
    onPrimary: "#ffffff",
    primaryStrong: "#85284a",
    primaryContainer: "#ffd9e3",
    onPrimaryContainer: "#3c0021",
    secondary: "#6d5bd0",
    onSecondary: "#ffffff",
    secondaryContainer: "#e5deff",
    onSecondaryContainer: "#21005d",
    tertiary: "#0f766e",
    onTertiary: "#ffffff",
    tertiaryContainer: "#b9ede6",
    onTertiaryContainer: "#00201c",
    surface: "#fdeef5",
    surfaceLow: "#fff8fb",
    surfaceContainer: "#fbe0ea",
    surfaceHigh: "#f6d3e1",
    surfaceHighest: "#f0c6d8",
    onSurface: "#2c0d18",
    onSurfaceVariant: "#66414f",
    outline: "#9a6f7e",
    outlineVariant: "#e6c2d0",
  },
  {
    id: "dark",
    name: "Тёмный",
    seed: "#8b7cf6",
    primary: "#a78bfa",
    onPrimary: "#1b0f33",
    primaryStrong: "#7c5cf0",
    primaryContainer: "#3b2a5e",
    onPrimaryContainer: "#e9defc",
    secondary: "#ff8a75",
    onSecondary: "#3a0d05",
    secondaryContainer: "#4a2350",
    onSecondaryContainer: "#ffd9d2",
    tertiary: "#8ce99a",
    onTertiary: "#0d2c0f",
    tertiaryContainer: "#1f4026",
    onTertiaryContainer: "#c9f7cf",
    surface: "#1b1425",
    surfaceLow: "#211832",
    surfaceContainer: "#271c38",
    surfaceHigh: "#2d2140",
    surfaceHighest: "#332746",
    onSurface: "#f3edfb",
    onSurfaceVariant: "#c9bfe0",
    outline: "#7f70a3",
    outlineVariant: "#473a63",
  },
  {
    id: "cosmos",
    name: "Космос",
    seed: "#8f79ff",
    primary: "#b7a6ff",
    onPrimary: "#21105c",
    primaryStrong: "#8f79ff",
    primaryContainer: "#3b2a70",
    onPrimaryContainer: "#e7deff",
    secondary: "#ff8fb1",
    onSecondary: "#4a0024",
    secondaryContainer: "#52233b",
    onSecondaryContainer: "#ffd9e4",
    tertiary: "#6fe3d6",
    onTertiary: "#003730",
    tertiaryContainer: "#124f47",
    onTertiaryContainer: "#b8f5ec",
    surface: "#100e1c",
    surfaceLow: "#171327",
    surfaceContainer: "#1d1833",
    surfaceHigh: "#241d3d",
    surfaceHighest: "#2b2347",
    onSurface: "#ece8ff",
    onSurfaceVariant: "#c3bce0",
    outline: "#7a7296",
    outlineVariant: "#453f63",
  },
  {
    id: "graphite",
    name: "Графит",
    seed: "#7aa7f0",
    primary: "#9ec3ff",
    onPrimary: "#002f5f",
    primaryStrong: "#7aa7f0",
    primaryContainer: "#1f3a5c",
    onPrimaryContainer: "#d6e5ff",
    secondary: "#ffb59c",
    onSecondary: "#4a1500",
    secondaryContainer: "#4d261b",
    onSecondaryContainer: "#ffdbcf",
    tertiary: "#9ed6b0",
    onTertiary: "#00391f",
    tertiaryContainer: "#1b4a31",
    onTertiaryContainer: "#baf3cd",
    surface: "#121417",
    surfaceLow: "#191c20",
    surfaceContainer: "#1f2327",
    surfaceHigh: "#262b30",
    surfaceHighest: "#2d3339",
    onSurface: "#e8eaee",
    onSurfaceVariant: "#bcc3cc",
    outline: "#77808a",
    outlineVariant: "#404750",
  },
];

const SEED_KEY = "winchat_you_seed";
const DEFAULT_SEED = YOU_SEEDS[0].id;

export function getYouSeedId(): string {
  try {
    return localStorage.getItem(SEED_KEY) || DEFAULT_SEED;
  } catch {
    return DEFAULT_SEED;
  }
}

export function saveYouSeedId(id: string): void {
  try {
    localStorage.setItem(SEED_KEY, id);
  } catch {
    /* no-op */
  }
}

export function getYouSeed(id = getYouSeedId()): YouSeed {
  return YOU_SEEDS.find((s) => s.id === id) ?? YOU_SEEDS[0];
}

const SHAPE_KEY = "winchat_you_shape";

export function getYouShape(): YouShape {
  try {
    return normalizeYouShape(localStorage.getItem(SHAPE_KEY));
  } catch {
    return DEFAULT_YOU_SHAPE;
  }
}

export function saveYouShape(id: YouShape): void {
  try {
    localStorage.setItem(SHAPE_KEY, id);
  } catch {
    /* no-op */
  }
}

export function applyYouShape(id = getYouShape()): YouShape {
  const s = getYouShapeOption(id);
  const r = document.documentElement.style;
  r.setProperty("--you-r", s.r);
  r.setProperty("--you-r-sm", s.rSm);
  r.setProperty("--you-r-lg", s.rLg);
  // Силуэт из бут-анимации: кнопки You обрезаются этим clip-path.
  r.setProperty("--you-shape-clip", s.clip);
  document.documentElement.dataset.youShape = s.id;
  window.dispatchEvent(new Event("winchat-you-shape-change"));
  return s.id;
}

/**
 * CSS-переменные Material You (префикс --yb-) для бут-анимации, собранные
 * из выбранного сида You. Fallback, если переменной нет, — базовая M3-палитра.
 * Стартовая заставка (BootAnimation_you) использует их, чтобы она точно
 * следовала цвету активной темы (например, «Лаванда» → голубая лаванда).
 */
export function youPaletteVars(seed: YouSeed = getYouSeed()): CSSProperties {
  const v = {
    "--yb-primary": seed.primary,
    "--yb-on-primary": seed.onPrimary,
    "--yb-primary-strong": seed.primaryStrong,
    "--yb-primary-container": seed.primaryContainer,
    "--yb-on-primary-container": seed.onPrimaryContainer,
    "--yb-secondary": seed.secondary,
    "--yb-on-secondary": seed.onSecondary,
    "--yb-secondary-container": seed.secondaryContainer,
    "--yb-on-secondary-container": seed.onSecondaryContainer,
    "--yb-tertiary": seed.tertiary,
    "--yb-on-tertiary": seed.onTertiary,
    "--yb-tertiary-container": seed.tertiaryContainer,
    "--yb-on-tertiary-container": seed.onTertiaryContainer,
    "--yb-surface": seed.surface,
    "--yb-surface-low": seed.surfaceLow,
    "--yb-surface-container": seed.surfaceContainer,
    "--yb-surface-high": seed.surfaceHigh,
    "--yb-surface-highest": seed.surfaceHighest,
    "--yb-on-surface": seed.onSurface,
    "--yb-on-surface-variant": seed.onSurfaceVariant,
    "--yb-outline": seed.outline,
    "--yb-outline-variant": seed.outlineVariant,
  };
  return v as CSSProperties;
}

/** Применить выразительную схему Material You к CSS-переменным документа. */
export function applyYouPalette(id = getYouSeedId()): YouSeed {
  const s = getYouSeed(id);
  const r = document.documentElement.style;

  r.setProperty("--you-primary", s.primary);
  r.setProperty("--you-on-primary", s.onPrimary);
  r.setProperty("--you-primary-strong", s.primaryStrong);
  r.setProperty("--you-primary-container", s.primaryContainer);
  r.setProperty("--you-on-primary-container", s.onPrimaryContainer);
  r.setProperty("--you-secondary", s.secondary);
  r.setProperty("--you-on-secondary", s.onSecondary);
  r.setProperty("--you-secondary-container", s.secondaryContainer);
  r.setProperty("--you-on-secondary-container", s.onSecondaryContainer);
  r.setProperty("--you-tertiary", s.tertiary);
  r.setProperty("--you-on-tertiary", s.onTertiary);
  r.setProperty("--you-tertiary-container", s.tertiaryContainer);
  r.setProperty("--you-on-tertiary-container", s.onTertiaryContainer);
  r.setProperty("--you-surface", s.surface);
  r.setProperty("--you-surface-low", s.surfaceLow);
  r.setProperty("--you-surface-container", s.surfaceContainer);
  r.setProperty("--you-surface-high", s.surfaceHigh);
  r.setProperty("--you-surface-highest", s.surfaceHighest);
  r.setProperty("--you-on-surface", s.onSurface);
  r.setProperty("--you-on-surface-variant", s.onSurfaceVariant);
  r.setProperty("--you-outline", s.outline);
  r.setProperty("--you-outline-variant", s.outlineVariant);

  // Общие акценты WinChat тоже подстраиваются под «обои».
  r.setProperty("--color-accent", s.primary);
  r.setProperty("--color-accent-soft", s.primaryContainer);
  r.setProperty("--color-paper", s.surface);
  r.setProperty("--color-ink", s.onSurface);
  r.setProperty("--color-ink-soft", s.onSurfaceVariant);

  applyYouShape();

  // Тёмная палитра? (по относительной яркости поверхности)
  const hex = s.surface.replace("#", "");
  const rv = parseInt(hex.slice(0, 2), 16);
  const gv = parseInt(hex.slice(2, 4), 16);
  const bv = parseInt(hex.slice(4, 6), 16);
  const lum = (0.2126 * rv + 0.7152 * gv + 0.0722 * bv) / 255;
  const scheme = lum < 0.45 ? "dark" : "light";
  document.documentElement.dataset.youScheme = scheme;
  document.documentElement.style.colorScheme = scheme;

  document.documentElement.dataset.youSeed = s.id;
  window.dispatchEvent(new Event("winchat-you-seed-change"));
  return s;
}
