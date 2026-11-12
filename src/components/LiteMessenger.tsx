/**
 * WinChat Lite — урезанный интерфейс для Android в браузере.
 *
 * Стиль — как у старого Wintozo (папка old/), но название WinChat.
 * Урезан максимально: только личные чаты и группы, текстовые сообщения.
 * Каналы не показываются. Никаких картинок и аватарок, новых чатов,
 * медиа-сообщения показываются текстовой плашкой («только в приложении»).
 * Сверху — неубираемая плашка «Установите приложение» со ссылкой из OTA.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { supabase, type Message, type Profile } from "../lib/supabase";
import { installOta, reportDeviceStatus, searchOta } from "../lib/ota";
import { APP_VERSION } from "../lib/checkVersion";
import { directKey, uuid } from "../lib/utils";
import "../lite.css";

/* ---------- Иконки (как в old/src/components/Icons.jsx) ---------- */

const iconBase = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const BackIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SendIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChatIcon = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const UsersIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SunIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SparkIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5" />
  </svg>
);

const UserIcon = ({ size = 21 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SearchIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconBase}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ---------- Темы (как в старом Wintozo) ---------- */

const LITE_THEMES = ["light", "dark", "midnight", "sunset"] as const;
type LiteTheme = (typeof LITE_THEMES)[number];
const THEME_ICON: Record<LiteTheme, (p: { size?: number }) => ReactElement> = {
  light: SunIcon,
  dark: MoonIcon,
  midnight: SparkIcon,
  sunset: SunIcon,
};

interface LiteMember {
  id: string;
  nickname: string;
  username: string;
}

interface LiteChat {
  id: string;
  isGroup: boolean;
  /** Заголовок строки: имя собеседника или название группы. */
  title: string;
  /** Для личных чатов — собеседник; для групп — null. */
  other: LiteMember | null;
  /** Участники (для групп и подписи авторов сообщений). */
  members: LiteMember[];
  last: Message | null;
  updatedAt: string;
}

function fmtTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Палитра буквенного аватара (без картинок). */
const AVATAR_COLORS = [
  "linear-gradient(135deg, #3b82f6, #8b5cf6)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #22c55e, #06b6d4)",
  "linear-gradient(135deg, #f97316, #ec4899)",
  "linear-gradient(135deg, #ec4899, #8b5cf6)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #0f172a, #475569)",
];

function avatarColor(chatId: string): string {
  let hash = 0;
  for (let i = 0; i < chatId.length; i++) hash = (hash * 31 + chatId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface Props {
  me: Profile;
  onLogout: () => void;
}

export default function LiteMessenger({ me, onLogout }: Props) {
  const [theme, setTheme] = useState<LiteTheme>(() => {
    try {
      const t = localStorage.getItem("winchat_lite_theme") as LiteTheme | null;
      return t && LITE_THEMES.includes(t) ? t : "light";
    } catch {
      return "light";
    }
  });
  const [chats, setChats] = useState<LiteChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<LiteChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [otaUrl, setOtaUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  /** Вкладка нижней навигации: список чатов или профиль. */
  const [tab, setTab] = useState<"chats" | "profile">("chats");
  /** Строка поиска по чатам (сам input неконтролируемый — гаджеты не конфликтуют). */
  const [query, setQuery] = useState("");
  /** Результаты глобального поиска пользователей. */
  const [searchResults, setSearchResults] = useState<LiteMember[]>([]);
  /** Статус поиска пользователей. */
  const [searching, setSearching] = useState(false);
  /** Debounce-таймер поиска. */
  const searchDebounce = useRef<number | undefined>(undefined);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const msgsRef = useRef<Message[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("winchat_lite_theme", theme);
    } catch {
      /* no-op */
    }
  }, [theme]);

  /* ---------- OTA: статус устройства + ссылка для плашки ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const device = await reportDeviceStatus(true);
      const ota = await searchOta(device.deviceId);
      if (alive && ota) setOtaUrl(ota.url);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- Загрузка чатов: личные + группы (без каналов) ---------- */
  const loadChats = useCallback(async () => {
    const { data: mine } = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", me.id);
    const ids = ((mine as { chat_id: string }[]) || []).map((r) => r.chat_id);
    if (!ids.length) {
      setChats([]);
      setLoading(false);
      return;
    }

    const [{ data: chatRows }, { data: memberRows }, { data: lastMsgs }] = await Promise.all([
      supabase
        .from("chats")
        .select("id, title, is_group, updated_at")
        .in("id", ids)
        .eq("is_channel", false),
      supabase
        .from("chat_members")
        .select("chat_id, user_id, profiles!inner(id, nickname, username)")
        .in("chat_id", ids),
      supabase
        .from("messages")
        .select("*")
        .in("chat_id", ids)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    type MemberRow = { chat_id: string; user_id: string; profiles: LiteMember | null };
    const membersByChat = new Map<string, LiteMember[]>();
    ((memberRows as unknown as MemberRow[]) || []).forEach((r) => {
      if (!r.profiles) return;
      const list = membersByChat.get(r.chat_id) || [];
      list.push(r.profiles);
      membersByChat.set(r.chat_id, list);
    });

    const lastByChat = new Map<string, Message>();
    ((lastMsgs as Message[]) || []).forEach((m) => {
      if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
    });

    type ChatRowLite = { id: string; title: string | null; is_group: boolean | null; updated_at: string | null };
    const list: LiteChat[] = ((chatRows as unknown as ChatRowLite[]) || [])
      .map((c) => {
        const members = membersByChat.get(c.id) || [];
        const other = c.is_group
          ? null
          : (members.find((p) => p.id !== me.id) ?? null);
        if (!c.is_group && !other) return null;
        return {
          id: c.id,
          isGroup: !!c.is_group,
          title: c.is_group ? c.title || "Группа" : other?.nickname || "Диалог",
          other,
          members,
          last: lastByChat.get(c.id) ?? null,
          updatedAt: lastByChat.get(c.id)?.created_at || c.updated_at || "",
        };
      })
      .filter((x): x is LiteChat => x !== null)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    setChats(list);
    setLoading(false);
  }, [me.id]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  /* Обновляем список при возврате во вкладку (добавили в группу и т.д.) */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadChats();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadChats]);

  const chatIdsKey = chats.map((c) => c.id).sort().join(",");

  /* ---------- realtime: список чатов ---------- */
  useEffect(() => {
    if (!chatIdsKey) return;
    const channel = supabase.channel(`lite-sidebar:${me.id}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=in.(${chatIdsKey})`,
        },
        (payload) => {
          const m = payload.new as Message;
          setChats((prev) => {
            const idx = prev.findIndex((c) => c.id === m.chat_id);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], last: m, updatedAt: m.created_at };
            return next.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
          });
        }
      )
      .on("broadcast", { event: "new_chat" }, () => void loadChats())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatIdsKey, me.id, loadChats]);

  /* ---------- открытие чата ---------- */
  const openChat = useCallback((chat: LiteChat) => {
    setActiveId(chat.id);
    setActiveChat(chat);
    setText("");
  }, []);

  const closeChat = useCallback(() => {
    setActiveId(null);
    setActiveChat(null);
    setMessages([]);
  }, []);

  /* ---------- загрузка сообщений активного чата + realtime ---------- */
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setMsgsLoading(true);

    supabase
      .from("messages")
      .select("*")
      .eq("chat_id", activeId)
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data as Message[]) || []);
        setMsgsLoading(false);
      });

    const channel = supabase.channel(`lite-chat:${activeId}`);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${activeId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setMessages((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  useEffect(() => {
    msgsRef.current = messages;
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [messages.length, msgsLoading]);

  /* ---------- отправка (только текст) ---------- */
  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ chat_id: activeId, sender_id: me.id, content })
        .select()
        .single();
      if (error) throw error;
      const m = data as Message;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText("");
    } catch {
      /* лайт-версия молчит */
    } finally {
      setSending(false);
    }
  }, [text, activeId, sending, me.id]);

  /* ---------- превью последнего сообщения ---------- */
  const previewOf = useCallback(
    (chat: LiteChat): string => {
      const m = chat.last;
      if (!m) return "Нет сообщений";
      let who = "";
      if (chat.isGroup) {
        if (m.sender_id === me.id) who = "Вы: ";
        else who = (chat.members.find((p) => p.id === m.sender_id)?.nickname || "") + ": ";
      }
      if (m.sticker_url) return `${who}🩷 Стикер`;
      if (m.image_url) return `${who}📷 Фото — только в приложении`;
      if (m.video_url) return `${who}🎬 Видео — только в приложении`;
      if (m.audio_url) return `${who}🎙️ Голосовое — только в приложении`;
      return who + (m.content || "Сообщение");
    },
    [me.id]
  );

  /* ---------- тема кнопка ---------- */
  const cycleTheme = () =>
    setTheme(LITE_THEMES[(LITE_THEMES.indexOf(theme) + 1) % LITE_THEMES.length]);
  const ThemeIcon = THEME_ICON[theme];

  /* ---------- глобальный поиск пользователей по username/нику (как в полной версии) ---------- */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(async () => {
      const pattern = `%${q.replace(/[%_]/g, "")}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, username")
        .neq("id", me.id)
        .or(`username.ilike.${pattern},nickname.ilike.${pattern}`)
        .limit(20);
      setSearchResults((data as LiteMember[]) || []);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(searchDebounce.current);
  }, [query, me.id]);

  /* ---------- открыть/создать личный диалог с найденным пользователем ---------- */
  const openChatWith = useCallback(
    async (other: LiteMember) => {
      const key = directKey(me.id, other.id);
      const { data: existing } = await supabase
        .from("chats")
        .select("id")
        .eq("direct_key", key)
        .maybeSingle();
      let chatId = (existing as { id: string } | null)?.id;

      if (!chatId) {
        const candidate = uuid();
        const { error: cErr } = await supabase
          .from("chats")
          .insert({ id: candidate, direct_key: key, is_group: false, created_by: me.id });
        if (cErr) {
          // Гонка: кто-то создал чат одновременно — берём его.
          const { data: again } = await supabase
            .from("chats")
            .select("id")
            .eq("direct_key", key)
            .maybeSingle();
          chatId = (again as { id: string } | null)?.id;
          if (!chatId) return;
        } else {
          await supabase.from("chat_members").insert({ chat_id: candidate, user_id: me.id });
          await supabase.from("chat_members").insert({ chat_id: candidate, user_id: other.id });
          // Пингуем собеседника, чтобы он обновил список чатов.
          const ping = supabase.channel(`user:${other.id}`);
          ping.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              ping.send({ type: "broadcast", event: "new_chat", payload: {} });
              window.setTimeout(() => supabase.removeChannel(ping), 600);
            }
          });
          chatId = candidate;
        }
      }

      setQuery("");
      if (searchRef.current) searchRef.current.value = "";
      await loadChats();
      const chat = chats.find((c) => c.id === chatId) ?? null;
      if (chat) openChat(chat);
    },
    [me.id, chats, loadChats, openChat]
  );

  /* ---------- поиск чатов (простая фильтрация без мемо-кэша) ---------- */
  const q = query.trim().toLowerCase();
  const shownChats = q
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.other?.username || "").toLowerCase().includes(q) ||
          c.members.some(
            (p) =>
              p.nickname.toLowerCase().includes(q) ||
              p.username.toLowerCase().includes(q)
          )
      )
    : chats;

  const goProfile = () => setTab("profile");
  const goChats = () => {
    setTab("chats");
    setQuery("");
    if (searchRef.current) searchRef.current.value = "";
  };

  /* ---------- нижняя навигация ---------- */
  const bottomNav = (
    <div className="lite-bottom-nav">
      <div
        className={`lite-nav-item ${tab === "chats" ? "lite-nav-item-active" : ""}`}
        onClick={goChats}
      >
        <ChatIcon size={20} />
        Чаты
      </div>
      <div
        className={`lite-nav-item ${tab === "profile" ? "lite-nav-item-active" : ""}`}
        onClick={goProfile}
      >
        <UserIcon size={20} />
        Ещё
      </div>
    </div>
  );

  /* ---------- неубираемая OTA-плашка ---------- */
  const otaBar = (
    <div className="lite-ota">
      <div className="lite-ota-icon">W</div>
      <div className="lite-ota-body">
        <div className="lite-ota-title">Установите приложение</div>
        <div className="lite-ota-sub">Полная версия WinChat — для Android</div>
      </div>
      <button
        className="lite-ota-btn"
        onClick={() => otaUrl && void installOta(otaUrl)}
        disabled={!otaUrl}
        title={otaUrl ? "Скачать APK" : "Ссылка пока недоступна"}
      >
        Установить
      </button>
    </div>
  );

  /* ==================== ПРОФИЛЬ (урезанный) ==================== */
  if (!activeChat && tab === "profile") {
    return (
      <div className="wclite" data-theme={theme}>
        {otaBar}
        <div className="lite-header">
          <span className="lite-logo">WinChat</span>
          <span className="lite-logo-badge">Lite</span>
          <div style={{ flex: 1 }} />
          <button className="lite-icon-btn" onClick={cycleTheme} title="Сменить тему">
            <ThemeIcon size={17} />
          </button>
        </div>

        <div className="lite-profile">
          <div className="lite-profile-head">
            <div
              className="lite-avatar"
              style={{ width: 64, height: 64, fontSize: 26, background: avatarColor(me.id) }}
            >
              {(me.nickname || "?")[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="lite-profile-name">{me.nickname}</div>
              <div className="lite-profile-sub">@{me.username}</div>
            </div>
          </div>

          <div className="lite-card">
            <div className="lite-row">
              <span className="lite-row-label">Никнейм</span>
              <span className="lite-row-value">{me.nickname}</span>
            </div>
            <div className="lite-row">
              <span className="lite-row-label">Username</span>
              <span className="lite-row-value">@{me.username}</span>
            </div>
            <div className="lite-row">
              <span className="lite-row-label">Версия</span>
              <span className="lite-row-value">WinChat {APP_VERSION} Lite</span>
            </div>
          </div>

          <div className="lite-hint">
            Это урезанная веб-версия для Android: профиль, аватарки, фото,
            видео и голосовые — только в приложении. Установите его по кнопке
            сверху.
          </div>

          <button className="lite-exit-btn" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </div>

        {bottomNav}
      </div>
    );
  }

  /* ==================== СПИСОК ЧАТОВ ==================== */
  if (!activeChat) {
    return (
      <div className="wclite" data-theme={theme}>
        {otaBar}
        <div className="lite-header">
          <span className="lite-logo">WinChat</span>
          <span className="lite-logo-badge">Lite</span>
          <div style={{ flex: 1 }} />
          <button className="lite-icon-btn" onClick={cycleTheme} title="Сменить тему">
            <ThemeIcon size={17} />
          </button>
        </div>

        <div className="lite-search">
          <div className="lite-search-box">
            <SearchIcon size={16} />
            <input
              ref={searchRef}
              className="lite-search-input"
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Поиск чатов…"
              defaultValue=""
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
        </div>

        <div className="lite-list-body">
          {loading ? (
            <div style={{ padding: "12px" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px" }}>
                  <div className="lite-skeleton" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="lite-skeleton" style={{ width: "55%", height: 14 }} />
                    <div className="lite-skeleton" style={{ width: "80%", height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : chats.length === 0 && !q ? (
            <div className="lite-empty">
              <div className="lite-empty-icon">
                <ChatIcon size={30} />
              </div>
              <div className="lite-empty-title">Нет чатов</div>
              <div>
                Найдите человека через поиск.
                <br />
                Или начните переписку в полной версии приложения.
              </div>
            </div>
          ) : q.length >= 2 ? (
            <>
              {shownChats.length > 0 && (
                <>
                  <p className="lite-section-label">Чаты</p>
                  <div className="lite-chat-list">
                    {shownChats.map((c, i) => (
                      <div
                        key={c.id}
                        className="lite-chat-item"
                        style={{ animationDelay: `${i * 0.04}s` }}
                        onClick={() => openChat(c)}
                      >
                        <div
                          className="lite-avatar"
                          style={{
                            background: avatarColor(c.id),
                            ...(c.isGroup ? { borderRadius: "14px" } : {}),
                          }}
                        >
                          {(c.title || "?")[0]?.toUpperCase()}
                        </div>
                        <div className="lite-info">
                          <div className="lite-name">
                            {c.isGroup && (
                              <span className="lite-mini-ic">
                                <UsersIcon size={12} />
                              </span>
                            )}
                            {c.title}
                          </div>
                          <div className="lite-last">{previewOf(c)}</div>
                        </div>
                        <div className="lite-time">{fmtTime(c.updatedAt)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="lite-section-label">Люди</p>
              {searching ? (
                <div className="lite-search-status">Ищем по всей базе…</div>
              ) : searchResults.length ? (
                <div className="lite-chat-list">
                  {searchResults.map((p, i) => (
                    <div
                      key={p.id}
                      className="lite-chat-item"
                      style={{ animationDelay: `${i * 0.04}s` }}
                      onClick={() => void openChatWith(p)}
                    >
                      <div
                        className="lite-avatar"
                        style={{ background: avatarColor(p.id) }}
                      >
                        {(p.nickname || "?")[0]?.toUpperCase()}
                      </div>
                      <div className="lite-info">
                        <div className="lite-name">{p.nickname}</div>
                        <div className="lite-last">@{p.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : shownChats.length === 0 ? (
                <div className="lite-empty">
                  <div className="lite-empty-icon">
                    <SearchIcon size={26} />
                  </div>
                  <div className="lite-empty-title">Ничего не найдено</div>
                  <div>Попробуйте изменить запрос</div>
                </div>
              ) : (
                <div className="lite-search-status">
                  Никого не нашли по запросу «{query.trim()}»
                </div>
              )}
            </>
          ) : shownChats.length === 0 ? (
            <div className="lite-empty">
              <div className="lite-empty-icon">
                <SearchIcon size={26} />
              </div>
              <div className="lite-empty-title">Ничего не найдено</div>
              <div>Попробуйте изменить запрос</div>
            </div>
          ) : (
            <div className="lite-chat-list">
              {shownChats.map((c, i) => (
                <div
                  key={c.id}
                  className="lite-chat-item"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => openChat(c)}
                >
                  <div
                    className="lite-avatar"
                    style={{
                      background: avatarColor(c.id),
                      ...(c.isGroup
                        ? { borderRadius: "14px" }
                        : {}),
                    }}
                  >
                    {(c.title || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="lite-info">
                    <div className="lite-name">
                      {c.isGroup && (
                        <span className="lite-mini-ic">
                          <UsersIcon size={12} />
                        </span>
                      )}
                      {c.title}
                    </div>
                    <div className="lite-last">{previewOf(c)}</div>
                  </div>
                  <div className="lite-time">{fmtTime(c.updatedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {bottomNav}
      </div>
    );
  }

  /* ==================== ПЕРЕПИСКА ==================== */
  return (
    <div className="wclite" data-theme={theme}>
      {otaBar}
      <div className="lite-chat-header">
        <button className="lite-icon-btn" onClick={closeChat} title="Назад">
          <BackIcon size={17} />
        </button>
        <div
          className="lite-avatar"
          style={{
            width: 38,
            height: 38,
            fontSize: 16,
            borderRadius: activeChat.isGroup ? "12px" : "50%",
            background: avatarColor(activeChat.id),
          }}
        >
          {(activeChat.title || "?")[0]?.toUpperCase()}
        </div>
        <div className="lite-chat-header-info">
          <div className="lite-chat-title">{activeChat.title}</div>
          <div className="lite-chat-sub">
            {activeChat.isGroup
              ? `Группа · ${activeChat.members.length} участник(ов)`
              : `@${activeChat.other?.username || ""}`}
          </div>
        </div>
        <button className="lite-icon-btn" onClick={cycleTheme} title="Сменить тему">
          <ThemeIcon size={16} />
        </button>
      </div>

      <div className="lite-messages">
        {msgsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 20, color: "var(--text-secondary)", fontSize: 13 }}>
            Загрузка…
          </div>
        ) : messages.length === 0 ? (
          <div className="lite-empty">
            <div className="lite-empty-icon">
              <ChatIcon size={26} />
            </div>
            <div className="lite-empty-title">Нет сообщений</div>
            <div>Напишите первым</div>
          </div>
        ) : (
          messages.map((m) => {
            const isSelf = m.sender_id === me.id;
            const media = m.audio_url
              ? "🎙️"
              : m.sticker_url
                ? "🩷"
                : m.image_url
                  ? "📷"
                  : m.video_url
                    ? "🎬"
                    : "";
            const body = media
              ? `${media} Медиа доступно только в приложении`
              : m.content || "";
            if (!body) return null;
            const fromWho =
              activeChat.isGroup && !isSelf
                ? activeChat.members.find((p) => p.id === m.sender_id)?.nickname
                : undefined;
            return (
              <div key={m.id} className={`lite-msg-row ${isSelf ? "lite-msg-self" : "lite-msg-other"}`}>
                <div className={`lite-bubble${media ? " lite-bubble-media" : ""}`}>
                  {fromWho && <div className="lite-msg-from">{fromWho}</div>}
                  {body}
                  {!media && m.edited_at ? " (изм.)" : ""}
                  <div className="lite-msg-time">{fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="lite-input-bar">
        <input
          className="lite-input-msg"
          type="text"
          placeholder="Сообщение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={4000}
        />
        <button className="lite-send-btn" onClick={() => void send()} disabled={!text.trim() || sending} title="Отправить">
          <SendIcon size={18} />
        </button>
      </div>
    </div>
  );
}
