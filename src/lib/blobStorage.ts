import { Bucket } from "@upstash/blob";

/**
 * Upstash Blob — файловое хранилище WinChat (фото, голосовые, видео, аватарки).
 * Supabase остаётся только для БД (аккаунты, чаты, текстовые сообщения).
 *
 * Публичный bucket: https://b663be6ed6a5.blob.upstash.io
 */
const UPSTASH_BLOB_TOKEN =
  "AgAkADAMNWFlZjU3YTAtMGFiNi00MjcwLTg3YTktNmZhMDNmMDAxYzc4TlRBNFpqYzFZalV0WWpCaVppMDBOekJtTFdJeE4yWXRaREJtTlRGa05UWXdaVGt4YjY2M2JlNmVkNmE1";

export const blobBucket = new Bucket({ token: UPSTASH_BLOB_TOKEN });

export const BLOB_PUBLIC_BASE = "https://b663be6ed6a5.blob.upstash.io";

/** Загрузить файл, вернул публичный URL */
export async function blobPut(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array,
  contentType?: string
): Promise<string> {
  const res = await blobBucket.put(path, data, contentType ? { contentType } : undefined);
  return res.url ?? `${BLOB_PUBLIC_BASE}/${path}`;
}

/** Удалить файл по пути */
export async function blobDel(path: string): Promise<void> {
  await blobBucket.del(path).catch(() => undefined);
}

/**
 * Достать путь объекта из публичного URL.
 * Нужен для удаления при пересылке сообщений / удалении аватарки.
 */
export function blobPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("blob.upstash.io")) return null;
    return decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}
