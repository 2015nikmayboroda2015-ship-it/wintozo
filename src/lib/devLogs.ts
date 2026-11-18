/**
 * Логи режима разработчика.
 *
 * Пишутся на английском, с префиксом времени HH:MM. Хранятся в памяти и
 * дублируются в localStorage, чтобы пережить перезагрузку страницы/приложения.
 * Скачивание: на Android — нативный плагин WinChatStorage (log.txt),
 * в браузере — обычное скачивание файла.
 */
import { saveLogsNative } from "./nativeStorage";
import { APP_VERSION } from "./checkVersion";

const STORAGE_KEY = "winchat_dev_logs";
const MAX_LINES = 600;

let lines: string[] = [];
let initialized = false;
let storageAvailable = true;
const listeners = new Set<() => void>();

function timeStamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function persist() {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, lines.join("\n"));
  } catch {
    storageAvailable = false;
  }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    lines = raw.split("\n").filter(Boolean).slice(-MAX_LINES);
  } catch {
    storageAvailable = false;
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
}

/** Добавить строку в лог. */
export function devLog(message: string, level: "info" | "warn" | "error" = "info") {
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  if (!text) return;
  const prefix = level === "error" ? "[error] " : level === "warn" ? "[warn] " : "";
  const line = `${timeStamp()} ${prefix}${text}`;
  lines.push(line);
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
  persist();
  notify();
}

/** Все строки лога (копия). */
export function getLogLines(): string[] {
  return [...lines];
}

/** Лог одним текстом — для скачивания. */
export function getLogText(): string {
  return lines.join("\n");
}

/** Очистить лог. */
export function clearLogs() {
  lines = [];
  persist();
  notify();
  devLog("logs cleared");
}

/** Подписка на изменения лога (для панели разработчика). */
export function subscribeLogs(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Инициализация при запуске приложения: подхватывает прошлые записи,
 * пишет стартовую строку и перехватывает ошибки/console.error.
 */
export function initDevLogs() {
  if (initialized) return;
  initialized = true;

  loadPersisted();

  let platform = "web";
  try {
    const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    if (cap) platform = cap.getPlatform?.() || "web";
  } catch {
    /* no-op */
  }

  devLog(`user started winchat (v${APP_VERSION}, ${platform})`);
  devLog("loading main.tsx");

  window.addEventListener("error", (event) => {
    devLog(`uncaught error: ${event.message}`, "error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    devLog(`unhandled rejection: ${describeError(event.reason)}`, "error");
  });

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    devLog(`console.error: ${args.map(describeError).join(" ")}`, "error");
    originalError(...args);
  };
}

export interface SaveLogsOutcome {
  ok: boolean;
  /** Куда сохранён файл (путь на Android или имя скачанного файла). */
  path: string;
  native: boolean;
  message: string;
}

/**
 * Сохранить лог: на Android — /sdcard/WinChat/logs/log.txt (через плагин,
 * с запасным путём), в браузере — скачать log.txt.
 */
export async function saveLogs(): Promise<SaveLogsOutcome> {
  devLog("saving logs requested");
  const text = getLogText();

  const native = await saveLogsNative(text);
  if (native?.saved) {
    devLog(`logs saved to ${native.path || "device storage"}`);
    return {
      ok: true,
      path: native.path || "/sdcard/WinChat/logs/log.txt",
      native: true,
      message: `Логи сохранены: ${native.path || "/sdcard/WinChat/logs/log.txt"}`,
    };
  }

  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "log.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    devLog("logs downloaded as log.txt");
    return { ok: true, path: "log.txt", native: false, message: "Файл log.txt скачан" };
  } catch (err) {
    devLog(`failed to save logs: ${describeError(err)}`, "error");
    return { ok: false, path: "", native: false, message: "Не удалось сохранить логи" };
  }
}
