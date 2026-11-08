/**
 * Проверка версии приложения: клиент шлёт запрос на Supabase (RPC
 * get_wintozo_version), сравнивает с локальной APP_VERSION и показывает
 * баннер обновления, если версия на сервере новее.
 */
import { supabase } from "./supabase";

/** Текущая версия клиента. Синхронизирована с GitHub Release v3.0.0. */
export const APP_VERSION = "3.1.2";

/** Ссылка на APK в релизах GitHub. */
export const DOWNLOAD_URL = "https://github.com/NikitaDev2015/wintozo/releases/latest";

/* ============================================================
   Ивент «Память о Wintozo»
   Если серверная версия попадает в диапазон 1.0.0–2.0.1, у
   клиента включается legacy-режим: полноэкранная плашка с
   выбором — остаться в WinChat или вернуться в старый Wintozo.
   ============================================================ */

const LEGACY_KEY = "winchat_legacy_ui";
/** Нижняя граница диапазона «старой» версии (включительно). */
const LEGACY_MIN = "1.0.0";
/** Верхняя граница диапазона «старой» версии (включительно). */
const LEGACY_MAX = "2.0.1";

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

/** Сравнение версий: -1 | 0 | 1. */
function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Попадает ли серверная версия в диапазон «Памяти о Wintozo». */
export function isLegacyRange(version: string | null): boolean {
  if (!version) return false;
  return (
    compareVersions(version, LEGACY_MIN) >= 0 &&
    compareVersions(version, LEGACY_MAX) <= 0
  );
}

/** Включён ли legacy-режим пользователем (или автоматически по версии). */
export function isLegacyUi(): boolean {
  try {
    return localStorage.getItem(LEGACY_KEY) === "on";
  } catch {
    return false;
  }
}

export function setLegacyUi(on: boolean): void {
  try {
    if (on) localStorage.setItem(LEGACY_KEY, "on");
    else localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* no-op */
  }
}

/** Явный выбор пользователя: включён/отключён legacy UI. */
export function chooseLegacyUi(on: boolean): void {
  try {
    localStorage.setItem(LEGACY_KEY, on ? "on" : "user_declined");
  } catch {
    /* no-op */
  }
}

/** Разрешить снова показать плашку «Память о Wintozo» (из Настроек). */
export function resetLegacyChoice(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* no-op */
  }
}

/** Кэш последней известной серверной версии (для мгновенных проверок). */
const VER_CACHE = "winchat_server_version";

export function getCachedServerVersion(): string | null {
  try {
    return localStorage.getItem(VER_CACHE);
  } catch {
    return null;
  }
}

export function setCachedServerVersion(v: string): void {
  try {
    localStorage.setItem(VER_CACHE, v);
  } catch {
    /* no-op */
  }
}

/** Запросить актуальную версию с сервера. null при ошибке сети. */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    // Новый RPC check_version (см. winchat_update_10_ota.sql).
    // Если миграция ещё не применена — откатываемся на прежнюю функцию.
    let { data, error } = await supabase.rpc("check_version");
    if (error) {
      const fallback = await supabase.rpc("get_wintozo_version");
      data = fallback.data;
      error = fallback.error;
    }
    if (error || !data) return null;
    const v = String(data);
    setCachedServerVersion(v);
    return v;
  } catch {
    return null;
  }
}

/**
 * Активировать/деактивировать legacy-режим по серверной версии.
 * Вызывается при загрузке приложения и после входа/регистрации.
 * Возвращает true, если режим был изменён на «legacy».
 */
export async function applyLegacyGate(serverVersion?: string | null): Promise<boolean> {
  const v = serverVersion ?? (await fetchLatestVersion()) ?? getCachedServerVersion();
  const legacy = isLegacyRange(v);
  // Автоматически включаем, только если пользователь ещё не выбирал сам
  // («off» means пользователь явно вернулся в новый интерфейс).
  if (legacy && !isLegacyUi()) {
    try {
      if (localStorage.getItem(LEGACY_KEY) !== "user_declined") {
        setLegacyUi(true);
        return true;
      }
    } catch {
      /* no-op */
    }
  }
  return false;
}

/** Пользователь отказался от legacy UI — запоминаем выбор. */
export function declineLegacyUi(): void {
  chooseLegacyUi(false);
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
