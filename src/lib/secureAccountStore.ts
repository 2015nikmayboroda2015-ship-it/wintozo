/**
 * Зашифрованное хранилище данных аккаунта на устройстве.
 *
 * Android: файл `/winchat/account_settings/account_settings.enc`
 * (в приватном каталоге приложения) шифруется AES-GCM ключом из Android Keystore.
 * В нём сохраняются тема, анимация, палитра Material You, профиль и сессия Supabase.
 *
 * При каждом запуске приложение:
 *  1) просит нативный плагин создать папки (если их ещё нет);
 *  2) читает и расшифровывает account_settings.enc;
 *  3) восстанавливает настройки в localStorage ДО инициализации Supabase Auth.
 */
import { supabase, type Profile } from "./supabase";
import {
  ensureWinChatFolders,
  isNativeStorageAvailable,
  loadSettingsNative,
  saveSettingsNative,
  type StoredFolderInfo,
} from "./nativeStorage";

const STORE_VERSION = 1;
const ACCOUNT_META_KEY = "winchat_secure_account";
const AUTH_TOKEN_RE = /^sb-.+-auth-token$/;

/** Какие настройки входят в зашифрованный снимок. */
const SETTINGS_KEYS = [
  "winchat_theme_id",
  "winchat_winpro_animation",
  "winchat_you_seed",
  "winchat_you_shape",
  "winchat_you_prev_theme",
  "winchat_glass_prev_theme",
  "winchat_device_id",
  "winchat_impersonate",
  "winchat_media_counter",
];

export interface SecureAccountMeta {
  id: string;
  username: string;
  nickname: string;
  avatar_url?: string | null;
  verify_status?: string | null;
  is_winpro?: boolean | null;
}

interface SecureSnapshot {
  version: number;
  savedAt: string;
  account: SecureAccountMeta | null;
  values: Record<string, string>;
}

let initialized = false;
let initPromise: Promise<void> | null = null;
let folders: StoredFolderInfo | null = null;
let saveTimer: number | undefined;
let saving = false;
let pendingSave = false;
let storedAccount: SecureAccountMeta | null = null;

function authTokenKey(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && AUTH_TOKEN_RE.test(key)) return key;
    }
  } catch {
    /* no-op */
  }
  return null;
}

function readSnapshot(includeAuth: boolean): SecureSnapshot {
  const values: Record<string, string> = {};
  try {
    for (const key of SETTINGS_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
    if (includeAuth) {
      const key = authTokenKey();
      if (key) {
        const value = localStorage.getItem(key);
        if (value) values[key] = value;
      }
    }
  } catch {
    /* no-op */
  }
  return {
    version: STORE_VERSION,
    savedAt: new Date().toISOString(),
    account: storedAccount,
    values,
  };
}

/** Записывает зашифрованный снимок в /winchat/account_settings/. */
export async function persistSecureSettings(includeAuth = true): Promise<void> {
  if (!isNativeStorageAvailable()) return;
  if (saving) {
    pendingSave = true;
    return;
  }
  saving = true;
  try {
    const snapshot = readSnapshot(includeAuth);
    await saveSettingsNative(JSON.stringify(snapshot));
  } finally {
    saving = false;
    if (pendingSave) {
      pendingSave = false;
      void persistSecureSettings(includeAuth);
    }
  }
}

/** Отложенная запись — чтобы не дёргать диск на каждый клик. */
export function scheduleSecureSave(delay = 500): void {
  if (!isNativeStorageAvailable()) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void persistSecureSettings(true);
  }, delay);
}

/** Сохраняет метаданные профиля перед записью снимка. */
export function rememberAccount(profile: Profile | null): void {
  if (!profile) return;
  storedAccount = {
    id: profile.id,
    username: profile.username,
    nickname: profile.nickname,
    avatar_url: profile.avatar_url ?? null,
    verify_status: profile.verify_status ?? null,
    is_winpro: "winpro_until" in profile ? Boolean((profile as { winpro_until?: string | null }).winpro_until) : null,
  };
  try {
    localStorage.setItem(ACCOUNT_META_KEY, JSON.stringify(storedAccount));
  } catch {
    /* no-op */
  }
  scheduleSecureSave();
}

/** Профиль из зашифрованного снимка (если localStorage ещё пуст). */
export function getRememberedAccount(): SecureAccountMeta | null {
  if (storedAccount) return storedAccount;
  try {
    const raw = localStorage.getItem(ACCOUNT_META_KEY);
    if (!raw) return null;
    storedAccount = JSON.parse(raw) as SecureAccountMeta;
    return storedAccount;
  } catch {
    return null;
  }
}

/** Убирает сессию из зашифрованного файла (выход из аккаунта), настройки остаются. */
export async function forgetSecureSession(): Promise<void> {
  if (!isNativeStorageAvailable()) return;
  const snapshot = readSnapshot(false);
  try {
    await saveSettingsNative(JSON.stringify(snapshot));
  } catch {
    /* no-op */
  }
}

/**
 * Инициализация при запуске приложения. Возвращает путь к папке настроек
 * (для диагностики/настроек), если платформа нативная.
 */
export function initSecureAccountStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (initialized) return;
    initialized = true;

    folders = await ensureWinChatFolders();

    try {
      const raw = await loadSettingsNative();
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SecureSnapshot>;
        if (parsed && parsed.values && typeof parsed.values === "object") {
          for (const [key, value] of Object.entries(parsed.values)) {
            if (typeof value !== "string") continue;
            if (!SETTINGS_KEYS.includes(key) && !AUTH_TOKEN_RE.test(key)) continue;
            localStorage.setItem(key, value);
          }
        }
        if (parsed.account && typeof parsed.account === "object") {
          storedAccount = parsed.account as SecureAccountMeta;
          localStorage.setItem(ACCOUNT_META_KEY, JSON.stringify(storedAccount));
        }
      }
    } catch {
      // Повреждённый файл не должен мешать запуску.
    }

    window.addEventListener("winchat-theme-change", () => scheduleSecureSave());
    window.addEventListener("winchat-animation-change", () => scheduleSecureSave());
    window.addEventListener("winchat-you-seed-change", () => scheduleSecureSave());
    window.addEventListener("winchat-you-shape-change", () => scheduleSecureSave());
    window.addEventListener("storage", () => scheduleSecureSave(800));
    window.addEventListener("pagehide", () => {
      void persistSecureSettings(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void persistSecureSettings(true);
    });

    // При выходе сессия должна исчезнуть и из зашифрованного файла,
    // иначе при следующем запуске восстановится недействительный токен.
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        void forgetSecureSession();
      } else {
        scheduleSecureSave(300);
      }
    });

    scheduleSecureSave(200);
  })();

  return initPromise;
}

/** Путь к папке зашифрованных настроек (для отладки/экрана настроек). */
export function getSecureSettingsPath(): string | null {
  return folders?.settings ?? null;
}
