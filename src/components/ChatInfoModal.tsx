import { useEffect, useRef, useState } from "react";
import { AtSign, Camera, Crown, Loader2, LogOut, Pencil, Users, X } from "lucide-react";
import { chatSeed, isVerified, supabase, type ChatItem, type Profile, type VerifyLevel } from "../lib/supabase";
import { blobPut } from "../lib/blobStorage";
import { validateBio, validateGroupTitle } from "../lib/utils";
import Avatar from "./Avatar";
import Verified from "./Verified";

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
  const isOwner = chat.ownerId === me.id;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const [description, setDescription] = useState(chat.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Получить уровень галочки для профиля */
  const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
    const lvl = p?.verify_status || "user";
    if (!["grey", "green", "full"].includes(lvl)) return "full";
    return lvl as Exclude<VerifyLevel, "user">;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    const tErr = validateGroupTitle(title);
    if (tErr) return setError(tErr);
    const dErr = validateBio(description);
    if (dErr) return setError(dErr);
    setError(null);
    setBusy(true);
    const { error: uErr } = await supabase
      .from("chats")
      .update({ title: title.trim(), description: description.trim() || null })
      .eq("id", chat.id);
    setBusy(false);
    if (uErr) return setError("Не удалось сохранить изменения");
    setEditing(false);
    onUpdated();
  }

  async function uploadCover(file: File) {
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `chat/${chat.id}/cover.${ext}`;
      const publicUrl = await blobPut(path, file, file.type || "image/png");
      const url = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("chats").update({ avatar_url: url }).eq("id", chat.id);
      onUpdated();
    } catch {
      setError("Не удалось загрузить обложку");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    await supabase.from("chat_members").delete().eq("chat_id", chat.id).eq("user_id", me.id);
    setBusy(false);
    onLeft();
  }

  return (
    <div className="font-app fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <div className="animate-scale-in relative flex max-h-[88vh] w-full max-w-md flex-col rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="text-lg font-extrabold tracking-tight">
            {chat.isGroup ? "О группе" : "Профиль"}
          </h3>
          <div className="flex items-center gap-1">
            {chat.isGroup && isOwner && !editing && (
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
                size="xl"
              />
              {chat.isGroup && isOwner && (
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
                {!chat.isGroup && isVerified(chat.other) && <Verified size="md" level={badgeLevel(chat.other)} />}
              </p>
            )}

            {!chat.isGroup && chat.other && (
              <p className="mt-1 flex items-center gap-1 font-mono text-sm font-semibold text-black/40">
                <AtSign className="h-3.5 w-3.5" />
                {chat.other.username}
              </p>
            )}
            {chat.isGroup && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-black/40">
                <Users className="h-3.5 w-3.5" />
                {chat.members.length} участников
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
                  placeholder="О чём эта группа"
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

          {/* Участники группы */}
          {chat.isGroup && (
            <div className="mt-6">
              <span className="mb-2 block font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                Участники
              </span>
              <div className="space-y-0.5">
                {chat.members.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
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
                    {chat.ownerId === p.id && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[10px] font-bold text-amber-700">
                        <Crown className="h-3 w-3" />
                        владелец
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {chat.isGroup && (
          <div className="border-t border-black/8 px-6 py-4">
            <button
              onClick={leave}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Покинуть группу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
