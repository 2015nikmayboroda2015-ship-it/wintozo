import type { Message } from "./supabase";

/**
 * «Избранное» — локальные заметки пользователя.
 *
 * Они не создаются в Supabase и не синхронизируются между устройствами:
 * всё лежит в localStorage этого браузера/приложения, отдельно для
 * каждого аккаунта на устройстве.
 */

/** Синтетический id чата «Избранное» — в базе такого чата нет. */
export const SAVED_CHAT_ID = "local:saved-notes";

const MAX_NOTES = 1000;

const storageKey = (userId: string) => `winchat_saved_notes_v1:${userId}`;

/** Прочитать локальные заметки (старые сверху, новые снизу). */
export function loadSavedNotes(userId: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is Message => !!m && typeof m === "object" && typeof (m as Message).id === "string")
      .map((m) => ({
        ...m,
        chat_id: SAVED_CHAT_ID,
        sender_id: userId,
      }))
      .slice(-MAX_NOTES);
  } catch {
    return [];
  }
}

/** Сохранить локальные заметки. Тихо игнорирует переполнение хранилища. */
export function persistSavedNotes(userId: string, notes: Message[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(notes.slice(-MAX_NOTES)));
  } catch {
    /* нет места или localStorage недоступен */
  }
}

/** Событие для синхронизации открытого чата между вкладками. */
export function notifySavedNotesChanged(userId: string): void {
  try {
    window.dispatchEvent(new CustomEvent("winchat:saved-notes", { detail: { userId } }));
  } catch {
    /* no-op */
  }
}
