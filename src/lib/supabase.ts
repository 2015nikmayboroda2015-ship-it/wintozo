import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://iksgubxxxspkjwsazrwq.supabase.co";
export const SUPABASE_KEY = "sb_publishable_uEwTj3pmRCCbVg4HaQFeOg_GFmVoaHl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

/** Синтетическая почта из username — Supabase Auth требует email. */
export const emailFor = (username: string) => `${username.toLowerCase()}@winchat.app`;

export type VerifyLevel = "user" | "grey" | "green" | "full";

export interface Profile {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  verified?: boolean | null;
  verify_status?: VerifyLevel;
  created_at: string;
}

/** Аккаунты, которым галочка положена всегда. */
export const ALWAYS_VERIFIED = ["admin", "winchat"];

/** Уровень верификации пользователя (для галочек). */
export const verifyLevel = (p?: Profile | null): VerifyLevel => {
  if (!p) return "user";
  const lvl = (p.verify_status || "user") as VerifyLevel;
  // Системные аккаунты всегда "full"
  if (ALWAYS_VERIFIED.includes(p.username.toLowerCase())) return "full";
  return lvl;
};

/** Есть ли у пользователя хоть какая-то галочка. */
export const isVerified = (p?: Profile | null): boolean => verifyLevel(p) !== "user";

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  video_url: string | null;
  video_duration: number | null;
  created_at: string;
}

export interface ChatRow {
  id: string;
  direct_key: string | null;
  is_group: boolean;
  title: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface ChatItem {
  id: string;
  isGroup: boolean;
  /** Отображаемое имя: никнейм собеседника или название группы */
  title: string;
  description: string | null;
  avatarUrl: string | null;
  /** Собеседник в личном чате, null — в группе */
  other: Profile | null;
  members: Profile[];
  ownerId: string | null;
  lastMessage: Message | null;
  updatedAt: string;
}

/** Ключ для градиента аватара */
export const chatSeed = (c: ChatItem) => (c.isGroup ? `group-${c.id}` : c.other?.username || c.id);

/* ============================================================ */
/*  Admin types and helpers                                      */
/* ============================================================ */

export interface UserRow {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  verified: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  admin_id: string;
  admin_username: string;
  target_id: string;
  action: 'ban' | 'unban' | 'delete' | 'verify' | 'unverify' | 'edit' | 'impersonate' | 'resign';
  details: Record<string, unknown>;
  created_at: string;
  target_nickname?: string;
  target_username?: string;
}

/** Storage key for impersonation session override */
const IMPERSONATE_KEY = "winchat_impersonate";

interface ImpersonateSession {
  targetId: string;
  targetUsername: string;
  targetNickname: string;
  startedAt: number;
}

/** Get current impersonation session from localStorage */
export function getImpersonateSession(): ImpersonateSession | null {
  try {
    const raw = localStorage.getItem(IMPERSONATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonateSession;
    // Auto-expire after 15 minutes
    if (Date.now() - parsed.startedAt > 15 * 60 * 1000) {
      clearImpersonateSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Set impersonation session in localStorage */
export function setImpersonateSession(targetId: string, targetUsername: string, targetNickname: string): void {
  const session: ImpersonateSession = {
    targetId,
    targetUsername,
    targetNickname,
    startedAt: Date.now(),
  };
  localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(session));
}

/** Clear impersonation session from localStorage */
export function clearImpersonateSession(): void {
  localStorage.removeItem(IMPERSONATE_KEY);
}

/** Check if currently impersonating another user */
export function isImpersonating(): boolean {
  return getImpersonateSession() !== null;
}

/** Returns the effective user ID — impersonated target or actual auth user */
export function getEffectiveUserId(realUserId: string): string {
  const imp = getImpersonateSession();
  return imp?.targetId ?? realUserId;
}
