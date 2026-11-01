import { createClient } from "@supabase/supabase-js";

/**
 * WinChat files storage — два Supabase-проекта для файлов
 * (аватарки, фото, голосовые, видеокружки, обложки групп).
 *
 * Балансирование: файлы чередуются между двумя серверами, чтобы
 * не забивать хранилище одного проекта. Основной проект (aksgub...)
 * остаётся для БД и realtime.
 */
const FILES_URL = "https://liprykmtennsmjtfpbuw.supabase.co";
const FILES_KEY = "sb_publishable_ZYjFzVYy0VkaUTGDW9uHow_-u9HnbFn";

export const filesClient = createClient(FILES_URL, FILES_KEY);

export type FilesBucket = "avatars" | "attachments" | "video-attachments";

const PUBLIC_BASE = `${FILES_URL}/storage/v1/object/public`;

/* ---------- Второй сервер медиа + балансировщик ---------- */
import { files2Client, files2PublicUrl } from "./blobStorage2";

let uploadCounter = 0;
try {
  uploadCounter = Number(localStorage.getItem("winchat_media_counter") || "0") || 0;
} catch {
  /* no-op */
}

/** Чётный индекс → сервер 1, нечётный → сервер 2. Аватарки всегда на сервере 1. */
function pickServer(bucket: FilesBucket): 1 | 2 {
  if (bucket === "avatars") return 1;
  uploadCounter += 1;
  try {
    localStorage.setItem("winchat_media_counter", String(uploadCounter));
  } catch {
    /* no-op */
  }
  return uploadCounter % 2 === 0 ? 1 : 2;
}


/** Публичный URL файла в файловом проекте. */
export function filesPublicUrl(bucket: FilesBucket, path: string): string {
  return `${PUBLIC_BASE}/${bucket}/${path}`;
}

/** Загрузить файл с балансировкой между двумя серверами, вернёт публичный URL. */
export async function filesUpload(
  bucket: FilesBucket,
  path: string,
  data: Blob | File,
  contentType?: string
): Promise<string> {
  const server = pickServer(bucket);
  if (server === 2) {
    const { error } = await files2Client.storage.from(bucket).upload(path, data, {
      upsert: true,
      cacheControl: "31536000",
      contentType,
    });
    if (error) throw error;
    return files2PublicUrl(bucket, path);
  }
  const { error } = await filesClient.storage.from(bucket).upload(path, data, {
    upsert: true,
    cacheControl: "31536000",
    contentType,
  });
  if (error) throw error;
  return filesPublicUrl(bucket, path);
}

/** Удалить файл из того сервера, которому принадлежит URL (ошибки игнорируются). */
export async function filesRemove(bucket: FilesBucket, pathOrUrl: string): Promise<void> {
  // Если это полный URL — определяем сервер по домену
  const isServer2 = pathOrUrl.includes("ahikheicrjrocnlpurpw");
  const path = pathOrUrl.startsWith("http") ? filesPathFromUrl(pathOrUrl) ?? "" : pathOrUrl;
  if (!path) return;
  const client = isServer2 ? files2Client : filesClient;
  await client.storage.from(bucket).remove([path]).catch(() => undefined);
}

/** Достать путь объекта из публичного URL любого файлового проекта. */
export function filesPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("supabase.co")) return null;
    const marker = "/object/public/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    return decodeURIComponent(rest.slice(slash + 1));
  } catch {
    return null;
  }
}
