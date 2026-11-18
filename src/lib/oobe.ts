/* ============================================================
   OOBE — приветственные экраны WinChat (первое скачивание и
   запуск после обновления на новую версию).

   На телефонах показываются автоматически:
   • после первого запуска обновлённого приложения → OobeUpdate
     (один раз на каждую версию приложения)
   • при первом скачивании (нет аккаунта) → OobeInstall
   На ПК работают по прямому адресу: /oobe_update и /install_oobe.
   ============================================================ */
import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "./checkVersion";

/** Ключ в localStorage: сколько OOBE-обновлений пользователь уже прошёл.
 *  0 — не обновлялся ни на одну новую версию (например, сидит на 4.x),
 *  1 — прошёл первое обновление (5.0), 2 — второе (6.0) и так до бесконечности. */
export const OOBE_UPDATE_KEY = "winchat_oobe_update_done";

/** Запускалась ли OOBE «Первое скачивание» (ключ в localStorage). */
export const OOBE_INSTALL_KEY = "winchat_oobe_install_done";

/** Ступени OOBE-обновлений в порядке выхода.
 *  Одна ступень = один показ приветствия. 6.0.0 уже показывали в closed
 *  beta, поэтому релиз 6.0.0 — отдельная ступень (следующий ключ). */
const OOBE_UPDATE_VERSIONS = ["5.0.0", "6.0.0", "6.0.0-release"];

/** Ожидаемый ключ для текущей версии приложения. */
export function getOobeUpdateExpectedKey(): number {
  // Релизная сборка 6.0.0 — это отдельный проход OOBE после closed beta.
  const releaseStage = OOBE_UPDATE_VERSIONS.indexOf(`${APP_VERSION}-release`);
  if (releaseStage >= 0) return releaseStage + 1;

  const i = OOBE_UPDATE_VERSIONS.indexOf(APP_VERSION);
  // Версии нет в списке (например, будущая) — считаем последней известной.
  return i >= 0 ? i + 1 : OOBE_UPDATE_VERSIONS.length;
}

/** Прочитать ключ: сколько OOBE-обновлений пользователь уже прошёл. */
export function readOobeUpdateKey(): number {
  try {
    const raw = localStorage.getItem(OOBE_UPDATE_KEY);
    // Совместимость со старым форматом (там хранилась строка версии).
    if (raw === APP_VERSION) return getOobeUpdateExpectedKey();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Телефон? Нативное приложение (Android/iOS) или мобильный браузер. */
export function isPhoneDevice(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    const ua = navigator.userAgent || "";
    return /Mobi\b|Android|iPhone/i.test(ua);
  } catch {
    return false;
  }
}

/** Отметить OOBE обновления как завершённую (ключ растёт: 0 → 1 → 2 → …). */
export function markOobeUpdateDone(): void {
  try {
    localStorage.setItem(OOBE_UPDATE_KEY, String(getOobeUpdateExpectedKey()));
    // Оформили первое скачивание раньше — обновление автоматически не показываем.
    localStorage.setItem(OOBE_INSTALL_KEY, "1");
  } catch {
    /* no-op */
  }
}

/** Отметить OOBE первого скачивания как завершённую. */
export function markOobeInstallDone(): void {
  try {
    localStorage.setItem(OOBE_INSTALL_KEY, "1");
    // Новичок видел установочное приветствие — экран обновления не дублируем.
    localStorage.setItem(OOBE_UPDATE_KEY, String(getOobeUpdateExpectedKey()));
  } catch {
    /* no-op */
  }
}
