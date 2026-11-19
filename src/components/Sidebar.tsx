import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, MessageCircle, Mic, Search, Settings, ShieldCheck, Star, Terminal, UsersRound, X } from "lucide-react";
import {
  chatSeed,
  isVerified,
  supabase,
  type ChatItem,
  type Profile,
  type VerifyLevel,
} from "../lib/supabase";
import { formatTime } from "../lib/utils";
import { hasWinPro } from "../lib/winpro";
import Avatar from "./Avatar";
import Crown from "./Crown";
import Verified from "./Verified";
import { getChatThemeColors } from "../lib/themes";
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
  onCreateChannel: () => void;
  onOpenAdmin: () => void;
  onOpenTerminal: () => void;
  isAdmin: boolean;
  /** Режим WinChat You (Material You). */
  youMode?: boolean;
  /** Выйти из WinChat You. */
  onExitYou?: () => void;
}

type ChatThemeColors = {
  accent: string;
  accentSoft: string;
  chatBg: string;
  headerBg: string;
  border: string;
  title: string;
  subtitle: string;
  activeBg: string;
};

type ChatFilter = "all" | "direct" | "groups" | "channels";

const YOU_FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "direct", label: "Личные" },
  { id: "groups", label: "Группы" },
  { id: "channels", label: "Каналы" },
];

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
  onCreateChannel,
  onOpenAdmin,
  onOpenTerminal,
  isAdmin,
  youMode = false,
  onExitYou: _onExitYou,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | undefined>(undefined);
  /* Цвета строк под тему (не Material You). */
  const [colors, setColors] = useState<ChatThemeColors>(() => getChatThemeColors());

  useEffect(() => {
    const sync = () => setColors(getChatThemeColors());
    window.addEventListener("winchat-theme-change", sync);
    return () => window.removeEventListener("winchat-theme-change", sync);
  }, []);

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
  const filteredChats = (searchMode
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.other?.username.toLowerCase().includes(q) ?? false)
      )
    : chats
  ).filter((c) => {
    if (!youMode || filter === "all") return true;
    if (filter === "direct") return !c.isGroup;
    if (filter === "groups") return c.isGroup && !c.isChannel;
    return c.isChannel;
  });

  function preview(chat: ChatItem): string {
    const m = chat.lastMessage;
    if (!m) return chat.isSaved ? "Личные заметки — хранятся на этом устройстве" : chat.isChannel ? "Канал создан" : chat.isGroup ? "Группа создана" : "Начните диалог первым";
    let who = "";
    if (m.sender_id === me.id) who = "Вы: ";
    else if (chat.isGroup) {
      const sender = chat.members.find((p) => p.id === m.sender_id);
      if (sender) who = `${sender.nickname}: `;
    }
    if (m.audio_url) return `${who}Голосовое сообщение`;
    if (m.video_url) return `${who}Видео`;
    if (m.sticker_url) return `${who}Стикер`;
    if (m.image_url) return who + (m.content ? `Фото — ${m.content}` : "Фотография");
    return who + (m.content || "");
  }

  const chatRow = (chat: ChatItem) => (
    <button
      key={chat.id}
      onClick={() => onSelect(chat)}
      className={cn(
        "flex w-full items-center gap-3 text-left transition",
        youMode
          ? cn("yc-row", activeChatId === chat.id && "is-active")
          : cn(
              "rounded-2xl px-3 py-3",
              activeChatId === chat.id ? "shadow-sm ring-1" : "hover:bg-paper/60"
            )
      )}
      aria-current={activeChatId === chat.id ? "true" : undefined}
      style={
        youMode
          ? undefined
          : activeChatId === chat.id
            ? ({
                background: colors.activeBg,
                "--tw-ring-color": colors.border,
              } as React.CSSProperties)
            : undefined
      }
    >
      <Avatar
        name={chat.title}
        avatarUrl={chat.avatarUrl}
        seed={chatSeed(chat)}
        group={chat.isGroup}
        channel={chat.isChannel}
        online={chat.isGroup ? null : onlineIds.has(chat.other?.id ?? "")}
        className={youMode ? "yc-avatar" : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight",
              youMode && "yc-row-title"
            )}
          >
            {chat.isSaved && (
              <Star
                className={cn(
                  "mr-0.5 h-3.5 w-3.5 shrink-0",
                  youMode ? "text-[var(--you-primary)]" : "text-amber-500"
                )}
                fill="currentColor"
                strokeWidth={1.8}
              />
            )}
            {chat.isGroup && (
              chat.isChannel ? (
                <Megaphone
                  className="mr-0.5 h-3.5 w-3.5 shrink-0"
                  style={youMode ? undefined : { color: colors.subtitle }}
                />
              ) : (
                <UsersRound
                  className="mr-0.5 h-3.5 w-3.5 shrink-0"
                  style={youMode ? undefined : { color: colors.subtitle }}
                />
              )
            )}
            <span className="truncate" style={youMode ? undefined : { color: colors.title }}>
              {chat.title}
            </span>
            {chat.verified && <Verified size="xs" level="full" />}
            {!chat.isGroup && !chat.isSaved && isVerified(chat.other) && (
              <Verified size="xs" level={badgeLevel(chat.other)} />
            )}
          </p>
          {chat.lastMessage && (
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] font-medium",
                youMode && "yc-row-time"
              )}
              style={youMode ? undefined : { color: colors.subtitle }}
            >
              {formatTime(chat.lastMessage.created_at)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 truncate text-[13px] font-medium",
            youMode && "yc-row-preview"
          )}
          style={youMode ? undefined : { color: colors.subtitle }}
        >
          {chat.lastMessage?.audio_url && <Mic className="h-3 w-3 shrink-0" />}
          <span className="truncate">{preview(chat)}</span>
        </p>
      </div>
    </button>
  );

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col md:border-r",
        youMode ? "you-sidebar yc-sidebar" : "border-black/8"
      )}
      style={youMode ? undefined : { background: colors.headerBg, borderColor: colors.border }}
    >
      {/* Шапка */}
      <div className={youMode ? "yc-side-head" : "px-5 pt-5 pb-4"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden font-extrabold",
                youMode ? "yc-brand-logo h-11 w-11" : "h-9 w-9 rounded-xl"
              )}
            >
              <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[18px] leading-none font-extrabold tracking-tight",
                  youMode && "yc-brand-name"
                )}
              >
                {youMode ? "WinChat You" : "WinChat"}
              </p>
            </div>
          </div>
          <div className={youMode ? "yc-side-actions" : "flex items-center gap-1.5"}>
            {!youMode && (
              <button
                onClick={() => {
                  const saved = chats.find((c) => c.isSaved);
                  if (saved) onSelect(saved);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-600 transition hover:bg-amber-400/25 active:scale-95"
                aria-label="Избранное"
                title="Избранное"
              >
                <Star className="h-4.5 w-4.5" fill="currentColor" strokeWidth={1.8} />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className={cn(
                  youMode
                    ? "yc-icon-btn"
                    : "flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500 text-white transition hover:bg-purple-600 active:scale-95"
                )}
                aria-label="Админ-панель"
                title="Админ-панель"
              >
                <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
            )}
            <button
              onClick={onCreateChannel}
              className={cn(
                youMode
                  ? "yc-icon-btn"
                  : "flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent/90 active:scale-95"
              )}
              aria-label="Создать канал"
              title="Создать канал"
            >
              <Megaphone className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
            <button
              onClick={onCreateGroup}
              className={cn(
                youMode
                  ? "yc-icon-btn yc-icon-btn-primary"
                  : "flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white transition hover:bg-black active:scale-95"
              )}
              aria-label="Создать группу"
              title="Создать группу"
            >
              <UsersRound className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {youMode && (
          <div className="yc-side-title">
            <h1 className="yc-side-title-text">Чаты</h1>
            <span className="yc-side-count" title="Всего диалогов">
              {chats.length}
            </span>
          </div>
        )}

        <div className="relative mt-4">
          {youMode ? (
            <span className="yc-search-orb" aria-hidden>
              <Search className="h-4 w-4" />
            </span>
          ) : (
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-black/35" />
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти людей, чаты и группы"
            className={cn(
              "w-full text-sm font-medium outline-none transition",
              youMode
                ? "you-search yc-search py-3 pr-10 pl-11"
                : "rounded-xl border border-black/10 bg-paper py-2.5 pr-9 pl-10 placeholder:text-black/35 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
            )}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className={cn(
                "absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 transition",
                youMode
                  ? "yc-search-clear"
                  : "text-black/35 hover:bg-black/5 hover:text-ink"
              )}
              aria-label="Очистить поиск"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {youMode && !searchMode && (
          <div className="yc-filters" role="tablist" aria-label="Фильтр чатов">
            {YOU_FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={cn("yc-chip", filter === item.id && "is-active")}
                role="tab"
                aria-selected={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Список */}
      <div className={cn("flex-1 overflow-y-auto", youMode ? "yc-list" : "px-3 pb-3")}>
        {searchMode ? (
          <div className="animate-fade-in">
            {filteredChats.length > 0 && (
              <>
                <p
                  className={cn(
                    "px-3 pt-2 pb-1.5 text-[11px] font-bold",
                    youMode ? "yc-list-label" : "font-mono tracking-[0.16em] uppercase"
                  )}
                  style={youMode ? undefined : { color: colors.subtitle }}
                >
                  Чаты
                </p>
                <div className="space-y-0.5">{filteredChats.map(chatRow)}</div>
              </>
            )}
            <p
              className={cn(
                "px-3 pt-4 pb-1.5 text-[11px] font-bold",
                youMode ? "yc-list-label" : "font-mono tracking-[0.16em] uppercase"
              )}
              style={youMode ? undefined : { color: colors.subtitle }}
            >
              Люди
            </p>
            {searching ? (
              <div
                className={cn(
                  "flex items-center gap-2.5 px-3 py-4 text-sm font-semibold",
                  youMode ? "text-[var(--you-on-surface-variant)]" : "text-black/40"
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Ищем по всей базе…
              </div>
            ) : results.length ? (
              <div className="space-y-0.5">
                {results.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      youMode
                        ? "yc-search-row"
                        : "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-paper/70"
                    )}
                  >
                    <button
                      onClick={() => {
                        onOpenChatWith(p);
                        setQuery("");
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar profile={p} online={onlineIds.has(p.id)} className={youMode ? "yc-avatar" : undefined} />
                      <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight",
                              youMode && "yc-search-name"
                            )}
                          >
                            <span className="truncate" style={youMode ? undefined : { color: colors.title }}>
                              {p.nickname}
                            </span>
                            {hasWinPro(p) && <Crown size="xs" />}
                            {isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}
                          </p>
                        <p
                          className={cn(
                            "mt-0.5 truncate font-mono text-[12px] font-medium",
                            youMode && "yc-search-handle"
                          )}
                          style={youMode ? undefined : { color: colors.subtitle }}
                        >
                          @{p.username}
                        </p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className={cn(
                  "px-3 py-4 text-sm font-medium",
                  youMode ? "text-[var(--you-on-surface-variant)]" : "text-black/40"
                )}
              >
                Никого не нашли по запросу «{query.trim()}»
              </p>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-1 px-1 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex animate-pulse items-center gap-3",
                  youMode ? "yc-skeleton-row" : "rounded-2xl px-2 py-3"
                )}
              >
                <div className={youMode ? "yc-skeleton-avatar" : "h-11 w-11 rounded-2xl bg-black/8"} />
                <div className="flex-1 space-y-2">
                  <div className={youMode ? "yc-skeleton-line h-3 w-2/5" : "h-3 w-2/5 rounded-full bg-black/8"} />
                  <div className={youMode ? "yc-skeleton-line h-2.5 w-3/5" : "h-2.5 w-3/5 rounded-full bg-black/5"} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length ? (
          <div className="pt-1">
            {youMode && <p className="yc-list-label">Недавние</p>}
            <div className="space-y-0.5">{filteredChats.map(chatRow)}</div>
          </div>
        ) : (
          <div className="animate-fade-in flex flex-col items-center px-6 pt-16 text-center">
            <div
              className={cn(
                "flex items-center justify-center",
                youMode
                  ? "yc-empty-icon"
                  : "h-16 w-16 rounded-[22px] bg-paper ring-1 ring-black/8"
              )}
            >
              <MessageCircle
                className={cn("h-7 w-7", youMode ? "opacity-90" : "text-black/30")}
                strokeWidth={1.6}
              />
            </div>
            <p
              className={cn("mt-4 font-bold", youMode && "yc-empty-title")}
              style={youMode ? undefined : { color: colors.title }}
            >
              Пока пусто
            </p>
            <p
              className={cn(
                "mt-1 text-[13px] leading-relaxed font-medium",
                youMode ? "yc-empty-sub" : "text-black/45"
              )}
            >
              {filter === "channels"
                ? "Каналов пока нет — создайте первый"
                : filter === "groups"
                  ? "Групп пока нет — соберите первую"
                  : "Найдите человека через поиск или соберите группу"}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={onCreateGroup}
                className={cn(
                  "flex items-center gap-2 text-sm font-bold transition active:scale-95",
                  youMode
                    ? "yc-pill-primary"
                    : "rounded-xl bg-ink px-5 py-3 text-white hover:bg-black"
                )}
              >
                <UsersRound className="h-4 w-4" />
                Создать группу
              </button>
              <button
                onClick={onCreateChannel}
                className={cn(
                  "flex items-center gap-2 text-sm font-bold transition active:scale-95",
                  youMode
                    ? "yc-pill"
                    : "rounded-xl bg-accent px-5 py-3 text-white hover:bg-accent/90"
                )}
              >
                <Megaphone className="h-4 w-4" />
                Создать канал
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Профиль */}
      <div className={cn(youMode ? "yc-side-foot" : "border-t border-black/8 p-3")}>
        <button
          onClick={onOpenSettings}
          className={cn(
            youMode
              ? "yc-profile"
              : "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-paper"
          )}
        >
          <Avatar profile={me} online size="sm" className={youMode ? "yc-avatar" : undefined} />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "flex min-w-0 items-center gap-1 text-sm font-bold tracking-tight",
                youMode && "yc-profile-name"
              )}
            >
              <span className="truncate" style={youMode ? undefined : { color: colors.title }}>
                {me.nickname}
              </span>
              {isVerified(me) && <Verified size="xs" level={badgeLevel(me)} />}
            </p>
            <p
              className={cn(
                "truncate font-mono text-[11px] font-medium",
                youMode && "yc-profile-handle"
              )}
              style={youMode ? undefined : { color: colors.subtitle }}
            >
              @{me.username}
            </p>
          </div>
          <Settings
            className={cn(
              "h-4 w-4 transition-all duration-300 group-hover:rotate-45",
              youMode
                ? "yc-profile-gear"
                : "text-black/30 group-hover:text-ink"
            )}
          />
        </button>
      </div>

      {/* Кнопки админа — терминал */}
      {isAdmin && (
        <div className={cn(youMode ? "px-3 pb-3" : "border-t border-black/8 p-3")}>
          <button
            onClick={onOpenTerminal}
            className={cn(
              "flex w-full items-center justify-center gap-2.5 text-sm font-bold transition active:scale-[0.99]",
              youMode
                ? "yc-admin-btn"
                : "rounded-2xl bg-emerald-600/90 px-3 py-2.5 text-white hover:bg-emerald-600"
            )}
          >
            <Terminal className="h-4 w-4" />
            Admin Terminal
          </button>
        </div>
      )}
    </aside>
  );
}
