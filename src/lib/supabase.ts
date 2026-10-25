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
  winpass?: string | null;
  winpro_until?: string | null;
  created_at: string;
}

/** Аккаунты, которым галочка положена всегда. */
export const ALWAYS_VERIFIED = ["admin", "winchat"];

/** Активна ли подписка WinPro (базовая серая галочка и корона). */
export const isWinProActive = (p?: Profile | null): boolean => {
  if (!p?.winpro_until) return false;
  return new Date(p.winpro_until) > new Date();
};

/** Уровень верификации пользователя (для галочек). */
export const verifyLevel = (p?: Profile | null): VerifyLevel => {
  if (!p) return "user";
  const lvl = (p.verify_status || "user") as VerifyLevel;
  // Системные аккаунты всегда "full"
  if (ALWAYS_VERIFIED.includes(p.username.toLowerCase())) return "full";
  // WinPro даёт базовую серую галочку
  if (lvl === "user" && isWinProActive(p)) return "grey";
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

/* ============================================================ */
/*  WinPass — код восстановления аккаунта (33b42-XXXXXXXX)      */
/* ============================================================ */

/** RPC: найти пользователя по WinPass. */
export async function findWinpass(winpass: string): Promise<{
  ok: boolean;
  user_id?: string;
  username?: string;
  nickname?: string;
  temp_password?: string;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("login_by_winpass", { _winpass: winpass });
  if (error) throw error;
  return data as any;
}

/**
 * Войти по WinPass без пароля:
 *   1. login_by_winpass (RPC security definer) -> проверяет код и ставит
 *      пароль аккаунта = временный ключ из кода, возвращает его
 *   2. signInWithPassword(username, temp_password)
 * Секретный ключ в браузере не используется — вся привилегия на стороне Postgres.
 */
export async function loginByWinpass(winpass: string): Promise<void> {
  const code = normalizeWinpass(winpass);
  const res = await findWinpass(code);
  if (!res.ok || !res.username || !res.temp_password) {
    throw new Error(res.error || "Неверный WinPass");
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: emailFor(res.username),
    password: res.temp_password,
  });
  if (signErr) throw new Error(signErr.message);
}

/**
 * Нормализовать ввод WinPass — канонический вид «33b42-xxxxxxxxxxxx».
 * Локально, чтобы не тянуть utils по кругу.
 */
export function normalizeWinpass(v: string): string {
  let s = v.trim().toLowerCase().replace(/\s+/g, "");
  if (s.startsWith("33b42")) s = s.slice(5).replace(/^-/, "");
  if (!/^[0-9a-f]{12}$/.test(s)) return "";
  return `33b42-${s}`;
}

/** RPC: получить свой WinPass. */
export async function getMyWinpass(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_my_winpass", { _user_id: userId });
  if (error) throw error;
  return data as string | null;
}

/** RPC: сгенерировать новый WinPass (сброс кода). */
export async function regenerateWinpass(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("regenerate_winpass", { _user_id: userId });
  if (error) throw error;
  return data as string;
}

/** Прямая проверка пароля через Supabase Auth (для входа по WinPass). */
export async function verifyPasswordFor(username: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailFor(username),
    password,
  });
  return !error;
}

