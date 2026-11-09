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
  const filteredChats = searchMode
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.other?.username.toLowerCase().includes(q) ?? false)
      )
    : chats;

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
    if (m.image_url) return who + (m.content ? `Фото — ${m.content}` : "Фотография");
    return who + (m.content || "");
  }

  const chatRow = (chat: ChatItem) => (
    <button
      key={chat.id}
      onClick={() => onSelect(chat)}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 text-left transition",
        youMode ? "rounded-[26px]" : "rounded-2xl",
        activeChatId === chat.id
          ? youMode
            ? "you-row-selected"
            : "shadow-sm ring-1"
          : youMode
            ? "you-row-hover"
            : "hover:bg-paper/60"
      )}
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
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight">
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
              className="shrink-0 font-mono text-[10px] font-medium"
              style={youMode ? undefined : { color: colors.subtitle }}
            >
              {formatTime(chat.lastMessage.created_at)}
            </span>
          )}
        </div>
        <p
          className="mt-0.5 flex items-center gap-1 truncate text-[13px] font-medium"
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
        youMode ? "you-sidebar" : "border-black/8"
      )}
      style={youMode ? undefined : { background: colors.headerBg, borderColor: colors.border }}
    >
      {/* Шапка */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden font-extrabold",
                youMode ? "you-logo h-10 w-10 rounded-[16px]" : "h-9 w-9 rounded-xl bg-ink"
              )}
            >
              {youMode ? (
                <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
              ) : (
                "W"
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[18px] leading-none font-extrabold tracking-tight">WinChat</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className={cn(
                  "flex h-9 w-9 items-center justify-center bg-purple-500 text-white transition hover:bg-purple-600 active:scale-95",
                  youMode ? "rounded-full" : "rounded-xl"
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
                "flex items-center justify-center text-white transition active:scale-95",
                youMode
                  ? "you-fab-tonal h-10 w-10"
                  : "h-9 w-9 rounded-xl bg-accent hover:bg-accent/90"
              )}
              aria-label="Создать канал"
              title="Создать канал"
            >
              <Megaphone className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
            <button
              onClick={onCreateGroup}
              className={cn(
                "flex items-center justify-center text-white transition active:scale-95",
                youMode
                  ? "you-fab h-10 w-10"
                  : "h-9 w-9 rounded-xl bg-ink hover:bg-black"
              )}
              aria-label="Создать группу"
              title="Создать группу"
            >
              <UsersRound className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="relative mt-4">
          <Search
            className={cn(
              "absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2",
              youMode ? "text-[var(--you-on-surface-variant)]" : "text-black/35"
            )}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти людей, чаты и группы"
            className={cn(
              "w-full text-sm font-medium outline-none transition",
              youMode
                ? "you-search py-3 pr-10 pl-11"
                : "rounded-xl border border-black/10 bg-paper py-2.5 pr-9 pl-10 placeholder:text-black/35 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
            )}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className={cn(
                "absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 transition",
                youMode
                  ? "text-[var(--you-on-surface-variant)] hover:bg-[var(--you-surface-high)] hover:text-[var(--you-on-surface)]"
                  : "text-black/35 hover:bg-black/5 hover:text-ink"
              )}
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
                <p
                  className={cn(
                    "px-3 pt-2 pb-1.5 text-[11px] font-bold",
                    youMode ? "text-[var(--you-on-surface-variant)]" : "font-mono tracking-[0.16em] uppercase"
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
                youMode ? "text-[var(--you-on-surface-variant)]" : "font-mono tracking-[0.16em] uppercase"
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
                      "flex items-center gap-3 px-3 py-2.5 transition",
                      youMode ? "you-row-hover rounded-[24px]" : "rounded-2xl hover:bg-paper/70"
                    )}
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
                            <span className="truncate" style={youMode ? undefined : { color: colors.title }}>
                              {p.nickname}
                            </span>
                            {hasWinPro(p) && <Crown size="xs" />}
                            {isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}
                          </p>
                        <p
                          className="mt-0.5 truncate font-mono text-[12px] font-medium"
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
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-[22px]",
                youMode
                  ? "bg-[var(--you-secondary-container)] text-[var(--you-on-secondary-container)]"
                  : "bg-paper ring-1 ring-black/8"
              )}
            >
              <MessageCircle
                className={cn("h-7 w-7", youMode ? "opacity-80" : "text-black/30")}
                strokeWidth={1.6}
              />
            </div>
            <p className="mt-4 font-bold" style={youMode ? undefined : { color: colors.title }}>
              Пока пусто
            </p>
            <p
              className={cn(
                "mt-1 text-[13px] leading-relaxed font-medium",
                youMode ? "text-[var(--you-on-surface-variant)]" : "text-black/45"
              )}
            >
              Найдите человека через поиск или соберите группу
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={onCreateGroup}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 text-sm font-bold transition active:scale-95",
                  youMode
                    ? "you-pill-primary"
                    : "rounded-xl bg-ink text-white hover:bg-black"
                )}
              >
                <UsersRound className="h-4 w-4" />
                Создать группу
              </button>
              <button
                onClick={onCreateChannel}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 text-sm font-bold transition active:scale-95",
                  youMode
                    ? "you-fab-tonal"
                    : "rounded-xl bg-accent text-white hover:bg-accent/90"
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
      <div
        className={cn(
          "border-t p-3",
          youMode ? "you-divider" : "border-black/8"
        )}
      >
        <button
          onClick={onOpenSettings}
          className={cn(
            "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
            youMode
              ? "you-row-hover rounded-[24px]"
              : "rounded-2xl hover:bg-paper"
          )}
        >
          <Avatar profile={me} online size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-sm font-bold tracking-tight">
              <span className="truncate" style={youMode ? undefined : { color: colors.title }}>
                {me.nickname}
              </span>
              {isVerified(me) && <Verified size="xs" level={badgeLevel(me)} />}
            </p>
            <p
              className="truncate font-mono text-[11px] font-medium"
              style={youMode ? undefined : { color: colors.subtitle }}
            >
              @{me.username}
            </p>
          </div>
          <Settings
            className={cn(
              "h-4 w-4 transition-all duration-300 group-hover:rotate-45",
              youMode
                ? "text-[var(--you-on-surface-variant)] group-hover:text-[var(--you-primary)]"
                : "text-black/30 group-hover:text-ink"
            )}
          />
        </button>
      </div>

      {/* Кнопки админа — терминал */}
      {isAdmin && (
        <div
          className={cn(
            "border-t p-3",
            youMode ? "you-divider" : "border-black/8"
          )}
        >
          <button
            onClick={onOpenTerminal}
            className={cn(
              "flex w-full items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-bold text-white transition active:scale-[0.99]",
              youMode
                ? "you-fab-tonal"
                : "rounded-2xl bg-emerald-600/90 hover:bg-emerald-600"
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
