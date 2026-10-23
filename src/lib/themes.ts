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

export type Theme = (typeof THEMES)[number];

/** Все доступные темы */
export const ALL_THEMES = THEMES;

/** Получить тему по id, иначе дефолт (Классика) */
export function getThemeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Получить текущую тему из localStorage (id сохраняется при выборе) */
export function getCurrentTheme(): Theme {
  let id = "";
  try { id = localStorage.getItem("winchat_theme_id") || ""; } catch {}
  return getThemeById(id);
}

/** Сохранить id выбранной темы */
export function saveThemeId(id: string): void {
  try { localStorage.setItem("winchat_theme_id", id); } catch {}
}

/** Применить тему к CSS-переменным документа. */
export function applyTheme(theme: Theme): void {
  const r = document.documentElement.style;
  r.setProperty("--color-accent", theme.accent);
  r.setProperty("--color-accent-soft", theme.accentSoft);
  r.setProperty("--winchat-theme-id", theme.id);

  // Светлые темы — фон chatBg
  document.documentElement.classList.remove("theme-dark");
  r.setProperty("--color-paper", theme.chatBg);

  window.dispatchEvent(new Event("winchat-theme-change"));
}
