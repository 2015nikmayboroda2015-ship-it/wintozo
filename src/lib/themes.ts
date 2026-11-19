/**
 * WinChat Themes — палитры интерфейса.
 * Каждая тема задаёт: основной accent, soft-фон, фон чатов, шапку, градиент аватара.
 */

import { applyYouPalette, getYouSeedId } from "./materialYou";

/** id темы Material You — она включает отдельный режим WinChat You. */
export const YOU_THEME_ID = "material-you";

/** id темы Liquid Glass — отдельный режим WinChat Glass. */
export const GLASS_THEME_ID = "glass";

export const THEMES = [
  {
    id: "ink-blue",
    name: "Классика",
    description: "Тёмный акцент, синий акцент — базовая палитра WinChat",
    accent: "#2b4fff",
    accentSoft: "#e8edff",
    chatBg: "#f5f5f2",
    headerBg: "rgba(255,255,255,0.85)",
    border: "rgba(0,0,0,0.08)",
    gradientFrom: "#2b4fff",
    gradientTo: "#6366f1",
    ownerMsg: "#101214",
    ownerMsgText: "#ffffff",
    otherMsg: "#ffffff",
    otherMsgText: "#101214",
    otherMsgBorder: "rgba(0,0,0,0.08)",
    chatTitle: "#101214",
    chatSubtitle: "rgba(16,18,20,0.45)",
  },
  {
    id: "ocean",
    name: "Океан",
    description: "Глубокий аквамарин и тёплый коралл — бриз океана",
    accent: "#0284c7",
    accentSoft: "#e0f2fe",
    chatBg: "#eef8ff",
    headerBg: "rgba(238,248,255,0.9)",
    border: "rgba(2,132,199,0.12)",
    gradientFrom: "#22d3ee",
    gradientTo: "#0369a1",
    ownerMsg: "#075985",
    ownerMsgText: "#e0f7ff",
    otherMsg: "#ffffff",
    otherMsgText: "#08374d",
    otherMsgBorder: "rgba(2,132,199,0.18)",
    chatTitle: "#06364a",
    chatSubtitle: "rgba(6,54,74,0.5)",
  },
  {
    id: "sunset",
    name: "Закат",
    description: "Тёплый оранжево-розовый — энергия и тепло",
    accent: "#f97316",
    accentSoft: "#fff7ed",
    chatBg: "#fffbeb",
    headerBg: "rgba(255,255,255,0.88)",
    border: "rgba(249,115,22,0.1)",
    gradientFrom: "#f97316",
    gradientTo: "#ec4899",
    ownerMsg: "#431407",
    ownerMsgText: "#fff7ed",
    otherMsg: "#ffffff",
    otherMsgText: "#431407",
    otherMsgBorder: "rgba(249,115,22,0.12)",
    chatTitle: "#431407",
    chatSubtitle: "rgba(67,20,7,0.45)",
  },
  {
    id: "emerald",
    name: "Изумруд",
    description: "Свежая мята и глубокий изумруд — прохлада утра",
    accent: "#0f9d76",
    accentSoft: "#e6fff6",
    chatBg: "#effcf6",
    headerBg: "rgba(239,252,246,0.92)",
    border: "rgba(15,157,118,0.14)",
    gradientFrom: "#34d399",
    gradientTo: "#0e7490",
    ownerMsg: "#064e3b",
    ownerMsgText: "#d1fae5",
    otherMsg: "#ffffff",
    otherMsgText: "#064e3b",
    otherMsgBorder: "rgba(15,157,118,0.16)",
    chatTitle: "#064e3b",
    chatSubtitle: "rgba(6,78,59,0.45)",
  },
  {
    id: "rose",
    name: "Роза",
    description: "Пудровые оттенки и ягодный акцент — нежность и характер",
    accent: "#e0578a",
    accentSoft: "#fff0f5",
    chatBg: "#fff5f8",
    headerBg: "rgba(255,245,248,0.92)",
    border: "rgba(224,87,138,0.14)",
    gradientFrom: "#f472b6",
    gradientTo: "#a855f7",
    ownerMsg: "#7a1f43",
    ownerMsgText: "#ffe4ee",
    otherMsg: "#ffffff",
    otherMsgText: "#5a1530",
    otherMsgBorder: "rgba(224,87,138,0.16)",
    chatTitle: "#5a1530",
    chatSubtitle: "rgba(90,21,48,0.45)",
  },
] as const;

/** WinPro-темы — доступны только с активной подпиской */
export const WINPRO_THEMES = [
  {
    id: "midnight-gold",
    name: "Золотой люкс",
    description: "Кремовый фон и золотые акценты — премиум-стиль",
    accent: "#b8860b",
    accentSoft: "#fdf6e3",
    chatBg: "#fdfaf0",
    headerBg: "rgba(253,250,240,0.92)",
    border: "rgba(184,134,11,0.18)",
    gradientFrom: "#d4af37",
    gradientTo: "#b8860b",
    ownerMsg: "#2b2416",
    ownerMsgText: "#fdf6e3",
    otherMsg: "#ffffff",
    otherMsgText: "#2b2416",
    otherMsgBorder: "rgba(184,134,11,0.22)",
    chatTitle: "#2b2416",
    chatSubtitle: "rgba(43,36,22,0.45)",
  },
  {
    id: "neon-aurora",
    name: "Неоновая аура",
    description: "Свежий мятный фон с неоново-изумрудным акцентом",
    accent: "#00a86b",
    accentSoft: "#e6fff5",
    chatBg: "#f2fffa",
    headerBg: "rgba(242,255,250,0.92)",
    border: "rgba(0,168,107,0.16)",
    gradientFrom: "#00d68f",
    gradientTo: "#0093ff",
    ownerMsg: "#06301f",
    ownerMsgText: "#d6ffe9",
    otherMsg: "#ffffff",
    otherMsgText: "#06301f",
    otherMsgBorder: "rgba(0,168,107,0.18)",
    chatTitle: "#06301f",
    chatSubtitle: "rgba(6,48,31,0.45)",
  },
  {
    id: "royal-purple",
    name: "Королевский фиолет",
    description: "Лавандовый фон и глубокий фиолетовый акцент",
    accent: "#7c3aed",
    accentSoft: "#f5f0ff",
    chatBg: "#faf6ff",
    headerBg: "rgba(250,246,255,0.92)",
    border: "rgba(124,58,237,0.16)",
    gradientFrom: "#8b5cf6",
    gradientTo: "#ec4899",
    ownerMsg: "#2a1a4a",
    ownerMsgText: "#f0e6ff",
    otherMsg: "#ffffff",
    otherMsgText: "#2a1a4a",
    otherMsgBorder: "rgba(124,58,237,0.18)",
    chatTitle: "#2a1a4a",
    chatSubtitle: "rgba(42,26,74,0.45)",
  },
  {
    id: YOU_THEME_ID,
    name: "Material You",
    description: "Выразительная палитра WinChat You: насыщенные тона, блобы и крупные формы",
    accent: "#7c4dff",
    accentSoft: "#e4d7ff",
    chatBg: "#efe5ff",
    headerBg: "rgba(239,229,255,0.82)",
    border: "rgba(124,77,255,0.14)",
    gradientFrom: "#7c4dff",
    gradientTo: "#ff7a6b",
    ownerMsg: "#7c4dff",
    ownerMsgText: "#ffffff",
    otherMsg: "#f7f0ff",
    otherMsgText: "#1d1233",
    otherMsgBorder: "rgba(136,115,163,0.18)",
  },
  {
    id: GLASS_THEME_ID,
    name: "WinChat Glass",
    description: "Прозрачное «жидкое стекло»: размытие, глянцевые блики и очень крупные скругления",
    accent: "#3f6df6",
    accentSoft: "rgba(255,255,255,0.65)",
    chatBg: "#e7edf6",
    headerBg: "rgba(255,255,255,0.55)",
    border: "rgba(255,255,255,0.75)",
    gradientFrom: "#7aa2ff",
    gradientTo: "#c4d6ff",
    ownerMsg: "#3f6df6",
    ownerMsgText: "#ffffff",
    otherMsg: "rgba(255,255,255,0.62)",
    otherMsgText: "#1a2434",
    otherMsgBorder: "rgba(255,255,255,0.85)",
    chatTitle: "#1a2434",
    chatSubtitle: "rgba(26,36,52,0.55)",
  },
] as const;

export type Theme = (typeof THEMES)[number];
export type WinProTheme = (typeof WINPRO_THEMES)[number];

/** Все доступные темы (базовые) */
export const ALL_THEMES = THEMES;

/** Получить все темы включая WinPro (фильтрация на уровне вызывающего) */
export function getAllThemes(includeWinPro: boolean): Array<Theme | WinProTheme> {
  return includeWinPro ? [...THEMES, ...WINPRO_THEMES] : [...THEMES];
}

/** Получить тему по id, иначе дефолт (Классика) */
export function getThemeById(id: string): Theme | WinProTheme | undefined {
  const found = [...THEMES, ...WINPRO_THEMES].find((t) => t.id === id);
  return found ?? THEMES[0];
}

/** Проверить, что тема WinPro */
export function isWinProTheme(id: string): boolean {
  return WINPRO_THEMES.some((t) => t.id === id);
}

/** Проверить, что включён режим WinChat You (Material You) */
export function isYouTheme(id: string): boolean {
  return id === YOU_THEME_ID;
}

/** Проверить, что включён режим WinChat Glass (Liquid Glass) */
export function isGlassTheme(id: string): boolean {
  return id === GLASS_THEME_ID;
}

export interface ChatThemeColors {
  accent: string;
  accentSoft: string;
  chatBg: string;
  headerBg: string;
  border: string;
  title: string;
  subtitle: string;
  activeBg: string;
}

/** Цвета строк сайдбара под текущую тему (в You-режиме — из CSS-переменных). */
export function getChatThemeColors(): ChatThemeColors {
  const t = getCurrentTheme();
  try {
    if (isYouTheme(t.id)) {
      const style = getComputedStyle(document.documentElement);
      const v = (name: string) => style.getPropertyValue(name).trim();
      return {
        accent: v("--you-primary"),
        accentSoft: v("--you-primary-container"),
        chatBg: v("--you-surface"),
        headerBg: v("--you-surface-low"),
        border: v("--you-outline-variant"),
        title: v("--you-on-surface"),
        subtitle: v("--you-on-surface-variant"),
        activeBg: v("--you-secondary-container"),
      };
    }
  } catch {
    /* no-op */
  }
  const c = t as {
    accent: string;
    accentSoft?: string;
    chatBg?: string;
    headerBg?: string;
    border?: string;
    chatTitle?: string;
    chatSubtitle?: string;
  };
  return {
    accent: c.accent,
    accentSoft: c.accentSoft || c.accent,
    chatBg: c.chatBg || "#f5f5f2",
    headerBg: c.headerBg || "#ffffff",
    border: c.border || "rgba(0,0,0,0.08)",
    title: c.chatTitle || "#101214",
    subtitle: c.chatSubtitle || "rgba(16,18,20,0.45)",
    activeBg: c.accentSoft || c.accent,
  };
}

/** Получить текущую тему из localStorage (id сохраняется при выборе) */
export function getCurrentTheme(): Theme {
  let id = "";
  try { id = localStorage.getItem("winchat_theme_id") || ""; } catch {}
  return getThemeById(id) as Theme;
}

/** Сохранить id выбранной темы */
export function saveThemeId(id: string): void {
  try { localStorage.setItem("winchat_theme_id", id); } catch {}
}

/** CSS-переменные Material You, которые applyYouPalette задаёт inline.
 *  Сбрасываются, когда активна не-You тема (например, Glass): иначе инлайн-значения
 *  перекрывают стили темы и Liquid Glass начинает выглядеть как Material You. */
const YOU_INLINE_VARS = [
  "--you-primary",
  "--you-on-primary",
  "--you-primary-strong",
  "--you-primary-container",
  "--you-on-primary-container",
  "--you-secondary",
  "--you-on-secondary",
  "--you-secondary-container",
  "--you-on-secondary-container",
  "--you-tertiary",
  "--you-on-tertiary",
  "--you-tertiary-container",
  "--you-on-tertiary-container",
  "--you-surface",
  "--you-surface-low",
  "--you-surface-container",
  "--you-surface-high",
  "--you-surface-highest",
  "--you-on-surface",
  "--you-on-surface-variant",
  "--you-outline",
  "--you-outline-variant",
  "--you-r",
  "--you-r-sm",
  "--you-r-lg",
  "--you-shape-clip",
] as const;

/** Применить тему к CSS-переменным документа. */
export function applyTheme(theme: Theme | WinProTheme): void {
  const r = document.documentElement.style;
  r.setProperty("--color-accent", theme.accent);
  r.setProperty("--color-accent-soft", theme.accentSoft);
  r.setProperty("--winchat-theme-id", theme.id);

  if ("chatBg" in theme) {
    document.documentElement.classList.remove("theme-dark");
    r.setProperty("--color-paper", theme.chatBg);
  }

  // WinChat Glass: прозрачные стеклянные панели (CSS-слой .theme-glass).
  document.documentElement.classList.toggle("theme-glass", isGlassTheme(theme.id));

  // WinChat You: отдельная тональная схема Material You + «обои» пользователя.
  if (isYouTheme(theme.id)) {
    document.documentElement.classList.add("theme-you");
    applyYouPalette(getYouSeedId());
  } else {
    document.documentElement.classList.remove("theme-you");
    delete document.documentElement.dataset.youSeed;
    delete document.documentElement.dataset.youScheme;
    document.documentElement.style.colorScheme = "";
    /* Выключаем inline-переменные You, если сейчас активна другая тема
       (например, Glass): иначе они перекрывают стили темы и Liquid Glass
       начинает выглядеть как Material You. */
    YOU_INLINE_VARS.forEach((name) => {
      document.documentElement.style.removeProperty(name);
    });
    r.removeProperty("--color-ink");
    r.removeProperty("--color-ink-soft");
  }

  window.dispatchEvent(new Event("winchat-theme-change"));
}
