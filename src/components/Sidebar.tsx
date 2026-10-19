import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, MessageCircle, Mic, Search, Settings, ShieldCheck, Terminal, UsersRound, X } from "lucide-react";
import {
  chatSeed,
  isVerified,
  supabase,
  type ChatItem,
  type Profile,
  type VerifyLevel,
} from "../lib/supabase";
import { formatTime } from "../lib/utils";
import Avatar from "./Avatar";
import Verified from "./Verified";
import { cn } from "../utils/cn";

interface Props {
  me: Profile;
  chats: ChatItem[];
  loading: boolean;
  activeChatId: string | null;
  onlineIds: Set<string>;
  onSelect: (chat: ChatItem) => void;
  onOpenChatWith: (p: Profile) => void;
  onOpenSettings: () => void;
  onCreateGroup: () => void;
  onOpenAdmin: () => void;
  onOpenTerminal: () => void;
  isAdmin: boolean;
}

export default function Sidebar({
  me,
  chats,
  loading,
  activeChatId,
  onlineIds,
  onSelect,
  onOpenChatWith,
  onOpenSettings,
  onCreateGroup,
  onOpenAdmin,
  onOpenTerminal,
  isAdmin,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
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

  const q = query.trim().toLowerCase();
  const searchMode = q.length >= 2;

  /** Получить уровень галочки для профиля */
  const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
    const lvl = p?.verify_status || "user";
    if (!["grey", "green", "full"].includes(lvl)) return "full";
    return lvl as Exclude<VerifyLevel, "user">;
  };
  const filteredChats = searchMode
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.other?.username.toLowerCase().includes(q) ?? false)
      )
    : chats;

  function preview(chat: ChatItem): string {
    const m = chat.lastMessage;
    if (!m) return chat.isGroup ? "Группа создана" : "Начните диалог первым";
    let who = "";
    if (m.sender_id === me.id) who = "Вы: ";
    else if (chat.isGroup) {
      const sender = chat.members.find((p) => p.id === m.sender_id);
      if (sender) who = `${sender.nickname}: `;
    }
    if (m.audio_url) return `${who}Голосовое сообщение`;
    if (m.image_url) return who + (m.content ? `Фото — ${m.content}` : "Фотография");
    return who + (m.content || "");
  }

  const chatRow = (chat: ChatItem) => (
    <button
      key={chat.id}
      onClick={() => onSelect(chat)}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
        activeChatId === chat.id ? "bg-paper shadow-sm ring-1 ring-black/5" : "hover:bg-paper/70"
      )}
    >
      <Avatar
        name={chat.title}
        avatarUrl={chat.avatarUrl}
        seed={chatSeed(chat)}
        group={chat.isGroup}
        online={chat.isGroup ? null : onlineIds.has(chat.other?.id ?? "")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight">
            {chat.isGroup && <UsersRound className="mr-0.5 h-3.5 w-3.5 shrink-0 text-black/40" />}
            <span className="truncate">{chat.title}</span>
            {!chat.isGroup && isVerified(chat.other) && (
              <Verified size="xs" level={badgeLevel(chat.other)} />
            )}
          </p>
          {chat.lastMessage && (
            <span className="shrink-0 font-mono text-[10px] font-medium text-black/35">
              {formatTime(chat.lastMessage.created_at)}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] font-medium text-black/45">
          {chat.lastMessage?.audio_url && <Mic className="h-3 w-3 shrink-0" />}
          <span className="truncate">{preview(chat)}</span>
        </p>
      </div>
    </button>
  );

  return (
    <aside className="flex h-full w-full flex-col border-black/8 bg-white md:border-r">
      {/* Шапка */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink font-extrabold text-white">
              W
            </div>
            <p className="text-[17px] font-extrabold tracking-tight">WinChat</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500 text-white transition hover:bg-purple-600 active:scale-95"
                aria-label="Админ-панель"
                title="Админ-панель"
              >
                <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
            )}
            <button
              onClick={onCreateGroup}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white transition hover:bg-black active:scale-95"
              aria-label="Создать группу"
              title="Создать группу"
            >
              <UsersRound className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти людей, чаты и группы"
            className="w-full rounded-xl border border-black/10 bg-paper py-2.5 pr-9 pl-10 text-sm font-medium outline-none transition placeholder:text-black/35 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-black/35 transition hover:bg-black/5 hover:text-ink"
              aria-label="Очистить поиск"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {searchMode ? (
          <div className="animate-fade-in">
            {filteredChats.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1.5 font-mono text-[10px] font-bold tracking-[0.16em] text-black/35 uppercase">
                  Чаты
                </p>
                <div className="space-y-0.5">{filteredChats.map(chatRow)}</div>
              </>
            )}
            <p className="px-3 pt-4 pb-1.5 font-mono text-[10px] font-bold tracking-[0.16em] text-black/35 uppercase">
              Люди
            </p>
            {searching ? (
              <div className="flex items-center gap-2.5 px-3 py-4 text-sm font-semibold text-black/40">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ищем по всей базе…
              </div>
            ) : results.length ? (
              <div className="space-y-0.5">
                {results.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-paper/70"
                  >
                    <button
                      onClick={() => {
                        onOpenChatWith(p);
                        setQuery("");
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar profile={p} online={onlineIds.has(p.id)} />
                      <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight">
                            <span className="truncate">{p.nickname}</span>
                            {isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}
                          </p>
                        <p className="mt-0.5 truncate font-mono text-[12px] font-medium text-black/45">
                          @{p.username}
                        </p>
                      </div>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAdmin();
                          // Передаём ID пользователя через event
                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent("winchat:admin-select-user", {
                                detail: p.id,
                              })
                            );
                          }, 100);
                        }}
                        className="shrink-0 rounded-full bg-purple-500/10 p-1.5 text-purple-600 transition hover:bg-purple-500/20"
                        title="Зайти на аккаунт"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-3 py-4 text-sm font-medium text-black/40">
                Никого не нашли по запросу «{query.trim()}»
              </p>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-1 px-1 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl px-2 py-3">
                <div className="h-11 w-11 rounded-2xl bg-black/8" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 rounded-full bg-black/8" />
                  <div className="h-2.5 w-3/5 rounded-full bg-black/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length ? (
          <div className="space-y-0.5 pt-1">{filteredChats.map(chatRow)}</div>
        ) : (
          <div className="animate-fade-in flex flex-col items-center px-6 pt-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-paper ring-1 ring-black/8">
              <MessageCircle className="h-7 w-7 text-black/30" strokeWidth={1.6} />
            </div>
            <p className="mt-4 font-bold">Пока пусто</p>
            <p className="mt-1 text-[13px] leading-relaxed font-medium text-black/45">
              Найдите человека через поиск или соберите группу
            </p>
            <button
              onClick={onCreateGroup}
              className="mt-4 flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black active:scale-95"
            >
              <UsersRound className="h-4 w-4" />
              Создать группу
            </button>
          </div>
        )}
      </div>

      {/* Профиль */}
      <div className="border-t border-black/8 p-3">
        <button
          onClick={onOpenSettings}
          className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-paper"
        >
          <Avatar profile={me} online size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-sm font-bold tracking-tight">
              <span className="truncate">{me.nickname}</span>
              {isVerified(me) && <Verified size="xs" level={badgeLevel(me)} />}
            </p>
            <p className="truncate font-mono text-[11px] font-medium text-black/40">
              @{me.username}
            </p>
          </div>
          <Settings className="h-4 w-4 text-black/30 transition-all duration-300 group-hover:rotate-45 group-hover:text-ink" />
        </button>
      </div>

      {/* Кнопки админа — терминал + войти на аккаунт */}
      {isAdmin && (
        <div className="border-t border-black/8 p-3 space-y-2">
          <button
            onClick={onOpenTerminal}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-emerald-600/90 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 active:scale-[0.99]"
          >
            <Terminal className="h-4 w-4" />
            Admin Terminal
          </button>
          <button
            onClick={onOpenAdmin}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-purple-500/8 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-purple-500 active:scale-[0.99]"
          >
            <Eye className="h-4 w-4" />
            Зайти на аккаунт
          </button>
        </div>
      )}
    </aside>
  );
}
