/**
 * Режим разработчика (скрытый).
 *
 * Включается четырьмя быстрыми нажатиями на версию приложения в разделе
 * «О приложении». Даёт однотонный (монохромный) интерфейс и скачивание логов.
 * Флаги хранятся в localStorage и применяются к <html>.
 */
import { devLog } from "./devLogs";

const DEV_KEY = "winchat_dev_mode";
const MONO_KEY = "winchat_dev_mono";
const MONO_CLASS = "dev-mono";
/** Событие для реактивного обновления интерфейса. */
export const DEV_MODE_EVENT = "winchat-dev-mode-change";

const TAP_WINDOW_MS = 1600;
const TAPS_REQUIRED = 4;
let tapCount = 0;
let lastTapAt = 0;

const listeners = new Set<() => void>();

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* no-op */
    }
  });
  try {
    window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT));
  } catch {
    /* no-op */
  }
}

/** Включён ли режим разработчика. */
export function isDevMode(): boolean {
  return readFlag(DEV_KEY);
}

/** Включён ли однотонный интерфейс (работает только в режиме разработчика). */
export function isMonoEnabled(): boolean {
  return readFlag(MONO_KEY);
}

/** Применить/снять монохромный фильтр на <html>. */
export function applyMono() {
  const on = isDevMode() && isMonoEnabled();
  try {
    document.documentElement.classList.toggle(MONO_CLASS, on);
  } catch {
    /* no-op */
  }
}

/** Включить/выключить режим разработчика. */
export function setDevMode(on: boolean) {
  writeFlag(DEV_KEY, on);
  applyMono();
  devLog(on ? "developer mode enabled" : "developer mode disabled");
  notify();
}

/** Включить/выключить однотонный интерфейс. */
export function setMonoEnabled(on: boolean) {
  writeFlag(MONO_KEY, on);
  applyMono();
  devLog(`monochrome interface ${on ? "enabled" : "disabled"}`);
  notify();
}

/**
 * Учесть нажатие на версию приложения.
 * Возвращает true, когда пользователь нажал 4 раза подряд.
 */
export function registerVersionTap(): boolean {
  const now = Date.now();
  if (now - lastTapAt > TAP_WINDOW_MS) tapCount = 0;
  lastTapAt = now;
  tapCount += 1;

  if (tapCount >= TAPS_REQUIRED) {
    tapCount = 0;
    return true;
  }
  if (tapCount > 1) devLog(`version tapped (${tapCount}/${TAPS_REQUIRED})`);
  return false;
}

/** Подписка на изменение флагов режима разработчика. */
export function subscribeDevMode(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
