import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AtSign,
  Camera,
  Crown,
  Link2,
  Loader2,
  LogOut,
  Megaphone,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import {
  canManageChat,
  chatSeed,
  isVerified,
  supabase,
  type ChatItem,
  type Profile,
  type VerifyLevel,
} from "../lib/supabase";
import { badgeCodes, BADGE_IMAGES, BADGE_LABELS } from "../lib/badges";
import { validateBio, validateGroupTitle } from "../lib/utils";
import { filesUpload } from "../lib/blobStorage";
import Avatar from "./Avatar";
import Verified from "./Verified";
import { cn } from "../utils/cn";

interface Props {
  chat: ChatItem;
  me: Profile;
  onlineIds: Set<string>;
  onClose: () => void;
  onUpdated: () => void;
  onLeft: () => void;
}

export default function ChatInfoModal({
  chat,
  me,
  onlineIds,
  onClose,
  onUpdated,
  onLeft,
}: Props) {
  const isChannel = !!chat.isChannel;
  const isOfficial = !!chat.isOfficial;
  const canManage = canManageChat(chat, me);
  const isOwner = chat.ownerId === me.id;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const [description, setDescription] = useState(chat.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* --- Управление участниками --- */
  const [manageOpen, setManageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<number | undefined>(undefined);

  /** Получить уровень галочки для профиля */
  const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
    const lvl = p?.verify_status || "user";
    if (!["grey", "green", "full"].includes(lvl)) return "full";
    return lvl as Exclude<VerifyLevel, "user">;
  };

  /** Роль участника в канале/группе. */
  const roleOf = (userId: string): string => {
    const fromMap = chat.memberRoles?.[userId];
    if (fromMap) return fromMap;
    if (userId === chat.ownerId) return "owner";
    return isChannel ? "subscriber" : "member";
  };

  const otherBadges = badgeCodes(chat.other);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    const cleanTitle = title.trim();
    const tErr = isChannel
      ? cleanTitle.length < 2
        ? "Название — минимум 2 символа"
        : cleanTitle.length > 48
          ? "Название — максимум 48 символов"
          : null
      : validateGroupTitle(title);
    if (tErr) return setError(tErr);
    const dErr = validateBio(description);
    if (dErr) return setError(dErr);
    setError(null);
    setBusy(true);

    if (isChannel) {
      // Каналы меняются только через серверный RPC (защита галочки/официальности).
      const { data, error: rpcErr } = await supabase.rpc("edit_wintozo_channel", {
        _user_id: me.id,
        _chat_id: chat.id,
        _title: title.trim(),
        _description: description.trim(),
        _avatar_url: null,
        _verified: null,
        _is_official: null,
      });
      setBusy(false);
      if (rpcErr) return setError("Не удалось сохранить изменения");
      const res = data as { ok: boolean; error?: string };
      if (!res.ok) return setError(res.error || "Не удалось сохранить изменения");
    } else {
      const { error: uErr } = await supabase
        .from("chats")
        .update({ title: title.trim(), description: description.trim() || null })
        .eq("id", chat.id);
      setBusy(false);
      if (uErr) return setError("Не удалось сохранить изменения");
    }

    setEditing(false);
    onUpdated();
  }

  async function uploadCover(file: File) {
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${chat.id}/cover.${ext}`;
      const url = `${await filesUpload("avatars", path, file, file.type)}?t=${Date.now()}`;
      if (isChannel) {
        const { data, error: rpcErr } = await supabase.rpc("edit_wintozo_channel", {
          _user_id: me.id,
          _chat_id: chat.id,
          _title: null,
          _description: null,
          _avatar_url: url,
          _verified: null,
          _is_official: null,
        });
        const res = data as { ok: boolean; error?: string } | null;
        if (rpcErr || !res?.ok) throw new Error(res?.error || "Не удалось загрузить обложку");
      } else {
        await supabase.from("chats").update({ avatar_url: url }).eq("id", chat.id);
      }
      onUpdated();
    } catch {
      setError("Не удалось загрузить обложку");
    } finally {
      setBusy(false);
    }
  }

  /* --- Поиск кандидатов для добавления (только когда панель открыта) --- */
  useEffect(() => {
    if (!manageOpen || !canManage) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(async () => {
      const pattern = `%${q.replace(/[%_]/g, "")}%`;
      const memberIds = new Set(chat.members.map((p) => p.id));
      memberIds.add(me.id);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.${pattern},nickname.ilike.${pattern}`)
        .limit(20);
      setSearchResults(((data as Profile[]) || []).filter((p) => !memberIds.has(p.id)));
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(searchDebounce.current);
  }, [searchQuery, manageOpen, canManage, chat.members, me.id]);

  async function addMember(p: Profile) {
    setError(null);
    const { error: aErr } = await supabase.from("chat_members").insert({
      chat_id: chat.id,
      user_id: p.id,
      role: isChannel ? "subscriber" : "member",
    });
    if (aErr) return setError(isChannel ? "Не удалось добавить подписчика" : "Не удалось добавить участника");
    setSearchResults((prev) => prev.filter((x) => x.id !== p.id));
    onUpdated();
  }

  async function removeMember(p: Profile) {
    if (p.id === chat.ownerId) return;
    setError(null);
    const { error: rErr } = await supabase
      .from("chat_members")
      .delete()
      .eq("chat_id", chat.id)
      .eq("user_id", p.id);
    if (rErr) return setError("Не удалось удалить участника");
    onUpdated();
  }

  /** Назначить/снять администратора канала. */
  async function setRole(p: Profile, role: "admin" | "subscriber" | "member") {
    if (p.id === chat.ownerId) return;
    setError(null);
    const { error: rErr } = await supabase
      .from("chat_members")
      .update({ role })
      .eq("chat_id", chat.id)
      .eq("user_id", p.id);
    if (rErr) return setError("Не удалось изменить роль");
    onUpdated();
  }

  async function leave() {
    if (isOfficial) return;
    setBusy(true);
    await supabase.from("chat_members").delete().eq("chat_id", chat.id).eq("user_id", me.id);
    setBusy(false);
    onLeft();
  }

  /** Копировать ссылку-приглашение в буфер обмена. */
  async function copyInvite() {
    if (!chat.invite_code) return;
    const path = chat.isChannel ? "/channel/invite" : "/group/invite";
    const url = `${window.location.origin}${path}/${chat.invite_code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* буфер может быть недоступен — не блокируем UI */
    }
  }

  async function deleteChannel() {
    setError(null);
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("delete_winchat_ch", {
      _user_id: me.id,
      _chat_id: chat.id,
    });
    setBusy(false);
    if (rpcErr) return setError("Не удалось удалить канал");
    const res = data as { ok: boolean; error?: string };
    if (!res.ok) return setError(res.error || "Не удалось удалить канал");
    onLeft();
  }

  const memberRow = (p: Profile): ReactNode => {
    const role = roleOf(p.id);
    const isChannelAdmin = role === "owner" || role === "admin";
    return (
      <div key={p.id} className="group/member flex items-center gap-3 rounded-2xl px-2 py-2">
        <Avatar profile={p} size="sm" online={onlineIds.has(p.id)} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-sm font-bold">
            <span className="truncate">{p.nickname}</span>
            {isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}
            {p.id === me.id && (
              <span className="ml-0.5 text-xs font-semibold text-black/35">вы</span>
            )}
          </p>
          <p className="truncate font-mono text-[11px] text-black/40">@{p.username}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {role === "owner" && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[10px] font-bold text-amber-700">
              <Crown className="h-3 w-3" />
              владелец
            </span>
          )}
          {role === "admin" && (
            <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">
              <ShieldCheck className="h-3 w-3" />
              админ
            </span>
          )}

          {canManage && manageOpen && isChannel && p.id !== me.id && p.id !== chat.ownerId && (
            <button
              type="button"
              onClick={() => setRole(p, isChannelAdmin ? "subscriber" : "admin")}
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-bold transition active:scale-95",
                isChannelAdmin
                  ? "bg-black/5 text-black/55 hover:bg-black/10"
                  : "bg-accent-soft text-accent hover:bg-accent/15"
              )}
            >
              {isChannelAdmin ? "− админ" : "+ админ"}
            </button>
          )}

          {canManage && manageOpen && p.id !== me.id && p.id !== chat.ownerId && (
            <button
              type="button"
              onClick={() => removeMember(p)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-600 transition hover:bg-red-500/20 active:scale-95"
              aria-label={`Удалить ${p.nickname} из ${isChannel ? "канала" : "группы"}`}
            >
              <UserMinus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const admins = chat.members.filter((p) => {
    const r = roleOf(p.id);
    return r === "owner" || r === "admin";
  });
  const subscribers = chat.members.filter((p) => {
    const r = roleOf(p.id);
    return r !== "owner" && r !== "admin";
  });

  return (
    <div className="font-app fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <div className="animate-scale-in relative flex max-h-[88vh] w-full max-w-md flex-col rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            {isChannel && <Megaphone className="h-4.5 w-4.5 text-black/45" />}
            {isChannel ? "О канале" : chat.isGroup ? "О группе" : "Профиль"}
          </h3>
          <div className="flex items-center gap-1">
            {chat.isGroup && canManage && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
                aria-label="Редактировать"
              >
                <Pencil className="h-4.5 w-4.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col items-center text-center">
            <div className="group relative">
              <Avatar
                name={chat.title}
                avatarUrl={chat.avatarUrl}
                seed={chatSeed(chat)}
                group={chat.isGroup}
                channel={isChannel}
                size="xl"
              />
              {chat.isGroup && canManage && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-ink/55 opacity-0 transition group-hover:opacity-100"
                  aria-label="Сменить обложку"
                >
                  {busy ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                  e.target.value = "";
                }}
              />
            </div>

            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-4 w-full rounded-xl border border-black/10 bg-paper px-4 py-2.5 text-center text-[17px] font-extrabold outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            ) : (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xl font-extrabold tracking-tight">
                {chat.title}
                {chat.isGroup && chat.verified && <Verified size="md" level="full" />}
                {!chat.isGroup && isVerified(chat.other) && (
                  <Verified size="md" level={badgeLevel(chat.other)} />
                )}
              </p>
            )}

            {isChannel && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                {isOfficial && (
                  <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-accent uppercase">
                    <Megaphone className="h-3 w-3" />
                    официальный
                  </span>
                )}
                {chat.myRole && (
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-black/50 uppercase">
                    {chat.myRole === "owner"
                      ? "владелец"
                      : chat.myRole === "admin"
                        ? "администратор"
                        : "подписчик"}
                  </span>
                )}
              </div>
            )}

            {!chat.isGroup && chat.other && (
              <p className="mt-1 flex items-center gap-1 font-mono text-sm font-semibold text-black/40">
                <AtSign className="h-3.5 w-3.5" />
                {chat.other.username}
              </p>
            )}
            {!chat.isGroup && chat.other && otherBadges.length > 0 && (
              <div className="mt-2 flex flex-col items-center">
                <div className="flex items-center gap-2">
                  {otherBadges.map((code) => (
                    <img
                      key={code}
                      src={BADGE_IMAGES[code]}
                      alt={BADGE_LABELS[code]}
                      className="h-10 w-10 rounded-full object-contain ring-1 ring-black/10"
                    />
                  ))}
                </div>
                <p className="mt-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                  Бейджи
                </p>
                <p className="mt-0.5 font-bold">{otherBadges.map((c) => BADGE_LABELS[c]).join(", ")}</p>
              </div>
            )}
            {chat.isGroup && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-black/40">
                <Users className="h-3.5 w-3.5" />
                {chat.members.length}{" "}
                {isChannel ? "подписчиков" : "участников"}
              </p>
            )}
          </div>

          {/* Описание */}
          <div className="mt-6">
            <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
              Описание
            </span>
            {editing ? (
              <>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 160))}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-black/10 bg-paper px-4 py-3 text-sm font-medium outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                  placeholder={isChannel ? "О чём этот канал" : "О чём эта группа"}
                />
                <p className="mt-1 text-right font-mono text-[10px] text-black/35">
                  {description.length}/160
                </p>
              </>
            ) : (
              <p className="rounded-2xl bg-paper px-4 py-3 text-sm leading-relaxed font-medium text-black/70">
                {(chat.isGroup ? chat.description : chat.other?.bio) || (
                  <span className="text-black/35">Описание пока не добавлено</span>
                )}
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm font-bold text-red-600">{error}</p>
          )}

          {editing && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setTitle(chat.title);
                  setDescription(chat.description ?? "");
                  setError(null);
                }}
                className="flex-1 rounded-xl border border-black/10 py-3 text-sm font-bold transition hover:bg-black/5"
              >
                Отмена
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex flex-1 items-center justify-center rounded-xl bg-ink py-3 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
              </button>
            </div>
          )}

          {/* Участники */}
          {chat.isGroup && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                  {isChannel ? "Подписчики" : "Участники"}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setManageOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                      manageOpen ? "bg-accent text-white" : "bg-accent-soft text-accent hover:bg-accent/15"
                    )}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {manageOpen ? "Готово" : "Управлять"}
                  </button>
                )}
              </div>

              {/* Панель поиска новых участников */}
              {manageOpen && canManage && (
                <div className="animate-fade-in mb-3 rounded-2xl border border-black/8 bg-paper p-3">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-black/35" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        isChannel
                          ? "Найти подписчика по @username или нику"
                          : "Найти пользователя по @username или нику"
                      }
                      className="w-full rounded-xl border border-black/10 bg-white py-2 pr-3 pl-9 text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {searching ? (
                      <div className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-black/40">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Поиск…
                      </div>
                    ) : (
                      searchResults.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                          <Avatar profile={p} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-1 text-[13px] font-bold">
                              <span className="truncate">{p.nickname}</span>
                              {isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}
                            </p>
                            <p className="truncate font-mono text-[11px] text-black/40">@{p.username}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addMember(p)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/85 active:scale-95"
                            aria-label={`Добавить ${p.nickname}`}
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {isChannel ? (
                <>
                  {admins.length > 0 && (
                    <>
                      <p className="mb-1 px-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-black/35 uppercase">
                        Администраторы
                      </p>
                      <div className="space-y-0.5">{admins.map(memberRow)}</div>
                    </>
                  )}
                  {subscribers.length > 0 && (
                    <>
                      <p className="mt-3 mb-1 px-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-black/35 uppercase">
                        Подписчики · {subscribers.length}
                      </p>
                      <div className="space-y-0.5">{subscribers.map(memberRow)}</div>
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-0.5">{chat.members.map(memberRow)}</div>
              )}
            </div>
          )}
        </div>

        {(chat.isGroup || (isChannel && canManage)) && (
          <div className="border-t border-black/8 px-6 py-4">
            {chat.invite_code && (
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-paper py-3 text-sm font-bold transition hover:bg-black/5"
              >
                <Link2 className="h-4 w-4" />
                Пригласить по ссылке
              </button>
            )}

            {isChannel && canManage && (
              <div className="space-y-2">
                {confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 rounded-xl border border-black/10 py-3 text-sm font-bold transition hover:bg-black/5"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={deleteChannel}
                      disabled={busy}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Удалить навсегда
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить канал
                  </button>
                )}
              </div>
            )}

            {isOfficial ? (
              <p className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent/8 px-3 py-2.5 text-center text-[12px] font-semibold text-accent">
                <Megaphone className="h-4 w-4 shrink-0" />
                Официальный канал — отписка невозможна
              </p>
            ) : isChannel ? (
              isOwner ? (
                <p className="mt-2 text-center text-[12px] font-semibold text-black/40">
                  Вы владелец канала
                </p>
              ) : (
                <button
                  onClick={leave}
                  disabled={busy}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  Отписаться от канала
                </button>
              )
            ) : (
              <button
                onClick={leave}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Покинуть группу
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
