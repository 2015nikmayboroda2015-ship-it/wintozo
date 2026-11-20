import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, MessageCircle, MessagesSquare, Mic, Pencil, Plus, Search, Settings, ShieldCheck, Star, Terminal, UserRound, UsersRound, X } from "lucide-react";
import {
  chatSeed,
  isVerified,
  supabase,
  type ChatItem,
  type Profile,
  type VerifyLevel,
} from "../../../../lib/supabase";
import { formatTime } from "../../../../lib/utils";
import { hasWinPro } from "../../../../lib/winpro";
import Avatar from "../../../Avatar";
import Crown from "../../../Crown";
import Verified from "../../../Verified";
import { getChatThemeColors } from "../../../../lib/themes";
import { cn } from "../../../../utils/cn";

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
  youMode?: boolean;
  onExitYou?: () => void;
  /** Пасхалка: клик по логотипу. */
  onLogoTap: () => void;
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

const FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "direct", label: "Личные" },
  { id: "groups", label: "Группы" },
  { id: "channels", label: "Каналы" },
];

/** Иконки левого рейла на десктопе. */
const RAIL_ITEMS = [
  { id: "all" as ChatFilter, label: "Все чаты", Icon: MessagesSquare },
  { id: "direct" as ChatFilter, label: "Личные", Icon: UserRound },
  { id: "groups" as ChatFilter, label: "Группы", Icon: UsersRound },
  { id: "channels" as ChatFilter, label: "Каналы", Icon: Megaphone },
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
  onLogoTap,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const debounce = useRef<number | undefined>(undefined);
  const [colors, setColors] = useState<ChatThemeColors>(() => getChatThemeColors());

  useEffect(() => {
    if (!fabOpen && !composeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFabOpen(false);
      setComposeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fabOpen, composeOpen]);

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
    if (filter === "all") return true;
    if (filter === "direct") return !c.isGroup;
    if (filter === "groups") return c.isGroup && !c.isChannel;
    return c.isChannel;
  });

  function preview(chat: ChatItem): string {
    const m = chat.lastMessage;
    if (!m) return chat.isSaved ? "Личные заметки на этом устройстве" : chat.isChannel ? "Канал создан" : chat.isGroup ? "Группа создана" : "Начните диалог первым";
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
        "group relative flex w-full items-center gap-3.5 text-left transition",
        youMode
          ? cn("yc-row", activeChatId === chat.id && "is-active")
          : cn(
              "modern-chat-row rounded-[24px] border px-3.5 py-3.5 sm:px-3 sm:py-3",
              activeChatId === chat.id
                ? "is-active border-accent/20 bg-white shadow-[0_12px_30px_-20px_rgba(0,0,0,0.25)]"
                : "border-transparent bg-white/55 hover:border-black/8 hover:bg-white/90"
            )
      )}
      aria-current={activeChatId === chat.id ? "true" : undefined}
      style={
        youMode
          ? undefined
          : activeChatId === chat.id
            ? ({
                background: `linear-gradient(135deg, ${colors.activeBg}, rgba(255,255,255,0.98))`,
                borderColor: "color-mix(in srgb, var(--color-accent) 18%, rgba(0,0,0,0.08))",
              } as React.CSSProperties)
            : undefined
      }
    >
      {!youMode && activeChatId === chat.id && (
        <span className="absolute top-4 bottom-4 right-2 w-1.5 rounded-full bg-accent/80" aria-hidden />
      )}
      <Avatar
        name={chat.title}
        avatarUrl={chat.avatarUrl}
        seed={chatSeed(chat)}
        group={chat.isGroup}
        channel={chat.isChannel}
        online={chat.isGroup ? null : onlineIds.has(chat.other?.id ?? "")}
        className={cn(youMode ? "yc-avatar" : "rounded-[18px] shadow-sm ring-1 ring-black/5")}
      />
      <div className="min-w-0 flex-1 pr-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("flex min-w-0 items-center gap-1.5 text-[16px] font-extrabold tracking-tight sm:text-[15px]", youMode && "yc-row-title")}>
            {chat.isSaved && <Star className={cn("mr-0.5 h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5", youMode ? "text-[var(--you-primary)]" : "text-amber-500")} fill="currentColor" strokeWidth={1.8} />}
            {chat.isGroup && (chat.isChannel ? <Megaphone className="mr-0.5 h-4 w-4 shrink-0 text-accent/70 sm:h-3.5 sm:w-3.5" /> : <UsersRound className="mr-0.5 h-4 w-4 shrink-0 text-accent/70 sm:h-3.5 sm:w-3.5" />)}
            <span className="truncate" style={youMode ? undefined : { color: colors.title }}>{chat.title}</span>
            {chat.verified && <Verified size="xs" level="full" />}
            {!chat.isGroup && !chat.isSaved && isVerified(chat.other) && <Verified size="xs" level={badgeLevel(chat.other)} />}
          </p>
          {chat.lastMessage && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold", youMode ? "yc-row-time" : "bg-black/[0.05] text-black/45")}>
              {formatTime(chat.lastMessage.created_at)}
            </span>
          )}
        </div>
        <p className={cn("mt-1 flex items-center gap-1.5 truncate text-[14px] font-medium sm:text-[13px]", youMode ? "yc-row-preview" : "text-black/45")}>
          {chat.lastMessage?.audio_url && <Mic className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{preview(chat)}</span>
        </p>
      </div>
    </button>
  );

  if (youMode) {
    return (
      <aside className="modern-sidebar you-sidebar yc-sidebar flex h-full w-full flex-col md:border-r">
        <div className="yc-side-head">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={onLogoTap}
                className="yc-brand-logo relative flex h-11 w-11 items-center justify-center overflow-hidden font-extrabold"
                aria-label="WinChat"
              >
                <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
              </button>
              <div className="min-w-0">
                <p className="yc-brand-name text-[18px] leading-none font-extrabold tracking-tight">WinChat You</p>
              </div>
            </div>
            <div className="yc-side-actions flex items-center gap-1.5">
              {isAdmin && (
                <button onClick={onOpenAdmin} className="yc-icon-btn" aria-label="Админ-панель" title="Админ-панель">
                  <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
                </button>
              )}
              <button onClick={onCreateChannel} className="yc-icon-btn" aria-label="Создать канал" title="Создать канал">
                <Megaphone className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
              <button onClick={onCreateGroup} className="yc-icon-btn yc-icon-btn-primary" aria-label="Создать группу" title="Создать группу">
                <UsersRound className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="yc-side-title">
            <h1 className="yc-side-title-text">Чаты</h1>
            <span className="yc-side-count" title="Всего диалогов">{chats.length}</span>
          </div>
          <div className="relative mt-3">
            <span className="yc-search-orb" aria-hidden><Search className="h-4 w-4" /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти людей, чаты и группы" className="you-search yc-search w-full py-3 pr-10 pl-11 text-sm font-medium outline-none transition" />
            {query && (
              <button onClick={() => setQuery("")} className="yc-search-clear absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 transition" aria-label="Очистить поиск">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!searchMode && (
            <div className="yc-filters" role="tablist" aria-label="Фильтр чатов">
              {FILTERS.map((item) => (
                <button key={item.id} onClick={() => setFilter(item.id)} className={cn("yc-chip", filter === item.id && "is-active")} role="tab" aria-selected={filter === item.id}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="yc-list flex-1 overflow-y-auto">
          {searchMode ? (
            <div className="modern-fade-in">
              {filteredChats.length > 0 && (<><p className="yc-list-label px-2 pt-2 pb-1.5 text-[11px] font-bold">Чаты</p><div className="space-y-1.5">{filteredChats.map(chatRow)}</div></>)}
              <p className="yc-list-label px-2 pt-4 pb-1.5 text-[11px] font-bold">Люди</p>
              {searching ? <div className="flex items-center gap-2.5 px-3 py-4 text-sm font-semibold text-black/40"><Loader2 className="h-4 w-4 animate-spin" />Ищем по всей базе…</div>
              : results.length ? (
                <div className="space-y-1.5">
                  {results.map((p) => (
                    <div key={p.id} className="yc-search-row">
                      <button onClick={() => { onOpenChatWith(p); setQuery(""); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Avatar profile={p} online={onlineIds.has(p.id)} className="yc-avatar" />
                        <div className="min-w-0 flex-1">
                          <p className="yc-search-name flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight"><span className="truncate">{p.nickname}</span>{hasWinPro(p) && <Crown size="xs" />}{isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}</p>
                          <p className="yc-search-handle mt-0.5 truncate font-mono text-[12px] font-medium">@{p.username}</p>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="px-3 py-4 text-sm font-medium text-black/40">Никого не нашли по запросу «{query.trim()}»</p>}
            </div>
          ) : loading ? (
            <div className="space-y-2 px-1 pt-2">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="yc-skeleton-row flex animate-pulse items-center gap-3"><div className="yc-skeleton-avatar" /><div className="flex-1 space-y-2"><div className="yc-skeleton-line h-3 w-2/5 rounded-full" /><div className="yc-skeleton-line h-2.5 w-3/5 rounded-full" /></div></div>))}</div>
          ) : filteredChats.length ? (
            <div className="pt-1"><p className="yc-list-label">Недавние</p><div className="modern-fade-in space-y-1.5">{filteredChats.map(chatRow)}</div></div>
          ) : (
            <div className="modern-fade-in flex flex-col items-center px-6 pt-14 text-center">
              <div className="yc-empty-icon flex items-center justify-center"><MessageCircle className="h-8 w-8 opacity-90" strokeWidth={1.6} /></div>
              <p className="yc-empty-title mt-4 text-base font-extrabold">Пока пусто</p>
              <p className="yc-empty-sub mt-1 max-w-[240px] text-[13px] leading-relaxed font-medium">{filter === "channels" ? "Каналов пока нет — создайте первый" : filter === "groups" ? "Групп пока нет — соберите первую" : "Найдите человека через поиск или создайте группу"}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button onClick={onCreateGroup} className="yc-pill-primary modern-icon-btn flex items-center gap-2 text-sm font-bold"><UsersRound className="h-4 w-4" /> Создать группу</button>
                <button onClick={onCreateChannel} className="yc-pill modern-icon-btn flex items-center gap-2 text-sm font-bold"><Megaphone className="h-4 w-4 text-accent" /> Канал</button>
              </div>
            </div>
          )}
        </div>

        <div className="yc-side-foot">
          <button onClick={onOpenSettings} className="yc-profile">
            <Avatar profile={me} online size="sm" className="yc-avatar" />
            <div className="min-w-0 flex-1">
              <p className="yc-profile-name flex min-w-0 items-center gap-1 text-sm font-bold tracking-tight"><span className="truncate">{me.nickname}</span>{isVerified(me) && <Verified size="xs" level={badgeLevel(me)} />}</p>
              <p className="yc-profile-handle truncate font-mono text-[11px] font-medium">@{me.username}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl"><Settings className="yc-profile-gear h-4 w-4 transition-transform duration-300 group-hover:rotate-45" /></span>
          </button>
        </div>
        {isAdmin && (
          <div className="px-3 pb-3">
            <button onClick={onOpenTerminal} className="yc-admin-btn modern-icon-btn flex w-full items-center justify-center gap-2.5 text-sm font-bold"><Terminal className="h-4 w-4" /> Admin Terminal</button>
          </div>
        )}
      </aside>
    );
  }

  // Новый редизайн (не You): верх — бренд/профиль/поиск, центр — чаты, FAB — быстрое создание
  const openSaved = () => {
    const saved = chats.find((c) => c.isSaved);
    if (saved) onSelect(saved);
  };

  return (
    <aside
      className="modern-sidebar relative flex h-full w-full overflow-hidden border-black/8 bg-white md:border-r"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      {/* Левая колонка-рейл (только десктоп) */}
      <div className="modern-rail hidden w-[78px] shrink-0 flex-col items-center px-2 py-4 md:flex">
        <button
          onClick={onLogoTap}
          className="mb-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-[16px] bg-white shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
          aria-label="WinChat"
          title="WinChat"
        >
          <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
        </button>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          {RAIL_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn("modern-rail-btn", !searchMode && filter === id && "is-active")}
              aria-label={label}
              title={label}
              aria-pressed={filter === id}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </button>
          ))}
          <span className="my-1.5 h-px w-7 bg-black/8" aria-hidden />
          <button onClick={openSaved} className="modern-rail-btn" aria-label="Избранное" title="Избранное">
            <Star className="h-5 w-5" fill="currentColor" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {isAdmin && (
            <button onClick={onOpenAdmin} className="modern-rail-btn" aria-label="Админ-панель" title="Админ-панель">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
          {isAdmin && (
            <button onClick={onOpenTerminal} className="modern-rail-btn" aria-label="Admin Terminal" title="Admin Terminal">
              <Terminal className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
          <button onClick={onOpenSettings} className="modern-rail-btn" aria-label="Настройки" title="Настройки">
            <Settings className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            onClick={onOpenSettings}
            className="mt-1 rounded-full ring-2 ring-white transition hover:-translate-y-0.5 active:scale-95"
            aria-label="Профиль"
            title={me.nickname}
          >
            <Avatar profile={me} online size="sm" className="rounded-full" />
          </button>
        </div>
      </div>

      {/* Колонка со списком чатов */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Верхняя панель на телефоне */}
        <div className="relative z-10 px-3 pt-4 pb-3 sm:px-4 sm:pt-5 md:hidden">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onLogoTap}
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[18px] bg-white shadow-md ring-1 ring-black/5 transition active:scale-95"
            aria-label="WinChat"
          >
            <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-extrabold tracking-tight text-ink leading-none sm:text-[20px]">WinChat</p>
            <p className="mt-1 text-[11px] font-semibold text-black/40">{chats.length} диалогов</p>
          </div>
          {isAdmin && (
            <button
              onClick={onOpenTerminal}
              className="modern-icon-btn flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200/70 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-50"
              aria-label="Admin Terminal"
              title="Admin Terminal"
            >
              <Terminal className="h-4.5 w-4.5" />
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="modern-icon-btn flex h-10 w-10 items-center justify-center rounded-2xl border border-black/8 bg-white/80 text-black/55 hover:bg-white hover:text-ink"
            aria-label="Настройки"
            title="Настройки"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-black/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск чатов и людей"
            className="w-full rounded-[18px] border border-black/8 bg-white/90 py-3 pr-11 pl-11 text-[14px] font-semibold shadow-sm outline-none transition placeholder:text-black/35 focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10 sm:text-[15px]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl p-2 text-black/35 transition hover:bg-black/5 hover:text-ink"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!searchMode && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Фильтр чатов">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition active:scale-95",
                  filter === item.id
                    ? "bg-ink text-white shadow-md shadow-ink/15"
                    : "bg-white/75 text-black/55 ring-1 ring-black/6 hover:bg-white hover:text-ink"
                )}
                role="tab"
                aria-selected={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Шапка списка на десктопе */}
      <div className="hidden px-4 pt-5 pb-2 md:block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Чаты</h1>
            <p className="mt-0.5 text-[12px] font-semibold text-black/40">
              {chats.length} диалогов · {filteredChats.length} в списке
            </p>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setComposeOpen((v) => !v)}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25 transition hover:-translate-y-0.5 hover:brightness-105 active:scale-95",
                composeOpen && "rotate-45"
              )}
              aria-label={composeOpen ? "Закрыть меню" : "Создать"}
              title="Создать"
            >
              <Pencil className="h-5 w-5" strokeWidth={2.2} />
            </button>
            {composeOpen && (
              <>
                <button
                  aria-label="Закрыть меню"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setComposeOpen(false)}
                />
                <div className="absolute top-[calc(100%+0.5rem)] right-0 z-30 w-56 origin-top-right animate-scale-in rounded-[22px] border border-black/8 bg-white/97 p-2 shadow-[0_24px_60px_-20px_rgba(16,18,20,0.35)] backdrop-blur-xl">
                  <p className="px-3 pt-2 pb-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-black/35 uppercase">
                    Создать
                  </p>
                  <button
                    onClick={() => { setComposeOpen(false); onCreateGroup(); }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-bold text-ink transition hover:bg-black/[0.04] active:scale-[0.98]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white">
                      <UsersRound className="h-5 w-5" />
                    </span>
                    Новая группа
                  </button>
                  <button
                    onClick={() => { setComposeOpen(false); onCreateChannel(); }}
                    className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-bold text-ink transition hover:bg-black/[0.04] active:scale-[0.98]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                      <Megaphone className="h-5 w-5" />
                    </span>
                    Новый канал
                  </button>
                  <div className="my-1.5 h-px bg-black/6" />
                  <button
                    onClick={() => { setComposeOpen(false); openSaved(); }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold text-ink transition hover:bg-black/[0.04]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/12 text-amber-600">
                      <Star className="h-4.5 w-4.5" fill="currentColor" strokeWidth={1.8} />
                    </span>
                    Избранное
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-black/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск чатов и людей"
            className="w-full rounded-full border border-black/8 bg-white/90 py-2.5 pr-11 pl-11 text-[14px] font-semibold shadow-sm outline-none transition placeholder:text-black/35 focus:border-accent/40 focus:bg-white focus:ring-4 focus:ring-accent/10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-black/35 transition hover:bg-black/5 hover:text-ink"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto px-3 pb-28 sm:px-4 md:pb-3">
        {searchMode ? (
          <div className="modern-fade-in">
            {filteredChats.length > 0 && (
              <>
                <p className="px-2 pt-1 pb-1.5 font-mono text-[11px] font-bold tracking-[0.14em] text-black/40 uppercase">Чаты</p>
                <div className="space-y-2">{filteredChats.map(chatRow)}</div>
              </>
            )}
            <p className="px-2 pt-4 pb-1.5 font-mono text-[11px] font-bold tracking-[0.14em] text-black/40 uppercase">Люди</p>
            {searching ? (
              <div className="flex items-center gap-2.5 px-3 py-5 text-sm font-semibold text-black/40"><Loader2 className="h-5 w-5 animate-spin" />Ищем по всей базе…</div>
            ) : results.length ? (
              <div className="space-y-2">
                {results.map((p) => (
                  <div key={p.id} className="modern-chat-row flex items-center gap-3 rounded-[22px] border border-transparent bg-white/60 px-3 py-3 hover:border-black/8 hover:bg-white/95">
                    <button onClick={() => { onOpenChatWith(p); setQuery(""); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Avatar profile={p} online={onlineIds.has(p.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-1 text-[15px] font-bold tracking-tight"><span className="truncate" style={{ color: colors.title }}>{p.nickname}</span>{hasWinPro(p) && <Crown size="xs" />}{isVerified(p) && <Verified size="xs" level={badgeLevel(p)} />}</p>
                        <p className="mt-0.5 truncate font-mono text-[12px] font-medium text-black/40">@{p.username}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-white/50 px-4 py-6 text-center">
                <p className="text-sm font-bold text-ink">Ничего не найдено</p>
                <p className="mt-1 text-xs font-medium text-black/45">По запросу «{query.trim()}» никого нет. Проверьте написание.</p>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-2 px-1 pt-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-[22px] bg-white/55 px-3 py-3.5">
                <div className="h-12 w-12 rounded-2xl bg-black/8" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-3 w-2/5 rounded-full bg-black/8" />
                  <div className="h-2.5 w-3/5 rounded-full bg-black/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length ? (
          <div className="pt-1">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-black/40 uppercase">Недавние</p>
              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] font-bold text-black/40">{filteredChats.length}</span>
            </div>
            <div className="modern-fade-in space-y-2">{filteredChats.map(chatRow)}</div>
          </div>
        ) : (
          <div className="modern-fade-in flex flex-col items-center px-5 pt-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-accent-soft to-white shadow-sm ring-1 ring-black/5">
              <MessageCircle className="h-9 w-9 text-accent/70" strokeWidth={1.6} />
            </div>
            <p className="mt-4 text-lg font-extrabold text-ink">Пока пусто</p>
            <p className="mt-1 max-w-[250px] text-[13px] leading-relaxed font-medium text-black/45">
              {filter === "channels"
                ? "Каналов пока нет. Создайте первый через кнопку ниже."
                : filter === "groups"
                  ? "Групп пока нет. Соберите первую команду."
                  : "Найдите человека через поиск сверху или создайте новый чат."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button onClick={onCreateGroup} className="modern-icon-btn rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-ink/15">Новая группа</button>
              <button onClick={onCreateChannel} className="modern-icon-btn rounded-2xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm font-bold text-ink">Канал</button>
            </div>
          </div>
        )}
      </div>

      {/* Профиль внизу списка (десктоп) */}
      <div className="hidden border-t border-black/6 px-3 py-3 md:block">
        <button
          onClick={onOpenSettings}
          className="modern-chat-row group flex w-full items-center gap-2.5 rounded-2xl border border-transparent bg-transparent px-2.5 py-2 text-left hover:border-black/6 hover:bg-black/[0.03]"
        >
          <Avatar profile={me} online size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-[14px] font-extrabold tracking-tight">
              <span className="truncate" style={{ color: colors.title }}>{me.nickname}</span>
              {isVerified(me) && <Verified size="xs" level={badgeLevel(me)} />}
            </p>
            <p className="truncate font-mono text-[11px] font-medium text-black/40">@{me.username}</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-black/40 transition group-hover:text-ink">
            <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </button>
      </div>
      </div>

      {/* Нижняя панель профиля + FAB (телефон) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 md:hidden">
        <div className="pointer-events-auto rounded-[24px] border border-black/8 bg-white/80 p-2 shadow-[0_18px_45px_-24px_rgba(16,18,20,0.35)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="modern-chat-row group flex min-w-0 flex-1 items-center gap-2.5 rounded-[18px] border border-transparent bg-transparent px-2.5 py-2 text-left hover:border-black/6 hover:bg-white/70"
            >
              <Avatar profile={me} online size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1 text-[14px] font-extrabold tracking-tight"><span className="truncate" style={{ color: colors.title }}>{me.nickname}</span>{isVerified(me) && <Verified size="xs" level={badgeLevel(me)} />}</p>
                <p className="truncate font-mono text-[11px] font-medium text-black/40">@{me.username}</p>
              </div>
            </button>

            <div className="relative shrink-0">
              {fabOpen && (
                <>
                  <button aria-label="Закрыть меню" className="fixed inset-0 z-20 cursor-default" onClick={() => setFabOpen(false)} />
                  <div className="absolute right-0 bottom-[3.75rem] z-30 w-56 origin-bottom-right animate-scale-in rounded-[24px] border border-black/8 bg-white/96 p-2 shadow-[0_24px_60px_-20px_rgba(16,18,20,0.35)] backdrop-blur-xl">
                    <p className="px-3 pt-2 pb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">Быстрое действие</p>
                    <button
                      onClick={() => { setFabOpen(false); onCreateGroup(); }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-bold text-ink transition hover:bg-black/[0.04] active:scale-[0.98]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white"><UsersRound className="h-5 w-5" /></span>
                      Новая группа
                    </button>
                    <button
                      onClick={() => { setFabOpen(false); onCreateChannel(); }}
                      className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-bold text-ink transition hover:bg-black/[0.04] active:scale-[0.98]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/12 text-accent"><Megaphone className="h-5 w-5" /></span>
                      Новый канал
                    </button>
                    <div className="my-1.5 h-px bg-black/6" />
                    <button
                      onClick={() => { setFabOpen(false); openSaved(); }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold text-ink transition hover:bg-black/[0.04]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/12 text-amber-600"><Star className="h-4.5 w-4.5" fill="currentColor" strokeWidth={1.8} /></span>
                      Избранное
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { setFabOpen(false); onOpenAdmin(); }}
                        className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold text-ink transition hover:bg-black/[0.04]"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700"><ShieldCheck className="h-4.5 w-4.5" /></span>
                        Админ-панель
                      </button>
                    )}
                  </div>
                </>
              )}
              <button
                onClick={() => setFabOpen((v) => !v)}
                className={cn(
                  "relative z-30 flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-500 text-white shadow-[0_14px_28px_-12px_rgba(16,185,129,0.7)] transition hover:-translate-y-0.5 hover:bg-emerald-400 active:scale-95",
                  fabOpen && "rotate-45 bg-emerald-600 hover:bg-emerald-600"
                )}
                aria-label={fabOpen ? "Закрыть меню" : "Создать"}
                title="Создать"
              >
                <Plus className="h-6 w-6" strokeWidth={2.6} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
