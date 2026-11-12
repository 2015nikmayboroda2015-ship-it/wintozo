/**
 * Скачивание фото/видео из чата.
 *
 * На нативном Android файл попадает в общую галерею:
 *   DCIM/WinChat/Photos  — фотографии
 *   DCIM/WinChat/Video   — видео
 * В браузере — обычное скачивание средствами браузера.
 */
import { saveMediaNative } from "./nativeStorage";

export interface DownloadOutcome {
  ok: boolean;
  /** Куда сохранён файл (для показа пользователю). */
  path?: string;
  /** Готовое сообщение для тоста. */
  message: string;
}

function extensionFromUrl(url: string, kind: "photo" | "video"): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const match = path.match(/\.(jpe?g|png|webp|gif|avif|heic|mp4|webm|mov|m4v|3gp)$/);
    if (match) return match[1].replace("jpeg", "jpg");
  } catch {
    /* no-op */
  }
  return kind === "video" ? "mp4" : "jpg";
}

function extensionFromMime(mime: string | null, kind: "photo" | "video"): string {
  const value = (mime || "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  if (value.includes("avif")) return "avif";
  if (value.includes("heic")) return "heic";
  if (value.includes("webm")) return "webm";
  if (value.includes("quicktime")) return "mov";
  if (value.includes("3gpp")) return "3gp";
  if (value.includes("mp4")) return "mp4";
  return kind === "video" ? "mp4" : "jpg";
}

function baseName(kind: "photo" | "video", ext: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${kind === "video" ? "WinChat_Video" : "WinChat_Photo"}_${stamp}.${ext}`;
}

/** Скачивает файл в браузере (в том числе на Android без нативного плагина). */
async function downloadInBrowser(url: string, kind: "photo" | "video"): Promise<DownloadOutcome> {
  const fallbackName = baseName(kind, extensionFromUrl(url, kind));
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const ext = extensionFromMime(blob.type, kind);
    const fileName = baseName(kind, ext);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return {
      ok: true,
      path: fileName,
      message: "Файл скачан в «Загрузки»",
    };
  } catch {
    // CORS/сеть: пробуем открыть напрямую — браузер сохранит файл сам.
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fallbackName;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { ok: true, path: fallbackName, message: "Открыли файл для скачивания" };
    } catch {
      return { ok: false, message: "Не удалось скачать файл" };
    }
  }
}

/**
 * Сохраняет фото/видео из сообщения.
 * @param url публичная ссылка на файл
 * @param kind "photo" — DCIM/WinChat/Photos, "video" — DCIM/WinChat/Video
 */
export async function downloadMedia(
  url: string,
  kind: "photo" | "video"
): Promise<DownloadOutcome> {
  if (!url) return { ok: false, message: "Файл недоступен" };

  const fileName = baseName(kind, extensionFromUrl(url, kind));
  const native = await saveMediaNative(url, kind, fileName);
  if (native?.saved) {
    return {
      ok: true,
      path: native.path,
      message:
        kind === "video"
          ? "Видео сохранено в DCIM/WinChat/Video"
          : "Фото сохранено в DCIM/WinChat/Photos",
    };
  }

  return downloadInBrowser(url, kind);
}
