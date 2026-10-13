import { supabase } from "./supabase";
import type { UserRow, AuditEntry } from "./supabase";

/* ============================================================ */
/*  Admin API — RPC-обёртки для всех админских функций          */
/* ============================================================ */

/** Получить список пользователей */
export async function adminGetUsers(page = 1, perPage = 50, search = "") {
  const { data, error } = await supabase.rpc("admin_get_users", {
    page,
    per_page: perPage,
    search,
  });
  if (error) throw error;
  return data as {
    users: UserRow[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

/** Забанить / разбанить пользователя */
export async function adminBan(targetId: string, reason: string, doBan: boolean) {
  const { data, error } = await supabase.rpc("admin_ban", {
    target_uuid: targetId,
    reason,
    do_ban: doBan,
  });
  if (error) throw error;
  return data as { ok?: boolean; banned_at?: string | null; ban_reason?: string | null; error?: string };
}

/** Удалить пользователя */
export async function adminDeleteUser(targetId: string) {
  const { data, error } = await supabase.rpc("admin_delete_user", {
    target_uuid: targetId,
  });
  if (error) throw error;
  return data as { ok?: boolean; deleted?: boolean; error?: string };
}

/** Изменить профиль (никнейм, username, верификация) */
export async function adminEditProfile(
  targetId: string,
  newNickname: string,
  newUsername: string,
  newVerified: boolean
) {
  const { data, error } = await supabase.rpc("admin_edit_profile", {
    target_uuid: targetId,
    new_nickname: newNickname,
    new_username: newUsername,
    new_verified: newVerified,
  });
  if (error) throw error;
  return data as { ok?: boolean; error?: string };
}

/** Временный вход на аккаунт (возвращает target_id) */
export async function adminImpersonate(targetId: string) {
  const { data, error } = await supabase.rpc("admin_impersonate", {
    target_uuid: targetId,
  });
  if (error) throw error;
  return data as {
    ok?: boolean;
    target_id?: string;
    target_nickname?: string;
    target_username?: string;
    error?: string;
  };
}

/** Выход из админ-режима */
export async function adminResign() {
  const { data, error } = await supabase.rpc("admin_resign", {});
  if (error) throw error;
  return data as { ok?: boolean; error?: string };
}

/** Получить аудит-логи */
export async function adminGetAudit(page = 1, perPage = 50) {
  const { data, error } = await supabase.rpc("admin_get_audit", {
    page,
    per_page: perPage,
  });
  if (error) throw error;
  return data as {
    audits: AuditEntry[];
    total: number;
    page: number;
    per_page: number;
  };
}

/** Проверить, забанен ли пользователь */
export async function checkBanned(userId: string) {
  const { data, error } = await supabase.rpc("check_banned", {
    user_uuid: userId,
  });
  if (error) throw error;
  return data as "ok" | "banned" | "not_found";
}
