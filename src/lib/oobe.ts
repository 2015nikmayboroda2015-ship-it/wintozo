/* ============================================================
   OOBE — приветственные экраны WinChat (первое скачивание и
   запуск после обновления на 5.0.0).

   На телефонах показываются автоматически:
   • после первого запуска обновлённого приложения → OobeUpdate
   • при первом скачивании (нет аккаунта) → OobeInstall
   На ПК работают по прямому адресу: /oobe_update и /install_oobe.
   ============================================================ */
import { Capacitor } from "@capacitor/core";

/** Запускалась ли OOBE «Обновление на 5.0.0» (ключ в localStorage). */
export const OOBE_UPDATE_KEY = "winchat_oobe_update_done";

/** Запускалась ли OOBE «Первое скачивание» (ключ в localStorage). */
export const OOBE_INSTALL_KEY = "winchat_oobe_install_done";

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

/** Отметить OOBE обновления как завершённую. */
export function markOobeUpdateDone(): void {
  try {
    localStorage.setItem(OOBE_UPDATE_KEY, "1");
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
    localStorage.setItem(OOBE_UPDATE_KEY, "1");
  } catch {
    /* no-op */
  }
}
