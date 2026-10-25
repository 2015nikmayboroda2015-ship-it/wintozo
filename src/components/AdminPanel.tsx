import { useEffect, useState } from "react";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  adminBan,
  adminDeleteUser,
  adminEditProfile,
  adminGetAudit,
  adminGetUsers,
} from "../lib/adminApi";
import { cn } from "../utils/cn";
import Avatar from "./Avatar";

/* ============================================================ */
/*  Admin Panel — модальное окно администратора                  */
/* ============================================================ */

interface Props {
  meId: string;
  onClose: () => void;
}

type Tab = "users" | "audit";
type UserDetailMode = "view" | "edit";

export default function AdminPanel({ meId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<
    Array<{ id: string; username: string; nickname: string; avatar_url: string | null; bio: string | null; verified: boolean; banned_at: string | null; ban_reason: string | null; created_at: string }>
  >([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Details modal
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; nickname: string; avatar_url: string | null; bio: string | null; verified: boolean; banned_at: string | null; ban_reason: string | null; created_at: string } | null>(null);
  const [detailMode, setDetailMode] = useState<UserDetailMode>("view");
  const [editNickname, setEditNickname] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editVerified, setEditVerified] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Audit
  const [audits, setAudits] = useState<
    Array<{ id: string; admin_id: string; admin_username: string; target_id: string; action: string; details: Record<string, unknown>; created_at: string; target_nickname?: string; target_username?: string }>
  >([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);

  /* ---------- Load users ---------- */
  const loadUsers = async (p: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetUsers(p, 50, q);
      setUsers(res.users);
      setTotalPages(res.total_pages);
    } catch (e) {
      const msg = (e as Error).message || "Не удалось загрузить пользователей";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = window.setTimeout(() => loadUsers(page, search), 200);
    return () => window.clearTimeout(delay);
  }, [page, search]);

  /* ---------- Load audit ---------- */
  const loadAudit = async (p: number) => {
    setAuditLoading(true);
    try {
      const res = await adminGetAudit(p, 50);
      setAudits(res.audits);
      setAuditTotal(res.total);
    } catch {
      // silent
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadAudit(auditPage);
  }, [auditPage]);

  /* ---------- Actions ---------- */
  const handleBan = async (userId: string, doBan: boolean) => {
    const reason = doBan ? banReason || "Нарушение правил" : "";
    try {
      await adminBan(userId, reason, doBan);
      // Reload selected user if open
      if (selectedUser?.id === userId) {
        setSelectedUser((u) =>
          u
            ? {
                ...u,
                banned_at: doBan ? new Date().toISOString() : null,
                ban_reason: doBan ? reason : null,
              }
            : null
        );
      }
      // Reload users list
      loadUsers(page, search);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Удалить пользователя? Это действие нельзя отменить.")) return;
    try {
      await adminDeleteUser(userId);
      if (selectedUser?.id === userId) setSelectedUser(null);
      loadUsers(page, search);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleEditSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await adminEditProfile(selectedUser.id, editNickname, editUsername, editVerified);
      setSelectedUser((u) =>
        u
          ? {
              ...u,
              nickname: editNickname,
              username: editUsername,
              verified: editVerified,
            }
          : null
      );
      setDetailMode("view");
      loadUsers(page, search);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Helpers ---------- */
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const actionLabel = (a: string) => {
    const map: Record<string, string> = {
      ban: "Бан",
      unban: "Разбан",
      delete: "Удаление",
      verify: "Верификация",
      unverify: "Отмена верификации",
      edit: "Редактирование",
      resign: "Выход из админ-режима",
    };
    return map[a] || a;
  };

  const actionColor = (a: string) => {
    const map: Record<string, string> = {
      ban: "text-red-600 bg-red-500/10",
      unban: "text-emerald-600 bg-emerald-500/10",
      delete: "text-red-600 bg-red-500/15",
      verify: "text-blue-600 bg-blue-500/10",
      unverify: "text-gray-600 bg-gray-500/10",
      edit: "text-amber-600 bg-amber-500/10",
      resign: "text-gray-600 bg-gray-500/10",
    };
    return map[a] || "text-black/40 bg-black/5";
  };

  /* ---------- Render ---------- */
  return (
    <div className="font-app fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />

      <div className="animate-scale-in relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[28px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-ink" strokeWidth={2} />
            <h3 className="text-lg font-extrabold tracking-tight">Админ-панель</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black/8 px-6">
          {(["users", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-3 text-sm font-bold transition border-b-2",
                tab === t
                  ? "border-ink text-ink"
                  : "border-transparent text-black/40 hover:text-ink"
              )}
            >
              {t === "users" ? (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Пользователи
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Аудит
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* ---- Users tab ---- */}
          {tab === "users" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-black/35" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Поиск по username / nickname"
                  className="w-full rounded-xl border border-black/10 bg-paper py-2.5 pr-4 pl-10 text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-600">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center gap-2.5 py-12 text-sm font-semibold text-black/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загружаем…
                </div>
              ) : users.length === 0 ? (
                <p className="py-12 text-center text-sm font-medium text-black/40">Пользователи не найдены</p>
              ) : (
                <>
                  <div className="space-y-1">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                          "hover:bg-paper cursor-pointer",
                          u.banned_at && "bg-red-500/5"
                        )}
                        onClick={() => setSelectedUser(u)}
                      >
                        <Avatar profile={u} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-bold">
                            <span className="truncate">{u.nickname}</span>
                            {u.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#1d9bf0]" />}
                            {u.id === meId && (
                              <span className="ml-0.5 text-[10px] font-bold text-black/30">вы</span>
                            )}
                          </p>
                          <p className="truncate font-mono text-[11px] text-black/40">@{u.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {u.banned_at ? (
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              забанен
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              активен
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-black/5"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-medium text-black/40">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-black/5"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---- Audit tab ---- */}
          {tab === "audit" && (
            <div className="space-y-3">
              {auditLoading ? (
                <div className="flex items-center justify-center gap-2.5 py-12 text-sm font-semibold text-black/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загружаем…
                </div>
              ) : audits.length === 0 ? (
                <p className="py-12 text-center text-sm font-medium text-black/40">Аудит пуст</p>
              ) : (
                <>
                  <div className="space-y-1">
                    {audits.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", actionColor(a.action))}>
                          {actionLabel(a.action)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">
                            <span className="font-bold">{a.admin_username}</span>
                            {" → "}
                            <span className="truncate">
                              {a.target_nickname || a.target_username || a.target_id.slice(0, 8)}
                            </span>
                          </p>
                          <p className="truncate font-mono text-[10px] text-black/35">{formatDate(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {auditTotal > 50 && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={auditPage <= 1}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-black/5"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-medium text-black/40">
                        {auditPage} / {Math.ceil(auditTotal / 50)}
                      </span>
                      <button
                        onClick={() => setAuditPage((p) => p + 1)}
                        disabled={auditPage * 50 >= auditTotal}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-black/5"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ---- User Detail Modal ---- */}
        {selectedUser && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-[2px]">
            <div className="animate-scale-in mx-4 max-w-md w-full rounded-[24px] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold tracking-tight">
                  {detailMode === "edit" ? "Редактирование" : "Профиль"}
                </h4>
                <div className="flex items-center gap-1">
                  {detailMode === "view" && selectedUser.id !== meId && (
                    <button
                      onClick={() => setDetailMode("edit")}
                      className="rounded-full p-1.5 text-black/30 transition hover:bg-black/5 hover:text-ink"
                      title="Редактировать"
                    >
                      <span className="text-xs font-bold">✏️</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="rounded-full p-1.5 text-black/30 transition hover:bg-black/5 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center">
                <Avatar profile={selectedUser} size="xl" />
                <p className="mt-3 flex items-center gap-1.5 text-base font-extrabold">
                  <span className="truncate">{selectedUser.nickname}</span>
                  {selectedUser.verified && <ShieldCheck className="h-4 w-4 shrink-0 text-[#1d9bf0]" />}
                </p>
                <p className="font-mono text-sm text-black/40">@{selectedUser.username}</p>
                {selectedUser.banned_at && (
                  <p className="mt-1 text-xs font-bold text-red-600">
                    Забанен: {selectedUser.ban_reason || "без причины"}
                  </p>
                )}
              </div>

              {/* View mode */}
              {detailMode === "view" && (
                <div className="mt-5 space-y-3">
                  {selectedUser.bio && (
                    <p className="rounded-xl bg-paper px-4 py-3 text-sm font-medium text-black/70">
                      {selectedUser.bio}
                    </p>
                  )}

                  <p className="text-[11px] font-medium text-black/35">
                    Регистрация: {formatDate(selectedUser.created_at)}
                  </p>

                  {/* Actions */}
                  {selectedUser.id !== meId && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {selectedUser.banned_at ? (
                          <button
                            onClick={() => handleBan(selectedUser.id, false)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 py-2.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-500/5"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Разбанить
                          </button>
                        ) : (
                          <div className="flex flex-1 gap-2">
                            <input
                              value={banReason}
                              onChange={(e) => setBanReason(e.target.value)}
                              placeholder="Причина бана"
                              className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-xs font-medium outline-none focus:border-red-500"
                            />
                            <button
                              onClick={() => handleBan(selectedUser.id, true)}
                              className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-red-600"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Бан
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(selectedUser.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/25 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-500/5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Удалить аккаунт
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Edit mode */}
              {detailMode === "edit" && (
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-semibold tracking-[0.16em] text-black/40 uppercase">
                      Никнейм
                    </label>
                    <input
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-semibold tracking-[0.16em] text-black/40 uppercase">
                      Username
                    </label>
                    <input
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                      className="w-full rounded-xl border border-black/10 px-4 py-2.5 font-mono text-sm font-medium outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditVerified(!editVerified)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
                        editVerified
                          ? "bg-[#1d9bf0]/10 text-[#1d9bf0]"
                          : "bg-black/5 text-black/40"
                      )}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {editVerified ? "Верифицирован" : "Не верифицирован"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDetailMode("view");
                        setSelectedUser(selectedUser);
                      }}
                      className="flex-1 rounded-xl border border-black/10 py-2.5 text-xs font-bold transition hover:bg-black/5"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleEditSave}
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink py-2.5 text-xs font-bold text-white transition hover:bg-black disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Сохранить"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
