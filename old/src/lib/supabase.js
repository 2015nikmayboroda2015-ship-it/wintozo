import { createClient } from '@supabase/supabase-js'

// ============================================
// WINTOZO (legacy) — ПОДКЛЮЧЕНО К СЕРВЕРАМ WINCHAT
// ============================================
//
// ПРОЕКТ 1 (MEDIA): liprykmtennsmjtfpbuw.supabase.co
//   → голосовые, фотографии, аватарки (Storage)
//
// ПРОЕКТ 2 (CORE):  iksgubxxxspkjwsazrwq.supabase.co
//   → profiles, chats, chat_members, messages, realtime
//
// Схема нового WinChat:
//   users              → profiles
//   chat_participants  → chat_members
//   messages.sender_username → messages.sender_id (uuid)
//   media_type + media_url   → image_url / audio_url / video_url
//
// Всё, чего в новой версии нет (битвы, промокоды, spidi, старые
// Pro-таблицы), из legacy-интерфейса удалено.

export const MEDIA_URL = 'https://liprykmtennsmjtfpbuw.supabase.co'
export const MEDIA_KEY = 'sb_publishable_ZYjFzVYy0VkaUTGDW9uHow_-u9HnbFn'

export const CORE_URL = 'https://iksgubxxxspkjwsazrwq.supabase.co'
export const CORE_KEY = 'sb_publishable_uEwTj3pmRCCbVg4HaQFeOg_GFmVoaHl'

/** Первый Supabase — медиа: голосовые, фотографии, аватарки */
export const mediaSupabase = createClient(MEDIA_URL, MEDIA_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

/**
 * Второй Supabase — ядро WinChat.
 * persistSession по умолчанию включён: legacy-iframe живёт на том же origin,
 * что и новый WinChat, поэтому подхватывает его auth-сессию из localStorage.
 * Благодаря этому RLS на profiles/chats/chat_members/messages работает.
 */
export const coreSupabase = createClient(CORE_URL, CORE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})

/** Алиас `supabase` = coreSupabase (совместимость со старым кодом) */
export const supabase = coreSupabase
/** Алиас `media` = mediaSupabase */
export const media = mediaSupabase

/** Синтетическая почта из username — Supabase Auth требует email. */
export const emailFor = (username) => `${String(username).toLowerCase()}@winchat.app`

// ============================================
// ХРАНИЛИЩЕ (Storage) МЕДИА-ПРОЕКТА
// ============================================

export const MEDIA_BUCKETS = {
  avatars: 'avatars',        // аватарки пользователей
  messageMedia: 'attachments' // фото + голосовые в личных чатах
}

/** Загрузить файл в бакет медиа-проекта */
export async function uploadToMediaBucket(bucket, path, blob, contentType) {
  const { error } = await mediaSupabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType })
  if (error) throw error
  const { data } = mediaSupabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Удалить файл из бакета медиа-проекта */
export async function removeFromMediaBucket(bucket, path) {
  const { error } = await mediaSupabase.storage.from(bucket).remove([path])
  return { error }
}

/**
 * Метаданные медиа-файлов.
 * В новом WinChat таблицы media_files нет (медиа-проект отдаёт на неё 404),
 * а всё нужное и так лежит в public URL бакета. Поэтому функция оставлена
 * ради совместимости со старым кодом, но ничего не записывает.
 */
export async function registerMediaFile() {
  return { error: null }
}

/**
 * Конвертация изображения в WebP (самый лёгкий формат).
 */
export function convertToWebP(file, quality = 0.85) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            if (blob && blob.type === 'image/webp') {
              resolve(blob)
            } else {
              canvas.toBlob(
                (jpegBlob) => resolve(jpegBlob || file),
                'image/jpeg',
                quality
              )
            }
          },
          'image/webp',
          quality
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/* ============================================================
   Мост старой схемы → новая схема WinChat
   ============================================================ */

/** Профиль WinChat → формат старой таблицы users. */
export function profileToLegacyUser(p) {
  if (!p) return null
  return {
    ...p,
    id: p.id,
    username: p.username,
    nickname: p.nickname,
    avatar: null,                       // эмодзи-аватаров в новой версии нет
    avatar_url: p.avatar_url || null,
    description: p.bio || '',           // bio → description
    banned: !!p.ban_reason,
    created_at: p.created_at || null
  }
}

/** Сообщение WinChat → формат старого чата (media_type/media_url). */
export function messageToLegacy(m) {
  if (!m) return m
  let mediaType = null
  let mediaUrl = null
  if (m.image_url) { mediaType = 'photo'; mediaUrl = m.image_url }
  else if (m.audio_url) { mediaType = 'audio'; mediaUrl = m.audio_url }
  else if (m.video_url) { mediaType = 'video'; mediaUrl = m.video_url }

  return {
    ...m,
    sender_username: m.sender_username || nameCache.get(m.sender_id) || null,
    content: m.content || mediaUrl || '',
    media_type: mediaType,
    media_url: mediaUrl,
    duration: m.audio_duration ?? m.video_duration ?? null
  }
}

/** Аватарка: avatar_url → url; иначе первая буква ника. */
export function avatarUrlOf(u) {
  if (u?.avatar_url) return { img: u.avatar_url }
  return { letter: (u?.nickname || u?.username || '?')[0]?.toUpperCase() }
}

/* ---------- username ↔ uuid ---------- */

const uuidCache = new Map() // username → uuid
const nameCache = new Map() // uuid → username

/** Резолв одного username в uuid через profiles. */
export async function usernameToId(username) {
  const key = String(username || '').toLowerCase()
  if (!key) return null
  if (uuidCache.has(key)) return uuidCache.get(key)
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', key)
    .maybeSingle()
  if (!data) return null
  uuidCache.set(key, data.id)
  nameCache.set(data.id, data.username)
  return data.id
}

/** Резолв пачки username → uuid (один запрос). */
export async function usernamesToIds(usernames) {
  const uniq = [...new Set((usernames || []).map((u) => String(u || '').toLowerCase()))].filter(Boolean)
  if (!uniq.length) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', uniq)
  const map = new Map()
  if (!error) {
    for (const row of data || []) {
      map.set(String(row.username).toLowerCase(), row.id)
      nameCache.set(row.id, row.username)
      uuidCache.set(String(row.username).toLowerCase(), row.id)
    }
  }
  return map
}

/** Резолв uuid → username (один запрос на пачку). */
export async function idsToUsernames(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))]
  if (!uniq.length) return new Map()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', uniq)
    const map = new Map()
    if (!error) {
      for (const row of data || []) {
        map.set(row.id, row.username)
        nameCache.set(row.id, row.username)
        uuidCache.set(String(row.username).toLowerCase(), row.id)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

/** Имя отправителя из кэша (или null, если ещё не резолвили). */
export function legacySenderName(senderId) {
  return nameCache.get(senderId) || null
}

/* ---------- личные чаты ---------- */

/** Ключ личного диалога в новой схеме: "uuidA:uuidB" (отсортировано). */
export function directKey(a, b) {
  return [a, b].sort().join(':')
}

/**
 * Найти или создать личный чат между двумя профилями.
 * Возвращает строку chats (или null при ошибке).
 */
export async function ensureDirectChat(meId, otherId) {
  if (!meId || !otherId) return null
  const key = directKey(meId, otherId)

  const { data: existing } = await supabase
    .from('chats')
    .select('*')
    .eq('direct_key', key)
    .maybeSingle()
  if (existing) return existing

  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('chats')
    .insert({ id, direct_key: key, is_group: false, created_by: meId })

  if (error) {
    // Чат мог создать собеседник между нашими запросами.
    const { data: again } = await supabase
      .from('chats')
      .select('*')
      .eq('direct_key', key)
      .maybeSingle()
    return again || null
  }

  // Две отдельные вставки: RLS-политика chat_members_insert разрешает
  // добавить себя (user_id = auth.uid()), а собеседника — только когда
  // текущий пользователь уже участник чата.
  await supabase.from('chat_members').insert({ chat_id: id, user_id: meId })
  await supabase.from('chat_members').insert({ chat_id: id, user_id: otherId })
  return { id, direct_key: key, is_group: false, created_by: meId }
}
