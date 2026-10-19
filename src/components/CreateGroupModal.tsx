import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, Loader2, Search, Users, X } from "lucide-react";
import { isVerified, supabase, type Profile, type VerifyLevel } from "../lib/supabase";
import { blobPut } from "../lib/blobStorage";
import { uuid, validateBio, validateGroupTitle } from "../lib/utils";
import Avatar from "./Avatar";
import Verified from "./Verified";
import { cn } from "../utils/cn";

interface Props {
  me: Profile;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

export default function CreateGroupModal({ me, onClose, onCreated }: Props) {
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
    if (picked.length === 0) return setError("Добавьте хотя бы одного участника");

    setError(null);
    setBusy(true);
    try {
      const chatId = uuid();
      let avatar_url: string | null = null;

      if (avatarFile) {
        const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
        const path = `chat/${chatId}/cover.${ext}`;
        try {
          const publicUrl = await blobPut(path, avatarFile, avatarFile.type || "image/png");
          avatar_url = `${publicUrl}?t=${Date.now()}`;
        } catch {
          /* обложка не критична — группа создастся без неё */
        }
      }

      const { error: cErr } = await supabase.from("chats").insert({
        id: chatId,
        is_group: true,
        title: title.trim(),
        description: description.trim() || null,
        avatar_url,
        created_by: me.id,
      });
      if (cErr) throw cErr;

      await supabase.from("chat_members").insert({
        chat_id: chatId,
        user_id: me.id,
        role: "owner",
      });
      for (const p of picked) {
        await supabase.from("chat_members").insert({ chat_id: chatId, user_id: p.id });
      }

      // Уведомляем участников, чтобы группа появилась у них сразу
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
    } catch {
      setError("Не удалось создать группу. Проверьте, что SQL обновления выполнен.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="font-app fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <div className="animate-scale-in relative flex max-h-[88vh] w-full max-w-md flex-col rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 sm:px-7">
          <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <Users className="h-5 w-5" strokeWidth={2} />
            Новая группа
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7">
          {/* Обложка и название */}
          <div className="flex items-center gap-4">
            <div className="group relative">
              <Avatar
                name={title || "Группа"}
                avatarUrl={avatarPreview}
                seed={title || "group"}
                group={!title}
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название группы"
              className="w-full rounded-xl border border-black/10 bg-paper px-4 py-3 text-[15px] font-semibold outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
              Описание
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 160))}
              rows={2}
              placeholder="О чём эта группа"
              className="w-full resize-none rounded-xl border border-black/10 bg-paper px-4 py-3 text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <p className="mt-1 text-right font-mono text-[10px] text-black/35">
              {description.length}/160
            </p>
          </div>

          {/* Выбранные */}
          {picked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {picked.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p)}
                  className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pr-2 pl-1 text-[13px] font-bold text-accent transition hover:bg-accent/20"
                >
                  <Avatar profile={p} size="sm" className="h-6 w-6 [&>div]:h-6 [&>div]:w-6" />
                  {p.nickname}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}

          {/* Поиск участников */}
          <div className="relative mt-4">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Добавить участников"
              className="w-full rounded-xl border border-black/10 bg-paper py-2.5 pr-4 pl-10 text-sm font-medium outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
            />
          </div>

          <div className="mt-2 space-y-0.5">
            {searching ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm font-semibold text-black/40">
                <Loader2 className="h-4 w-4 animate-spin" />
                Поиск…
              </div>
            ) : (
              results.map((p) => {
                const on = picked.some((x) => x.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-paper"
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
                        "flex h-5 w-5 items-center justify-center rounded-md border transition",
                        on ? "border-accent bg-accent text-white" : "border-black/20"
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <div className="animate-fade-in mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-600">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="border-t border-black/8 px-6 py-4 sm:px-7">
          <button
            onClick={create}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 text-[15px] font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Создать группу"}
          </button>
        </div>
      </div>
    </div>
  );
}
