/**
 * Стикеры и GIF.
 *
 * Файлы и паки стикеров живут на отдельном sticker-сервере Supabase:
 *   https://qscgbkwmbprzbwciyemh.supabase.co
 * В основной базе сообщений хранится только публичная ссылка (messages.sticker_url).
 *
 * Таблицы на sticker-сервере:
 *   sticker_packs  — паки пользователей
 *   sticker_items  — отдельные стикеры внутри пака
 */
import { createClient } from "@supabase/supabase-js";
import { uuid } from "./utils";

export const STICKER_URL = "https://qscgbkwmbprzbwciyemh.supabase.co";
export const STICKER_KEY = "sb_publishable_aeuwpnO92vU0nzMLFNFpXg__1O_4AX3";
export const STICKER_BUCKET = "stickers";
export const STICKER_MAX_BYTES = 10 * 1024 * 1024;
export const SAVED_PACK_NAME = "Сохранённые";

export interface StickerItem {
  id: string;
  pack_id: string;
  owner_id: string;
  url: string;
  created_at: string;
}

export interface StickerPack {
  id: string;
  owner_id: string;
  name: string;
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
  items: StickerItem[];
}

/** Отдельный клиент: не трогает сессию основного аккаунта. */
export const stickerClient = createClient(STICKER_URL, STICKER_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const PUBLIC_BASE = `${STICKER_URL}/storage/v1/object/public/${STICKER_BUCKET}`;

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  const mime = (file.type || "").toLowerCase();
  if (mime.includes("gif")) return "gif";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("avif")) return "avif";
  return "jpg";
}

/**
 * Загружает файл стикера/GIF на sticker-сервер и возвращает публичную ссылку.
 * В текстовую базу потом пишется только эта ссылка.
 */
export async function uploadSticker(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Стикер должен быть картинкой или GIF");
  }
  if (file.size > STICKER_MAX_BYTES) {
    throw new Error("Стикер больше 10 МБ — выберите файл поменьше");
  }

  const ext = extensionFor(file);
  const path = `${userId}/${Date.now()}-${uuid()}.${ext}`;
  const { error } = await stickerClient.storage.from(STICKER_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: "31536000",
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;

  const { data } = stickerClient.storage.from(STICKER_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Не удалось получить ссылку на стикер");
  return data.publicUrl || `${PUBLIC_BASE}/${path}`;
}

/* ============================================================
   Паки стикеров
   ============================================================ */

/** Загружает все доступные паки вместе со стикерами. */
export async function listStickerPacks(): Promise<StickerPack[]> {
  const [{ data: packs, error: packsError }, { data: items, error: itemsError }] = await Promise.all([
    stickerClient
      .from("sticker_packs")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200),
    stickerClient
      .from("sticker_items")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(3000),
  ]);
  if (packsError) throw packsError;
  if (itemsError) throw itemsError;

  const byPack = new Map<string, StickerItem[]>();
  for (const item of (items as StickerItem[]) || []) {
    const list = byPack.get(item.pack_id) || [];
    list.push(item);
    byPack.set(item.pack_id, list);
  }

  return ((packs as Omit<StickerPack, "items">[]) || []).map((pack) => ({
    ...pack,
    items: byPack.get(pack.id) || [],
  }));
}

/** Создаёт новый пак и возвращает его. */
export async function createStickerPack(name: string, ownerId: string): Promise<StickerPack> {
  const clean = name.trim();
  if (!clean) throw new Error("Введите название пака");
  if (clean.length > 40) throw new Error("Название слишком длинное");
  const { data, error } = await stickerClient
    .from("sticker_packs")
    .insert({ id: uuid(), owner_id: ownerId, name: clean, is_public: true })
    .select()
    .single();
  if (error) throw error;
  return { ...(data as Omit<StickerPack, "items">), items: [] };
}

/** Добавляет ссылку на стикер в пак. */
export async function addStickerToPack(
  packId: string,
  ownerId: string,
  url: string
): Promise<StickerItem> {
  const { data, error } = await stickerClient
    .from("sticker_items")
    .insert({ id: uuid(), pack_id: packId, owner_id: ownerId, url })
    .select()
    .single();
  if (error) throw error;
  return data as StickerItem;
}

/** Удаляет стикер из пака (только свой пак). */
export async function removeStickerItem(itemId: string): Promise<void> {
  const { error } = await stickerClient.from("sticker_items").delete().eq("id", itemId);
  if (error) throw error;
}

/** Находит или создаёт пак «Сохранённые» для пользователя. */
export async function ensureSavedPack(ownerId: string): Promise<StickerPack> {
  const { data, error } = await stickerClient
    .from("sticker_packs")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("name", SAVED_PACK_NAME)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return { ...(data as Omit<StickerPack, "items">), items: [] };
  return createStickerPack(SAVED_PACK_NAME, ownerId);
}

/**
 * Сохраняет чужой стикер себе. Файл уже лежит на sticker-сервере,
 * поэтому повторно загружать его не нужно — просто добавляем ссылку в пак.
 */
export async function saveStickerToPack(
  url: string,
  ownerId: string,
  packId?: string
): Promise<StickerPack> {
  const pack = packId ? null : await ensureSavedPack(ownerId);
  const targetId = packId || pack!.id;

  const { data: existing, error: checkError } = await stickerClient
    .from("sticker_items")
    .select("id")
    .eq("pack_id", targetId)
    .eq("url", url)
    .limit(1)
    .maybeSingle();
  if (checkError) throw checkError;
  if (!existing) await addStickerToPack(targetId, ownerId, url);

  if (pack) return pack;
  const { data } = await stickerClient
    .from("sticker_packs")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();
  return data
    ? { ...(data as Omit<StickerPack, "items">), items: [] }
    : createStickerPack("Мои стикеры", ownerId);
}
