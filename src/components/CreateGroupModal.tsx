import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, Loader2, Megaphone, Search, Users, X } from "lucide-react";
import { isVerified, supabase, type Profile, type VerifyLevel, genInviteCode } from "../lib/supabase";
import { uuid, validateBio, validateGroupTitle } from "../lib/utils";
import { filesUpload } from "../lib/blobStorage";
import Avatar from "./Avatar";
import Verified from "./Verified";
import { cn } from "../utils/cn";

interface Props {
  me: Profile;
  /** group — обычная группа, channel — канал (писать смогут только админы). */
  mode?: "group" | "channel";
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

export default function CreateGroupModal({ me, mode = "group", onClose, onCreated }: Props) {
  const isChannel = mode === "channel";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      const pattern = `%${q.replace(/[%_]/g, "")}%`;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", me.id)
        .or(`username.ilike.${pattern},nickname.ilike.${pattern}`)
        .limit(20);
      setResults((data as Profile[]) || []);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(debounce.current);
  }, [query, me.id]);

  function toggle(p: Profile) {
    setPicked((prev) =>
      prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]
    );
  }

  async function create() {
    const tErr = validateGroupTitle(title);
    if (tErr) return setError(tErr);
    const dErr = validateBio(description);
    if (dErr) return setError(dErr);
    if (!isChannel && picked.length === 0) return setError("Добавьте хотя бы одного участника");

    setError(null);
    setBusy(true);
    try {
      let chatId = "";

      if (isChannel) {
        // Канал создаётся серверным RPC: любой пользователь может создать канал.
        const { data, error: chErr } = await supabase.rpc("create_winchat_ch", {
          _creator_id: me.id,
          _title: title.trim(),
          _description: description.trim() || null,
          _avatar_url: null,
        });
        if (chErr) throw chErr;
        const chRes = data as { ok: boolean; chat_id?: string; error?: string };
        if (!chRes.ok || !chRes.chat_id) {
          throw new Error(chRes.error || "Не удалось создать канал");
        }
        chatId = chRes.chat_id;

        // Приглашение для шаринга: проставляем код сразу после создания.
        const inviteCode = genInviteCode();
        await supabase.from("chats").update({ invite_code: inviteCode }).eq("id", chatId);
        if (avatarFile) {
          const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
          const path = `${chatId}/cover.${ext}`;
          try {
            const avatar_url = `${await filesUpload("avatars", path, avatarFile, avatarFile.type)}?t=${Date.now()}`;
            await supabase.rpc("edit_wintozo_channel", {
              _user_id: me.id,
              _chat_id: chatId,
              _title: null,
              _description: null,
              _avatar_url: avatar_url,
              _verified: null,
              _is_official: null,
            });
          } catch {
            // Обложка не критична — канал уже создан.
          }
        }
      } else {
        chatId = uuid();
        let avatar_url: string | null = null;

        if (avatarFile) {
          const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
          const path = `${chatId}/cover.${ext}`;
          try {
            avatar_url = `${await filesUpload("avatars", path, avatarFile, avatarFile.type)}?t=${Date.now()}`;
          } catch {
            avatar_url = null;
          }
        }

        const { error: cErr } = await supabase.from("chats").insert({
          id: chatId,
          is_group: true,
          is_channel: false,
          title: title.trim(),
          description: description.trim() || null,
          avatar_url,
          created_by: me.id,
          invite_code: genInviteCode(),
        });
        if (cErr) throw cErr;

        await supabase.from("chat_members").insert({
          chat_id: chatId,
          user_id: me.id,
          role: "owner",
        });
      }

      for (const p of picked) {
        await supabase.from("chat_members").insert({
          chat_id: chatId,
          user_id: p.id,
          role: isChannel ? "subscriber" : "member",
        });
      }

      // Уведомляем участников, чтобы чат появился у них сразу
      picked.forEach((p) => {
        const ping = supabase.channel(`user:${p.id}`);
        ping.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ping.send({ type: "broadcast", event: "new_chat", payload: {} });
            window.setTimeout(() => supabase.removeChannel(ping), 600);
          }
        });
      });

      onCreated(chatId);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : isChannel
            ? "Не удалось создать канал. Проверьте, что SQL обновления выполнен."
            : "Не удалось создать группу. Проверьте, что SQL обновления выполнен."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="font-app fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[4px]"
      />
      <div className="modern-modal animate-scale-in relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] shadow-2xl sm:max-h-[88vh] sm:rounded-[32px]">
        <div className="relative shrink-0 border-b border-black/6 px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
          <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/35">Создание</p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-2xl", isChannel ? "bg-accent/12 text-accent" : "bg-ink text-white")}>
                  {isChannel ? <Megaphone className="h-4.5 w-4.5" strokeWidth={2} /> : <Users className="h-4.5 w-4.5" strokeWidth={2} />}
                </span>
                {isChannel ? "Новый канал" : "Новая группа"}
              </h3>
              <p className="mt-1 text-[12px] font-medium text-black/45">
                {isChannel ? "Публикуйте новости и обновления для подписчиков." : "Соберите людей в одном общем чате."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/8 bg-white/70 text-black/45 transition hover:bg-black/5 hover:text-ink"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {/* Обложка и название */}
          <div className="rounded-[24px] border border-black/8 bg-white/70 p-4">
            <div className="flex items-center gap-4">
              <div className="group relative shrink-0">
                <Avatar
                  name={title || (isChannel ? "Канал" : "Группа")}
                  avatarUrl={avatarPreview}
                  seed={title || "group"}
                  group={!isChannel && !avatarPreview}
                  channel={isChannel}
                  size="lg"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-ink/55 opacity-0 transition group-hover:opacity-100"
                  aria-label="Загрузить обложку"
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setAvatarFile(f);
                      setAvatarPreview(URL.createObjectURL(f));
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.14em] text-black/45 uppercase">Название</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isChannel ? "Название канала" : "Название группы"}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[15px] font-semibold outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="block font-mono text-[11px] font-semibold tracking-[0.14em] text-black/45 uppercase">Описание</span>
                <span className="font-mono text-[10px] text-black/35">{description.length}/160</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 160))}
                rows={3}
                placeholder={isChannel ? "О чём этот канал" : "О чём эта группа"}
                className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </div>
          </div>

          {/* Участники / подписчики */}
          <div className="mt-4 rounded-[24px] border border-black/8 bg-white/70 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="block font-mono text-[11px] font-semibold tracking-[0.14em] text-black/45 uppercase">
                {isChannel ? "Подписчики" : "Участники"}
              </span>
              {picked.length > 0 && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">Выбрано: {picked.length}</span>
              )}
            </div>

            {picked.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {picked.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggle(p)}
                    className="flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent-soft py-1 pr-2.5 pl-1 text-[13px] font-bold text-accent transition hover:bg-accent/15"
                  >
                    <Avatar profile={p} size="sm" className="h-6 w-6 [&>div]:h-6 [&>div]:w-6" />
                    <span className="max-w-[120px] truncate">{p.nickname}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-black/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isChannel ? "Найти и добавить подписчиков" : "Найти и добавить участников"}
                className="w-full rounded-2xl border border-black/10 bg-white py-2.5 pr-4 pl-10 text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </div>

            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
              {searching ? (
                <div className="flex items-center gap-2 px-2 py-4 text-sm font-semibold text-black/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Поиск…
                </div>
              ) : query.trim().length >= 2 && results.length === 0 ? (
                <p className="px-2 py-4 text-sm font-medium text-black/40">Никого не нашли. Попробуйте другой запрос.</p>
              ) : query.trim().length < 2 ? (
                <p className="px-2 py-4 text-xs font-medium leading-relaxed text-black/40">
                  Введите минимум 2 символа, чтобы найти людей по имени или @username.
                </p>
              ) : (
                results.map((p) => {
                  const on = picked.some((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition",
                        on ? "border-accent/20 bg-accent-soft/40" : "border-transparent hover:border-black/8 hover:bg-white"
                      )}
                    >
                      <Avatar profile={p} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-1 text-sm font-bold">
                          <span className="truncate">{p.nickname}</span>
                          {isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}
                        </p>
                        <p className="truncate font-mono text-[11px] text-black/40">@{p.username}</p>
                      </div>
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-lg border transition",
                          on ? "border-accent bg-accent text-white" : "border-black/15 bg-white text-transparent"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <div className="animate-fade-in mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-600">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-black/8 bg-gradient-to-t from-black/[0.02] to-transparent px-5 py-4 sm:px-7">
          <button
            onClick={create}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[15px] font-bold text-white shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 hover:bg-black active:scale-[0.99] disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : isChannel ? "Создать канал" : "Создать группу"}
          </button>
        </div>
      </div>
    </div>
  );
}
