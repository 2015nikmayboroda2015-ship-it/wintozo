/**
 * OTA-обновления WinChat для Android.
 *
 * Логика:
 *  - при запуске определяем устройство и отправляем статус на сервер:
 *      is_wintozo_web_true — открыто как веб-страница;
 *      is_wintozo_web_no   — нативное Android-приложение;
 *  - для нативного приложения запрашиваем версию (check_version) и
 *    winchat_search_ota;
 *  - если админ выложил APK через /set ota "ссылка", показываем кнопку
 *    «Установить» и отдаём ссылку нативному плагину WinChatOta, который
 *    скачивает APK и открывает системный установщик.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { supabase } from "./supabase";
import { APP_VERSION, fetchLatestVersion } from "./checkVersion";

/* ============================================================
   Нативный плагин (android/app/.../WinChatOtaPlugin.java)
   ============================================================ */

interface NativeDeviceInfo {
  deviceId?: string;
  model?: string;
  manufacturer?: string;
  osVersion?: string;
  appVersion?: string;
  packageName?: string;
}

interface WinChatOtaPlugin {
  getInfo(): Promise<NativeDeviceInfo>;
  install(options: { url: string }): Promise<{ started?: boolean }>;
  addListener(
    eventName: "otaStatus",
    listener: (event: OtaStatusEvent) => void
  ): Promise<PluginListenerHandle>;
}

const WinChatOta = registerPlugin<WinChatOtaPlugin>("WinChatOta");

export type OtaState = "downloading" | "permission" | "installing" | "error";

export interface OtaStatusEvent {
  state: OtaState;
  message?: string;
}

/* ============================================================
   Определение устройства
   ============================================================ */

const DEVICE_ID_KEY = "winchat_device_id";

export interface DeviceInfo {
  deviceId: string;
  /** true = веб-страница, false = нативное Android-приложение. */
  isWintozoWeb: boolean;
  isAndroid: boolean;
  platform: string;
  model: string;
  manufacturer: string;
  osVersion: string;
  appVersion: string;
}

let deviceInfoPromise: Promise<DeviceInfo> | null = null;

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* no-op */
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStoredDeviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_ID_KEY);
    if (saved) return saved;
    const id = randomId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function canInstallOta(): boolean {
  return isNativeAndroid() && Capacitor.isPluginAvailable("WinChatOta");
}

async function loadDeviceInfo(): Promise<DeviceInfo> {
  const nativeAndroid = isNativeAndroid();
  const platform = Capacitor.getPlatform();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = platform === "android" || /Android/i.test(ua);

  let native: NativeDeviceInfo = {};
  if (nativeAndroid) {
    try {
      native = await WinChatOta.getInfo();
    } catch {
      /* плагин ещё не в этой сборке — работаем по данным браузера */
    }
  }

  return {
    deviceId: native.deviceId?.trim() || getStoredDeviceId(),
    isWintozoWeb: !nativeAndroid,
    isAndroid,
    platform,
    model: native.model || (isAndroid ? "Android" : ""),
    manufacturer: native.manufacturer || "",
    osVersion: native.osVersion || ua,
    appVersion: native.appVersion || APP_VERSION,
  };
}

/** Информация об устройстве (кэшируется на время сессии). */
export function getDeviceInfo(): Promise<DeviceInfo> {
  if (!deviceInfoPromise) {
    deviceInfoPromise = loadDeviceInfo().catch(() => ({
      deviceId: getStoredDeviceId(),
      isWintozoWeb: true,
      isAndroid: false,
      platform: "web",
      model: "",
      manufacturer: "",
      osVersion: "",
      appVersion: APP_VERSION,
    }));
  }
  return deviceInfoPromise;
}

/* ============================================================
   Статус устройства → сервер
   ============================================================ */

let lastReportAt = 0;

/**
 * Отправить статус is_wintozo_web_true / is_wintozo_web_no.
 * Повторные вызовы в течение минуты не дублируются (кроме force).
 */
export async function reportDeviceStatus(force = false): Promise<DeviceInfo> {
  const info = await getDeviceInfo();
  if (!info.isAndroid) return info;
  if (!force && Date.now() - lastReportAt < 60_000) return info;
  lastReportAt = Date.now();

  try {
    await supabase.rpc("winchat_report_device", {
      _device_id: info.deviceId,
      _is_wintozo_web: info.isWintozoWeb,
      _platform: info.platform,
      _app_version: info.appVersion,
      _model: info.model,
      _manufacturer: info.manufacturer,
      _os_version: info.osVersion,
    });
  } catch {
    /* SQL-миграция ещё не применена — OTA просто не активируется */
  }
  return info;
}

/* ============================================================
   Поиск и установка OTA
   ============================================================ */

export interface OtaInfo {
  url: string;
  version: string | null;
  target: string;
}

export interface OtaInitResult {
  device: DeviceInfo;
  ota: OtaInfo | null;
  latestVersion: string | null;
}

export async function searchOta(deviceId: string): Promise<OtaInfo | null> {
  try {
    const { data, error } = await supabase.rpc("winchat_search_ota", {
      _device_id: deviceId,
    });
    if (error || !data) return null;
    const res = data as {
      ok?: boolean;
      available?: boolean;
      url?: string | null;
      version?: string | null;
      target?: string | null;
    };
    if (!res.ok || !res.available || !res.url) return null;
    return {
      url: res.url,
      version: res.version ?? null,
      target: res.target ?? "*",
    };
  } catch {
    return null;
  }
}

let otaInitPromise: Promise<OtaInitResult> | null = null;

async function runOtaInit(): Promise<OtaInitResult> {
  // force=true: к моменту CheckVersion пользователь уже вошёл,
  // поэтому успеваем привязать device_id к аккаунту до поиска OTA.
  const device = await reportDeviceStatus(true);

  if (device.isWintozoWeb) {
    const latestVersion = await fetchLatestVersion();
    return { device, ota: null, latestVersion };
  }

  const [latestVersion, ota] = await Promise.all([
    fetchLatestVersion(),
    searchOta(device.deviceId),
  ]);
  return { device, ota, latestVersion };
}

/**
 * Инициализация OTA при запуске. Результат кэшируется, поэтому
 * App и CheckVersion могут звать её безопасно.
 */
export function initDeviceOta(): Promise<OtaInitResult> {
  if (!otaInitPromise) {
    otaInitPromise = runOtaInit().catch(() => ({
      device: {
        deviceId: getStoredDeviceId(),
        isWintozoWeb: true,
        isAndroid: false,
        platform: "web",
        model: "",
        manufacturer: "",
        osVersion: "",
        appVersion: APP_VERSION,
      },
      ota: null,
      latestVersion: null,
    }));
  }
  return otaInitPromise;
}

/** Скачать APK и открыть системный установщик. */
export async function installOta(
  url: string
): Promise<{ started: boolean; fallback: boolean }> {
  if (!canInstallOta()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return { started: false, fallback: true };
  }

  try {
    await WinChatOta.install({ url });
    return { started: true, fallback: false };
  } catch {
    // Если нативный установщик недоступен, отдаём ссылку системе.
    window.open(url, "_blank", "noopener,noreferrer");
    return { started: false, fallback: true };
  }
}

/** Подписка на прогресс/ошибки нативного установщика. */
export async function onOtaStatus(
  listener: (event: OtaStatusEvent) => void
): Promise<() => void> {
  if (!canInstallOta()) return () => {};
  try {
    const handle = await WinChatOta.addListener("otaStatus", listener);
    return () => {
      void handle.remove();
    };
  } catch {
    return () => {};
  }
}

/* ============================================================
   Скрытие баннера конкретного OTA
   ============================================================ */

const OTA_DISMISS_KEY = "winchat_ota_dismissed";

export function isOtaDismissed(url: string): boolean {
  try {
    return localStorage.getItem(OTA_DISMISS_KEY) === url;
  } catch {
    return false;
  }
}

export function dismissOta(url: string): void {
  try {
    localStorage.setItem(OTA_DISMISS_KEY, url);
  } catch {
    /* no-op */
  }
}
