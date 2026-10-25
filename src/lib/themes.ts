/**
 * WinChat Themes — палитры интерфейса.
 * Каждая тема задаёт: основной accent, soft-фон, фон чатов, шапку, градиент аватара.
 */

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
  },
  {
    id: "ocean",
    name: "Океан",
    description: "Глубокий тёмный, бирюзовый акцент — спокойствие моря",
    accent: "#06b6d4",
    accentSoft: "#ecfeff",
    chatBg: "#f0fdfa",
    headerBg: "rgba(255,255,255,0.9)",
    border: "rgba(0,0,0,0.06)",
    gradientFrom: "#06b6d4",
    gradientTo: "#0ea5e9",
    ownerMsg: "#0c4a6e",
    ownerMsgText: "#ecfeff",
    otherMsg: "#ffffff",
    otherMsgText: "#0c4a6e",
    otherMsgBorder: "rgba(6,182,212,0.15)",
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

  window.dispatchEvent(new Event("winchat-theme-change"));
}
