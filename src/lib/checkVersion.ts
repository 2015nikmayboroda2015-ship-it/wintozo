/**
 * Проверка версии приложения: клиент шлёт запрос на Supabase (RPC
 * get_wintozo_version), сравнивает с локальной APP_VERSION и показывает
 * баннер обновления, если версия на сервере новее.
 */
import { supabase } from "./supabase";

/** Текущая версия клиента. Синхронизирована с GitHub Release v3.0.0. */
export const APP_VERSION = "3.0.0";

/** Ссылка на APK в релизах GitHub. */
export const DOWNLOAD_URL = "https://github.com/NikitaDev2015/wintozo/releases/latest";

/** Разобрать "3.0.1" → [3,0,1]. Неполные части → 0. */
function parseVersion(v: string): number[] {
  return v.trim().split(".").map((x) => parseInt(x, 10) || 0);
}

/** true, если remote строго новее local (сравнение по частям). */
export function isVersionNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

/** Запросить актуальную версию с сервера. null при ошибке сети. */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_wintozo_version");
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

/* ---------- Баннер «Обновление завершено» после входа ---------- */

const CHangelog_KEY = "winchat_changelog_seen";

export interface ChangelogEntry {
  version: string;
  title: string;
  items: string[];
}

/** Что нового в текущих версиях (пополняется с каждым релизом). */
export const CHANGELOGS: Record<string, ChangelogEntry> = {
  "3.0.0": {
    version: "3.0.0",
    title: "В версии 3.0.0 были добавлены функции",
    items: [
      "WinPro — обновленная и улучшенная версия Wintozo Pro",
      "Кастомные темы",
      "Верификации",
      "Группы",
    ],
  },
};

/** Вернуть changelog для версии, или ближайший известный. */
export function getChangelog(version: string): ChangelogEntry | null {
  if (CHANGELOGS[version]) return CHANGELOGS[version];
  // Берём самую свежую запись
  const keys = Object.keys(CHANGELOGS).sort((a, b) => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] ?? 0) - (pa[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  return keys.length ? CHANGELOGS[keys[0]] : null;
}

/** Показывали ли уже баннер обновления для этой версии? */
export function shouldShowUpdateBanner(latest: string): boolean {
  if (!isVersionNewer(latest, APP_VERSION)) return false;
  try {
    return localStorage.getItem(`winchat_update_dismissed`) !== latest;
  } catch {
    return true;
  }
}

export function dismissUpdateBanner(latest: string): void {
  try {
    localStorage.setItem("winchat_update_dismissed", latest);
  } catch {
    /* no-op */
  }
}

/** Показывать ли баннер «Обновление завершено» при входе в аккаунт
 *  (не при регистрации). Один раз на каждую установленную версию. */
export function shouldShowWhatsNew(): boolean {
  try {
    return localStorage.getItem(CHangelog_KEY) !== APP_VERSION;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen(): void {
  try {
    localStorage.setItem(CHangelog_KEY, APP_VERSION);
  } catch {
    /* no-op */
  }
}
