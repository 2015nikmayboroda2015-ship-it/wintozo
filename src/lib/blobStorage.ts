import { createClient } from "@supabase/supabase-js";

/**
 * WinChat files storage — отдельный Supabase-проект для файлов
 * (аватарки, фото, голосовые, видеокружки, обложки групп).
 *
 * Основной проект (aksgub...) остаётся для БД и realtime.
 */
const FILES_URL = "https://liprykmtennsmjtfpbuw.supabase.co";
const FILES_KEY = "sb_publishable_ZYjFzVYy0VkaUTGDW9uHow_-u9HnbFn";

export const filesClient = createClient(FILES_URL, FILES_KEY);

export type FilesBucket = "avatars" | "attachments" | "video-attachments";

const PUBLIC_BASE = `${FILES_URL}/storage/v1/object/public`;

/** Публичный URL файла в файловом проекте. */
export function filesPublicUrl(bucket: FilesBucket, path: string): string {
  return `${PUBLIC_BASE}/${bucket}/${path}`;
}

/** Загрузить файл в файловый проект, вернёт публичный URL. */
export async function filesUpload(
  bucket: FilesBucket,
  path: string,
  data: Blob | File,
  contentType?: string
): Promise<string> {
  const { error } = await filesClient.storage.from(bucket).upload(path, data, {
    upsert: true,
    cacheControl: "31536000",
    contentType,
  });
  if (error) throw error;
  return filesPublicUrl(bucket, path);
}

/** Удалить файл из файлового проекта (ошибки игнорируются). */
export async function filesRemove(bucket: FilesBucket, path: string): Promise<void> {
  await filesClient.storage.from(bucket).remove([path]).catch(() => undefined);
}

/** Достать путь объекта из публичного URL файлового проекта. */
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
