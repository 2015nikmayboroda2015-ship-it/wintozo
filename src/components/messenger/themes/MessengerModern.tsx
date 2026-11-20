import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  supabase,
  type ChatItem,
  type ChatRow,
  type Message,
  type Profile,
} from "../../../lib/supabase";
import { directKey, uuid } from "../../../lib/utils";
import Sidebar from "./modern/ModernSidebar";
import ChatView from "./modern/ModernChatView";
import SettingsModal from "./modern/ModernSettingsModal";
import ChatInfoModal from "./modern/ModernChatInfoModal";
import AndroidSettings from "./modern/ModernAndroidSettings";
import { Capacitor } from "@capacitor/core";
import { isPhoneDevice } from "../../../lib/oobe";
import { devLog } from "../../../lib/devLogs";
import "../../you-chat.css";
import "./modern.css";

/** Нативное Android-приложение? Для него настройки — полноэкранные. */
function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/** Настройки на весь экран: нативный Android и все телефоны
 *  с маленьким экраном (Android/iPhone в браузере — тоже). */
function isPhoneSettings(): boolean {
  return isNativeAndroid() || isPhoneDevice();
}
import CreateGroupModal from "../../CreateGroupModal";
import AdminPanel from "../../AdminPanel";
import AdminTerminal from "./modern/ModernAdminTerminal";
import CheckVersion from "../../CheckVersion";
import YouBackdrop from "../../YouBackdrop";
import { cn } from "../../../utils/cn";
import { loadSavedNotes, SAVED_CHAT_ID } from "../../../lib/savedNotes";
import { Megaphone, MessageCircle, Search, Settings, Star, Terminal, UsersRound } from "lucide-react";

/** «Избранное» всегда закреплено сверху, остальные — по времени. */
const bySavedThenDate = (a: ChatItem, b: ChatItem) =>
  Number(!!b.isSaved) - Number(!!a.isSaved) ||
  (b.updatedAt || "").localeCompare(a.updatedAt || "");

/** Локальный чат «Избранное»: в Supabase его нет, заметки лежат на устройстве. */
function buildSavedChat(userId: string): ChatItem {
  const notes = loadSavedNotes(userId);
  const last = notes.length ? notes[notes.length - 1] : null;
  return {
    id: SAVED_CHAT_ID,
    isGroup: false,
    isChannel: false,
    isOfficial: false,
    verified: false,
    myRole: "owner",
    memberRoles: {},
    title: "Избранное",
    description: "Личные заметки — хранятся на этом устройстве",
    avatarUrl: null,
    other: null,
    members: [],
    ownerId: userId,
    lastMessage: last,
    updatedAt: last?.created_at || "",
    isSaved: true,
  };
}

interface Props {
  me: Profile;
  onProfileSaved: (p: Profile) => void;
  onLogout: () => void;
  /** Ивент «Память о Wintozo»: показать плашку выбора интерфейса. */
  onShowLegacy?: () => void;
  /** Роут /settings — сразу открыть настройки при монтировании. */
  initialSettingsOpen?: boolean;
  /** Роут /settings/status/winpro — открыть настройки на вкладке WinPro. */
  initialSettingsTab?: "profile" | "customization" | "security" | "winpro";
  /** Форсировать полноэкранные Android-настройки (отладка на ПК: /setting_phone=1). */
  forcePhoneSettings?: boolean;
  /** Режим WinChat You (Material You). */
  youMode?: boolean;
  /** Чат из адреса /themes/you/chat/:id. */
  initialChatId?: string | null;
  /** Обновить адрес при выборе чата в режиме You. */
  onYouChatRoute?: (chatId: string | null) => void;
  /** Выйти из WinChat You в обычный интерфейс. */
  onExitYou?: () => void;
  /** Открыть настройки по адресу /themes/you/settings. */
  onOpenYouSettings?: () => void;
  /** Настройки закрыли — вернуть адрес на /themes/you/chat. */
  onYouSettingsClosed?: () => void;
  /** Открыть чат по id из ссылки-приглашения (/channel/invite/<code>, /group/invite/<code>). */
  inviteChatId?: string | null;
}

function Placeholder({
  youMode,
  onCreateGroup,
  onCreateChannel,
  onOpenSaved,
  isAdmin,
  onOpenTerminal,
  onLogoTap,
}: {
  youMode?: boolean;
  onCreateGroup?: () => void;
  onCreateChannel?: () => void;
  onOpenSaved?: () => void;
  isAdmin?: boolean;
  onOpenTerminal?: () => void;
  onLogoTap?: () => void;
}) {
  if (youMode) {
    return (
      <div className="yc-placeholder you-chat yc-chat h-full">
        <span className="yc-placeholder-halo" aria-hidden />
        <span className="yc-placeholder-orb yc-placeholder-orb-a" aria-hidden />
        <span className="yc-placeholder-orb yc-placeholder-orb-b" aria-hidden />
        <div className="yc-placeholder-card">
          <button type="button" onClick={onLogoTap} className="yc-placeholder-mark" aria-label="WinChat">
            <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
          </button>
          <p className="yc-placeholder-title">Ваши беседы</p>
          <p className="yc-placeholder-sub">
            Выберите чат, найдите человека или создайте группу — всё в одном месте.
          </p>
          <div className="yc-placeholder-chips" aria-hidden>
            <span>Личные</span>
            <span>Группы</span>
            <span>Каналы</span>
          </div>
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="dot-grid-dark relative flex h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#fbfbfa] via-white to-accent-soft/25 px-4 text-center sm:px-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-[-6rem] h-[30rem] w-[30rem] rounded-full bg-accent-soft/70 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full bg-white/70 blur-3xl"
      />

      {/* Логотип WinChat и админ-терминал в правом верхнем углу */}
      <div className="absolute top-4 right-4 z-20 hidden items-center gap-2 md:flex">
        {onLogoTap && (
          <button
            onClick={onLogoTap}
            className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white/85 py-1.5 pr-3 pl-1.5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-95"
            aria-label="WinChat"
            title="WinChat"
          >
            <span className="h-8 w-8 overflow-hidden rounded-xl ring-1 ring-black/5">
              <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
            </span>
            <span className="text-[13px] font-extrabold tracking-tight text-ink">WinChat</span>
          </button>
        )}
        {isAdmin && onOpenTerminal && (
          <button
            onClick={onOpenTerminal}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-md active:scale-95"
            aria-label="Admin Terminal"
            title="Admin Terminal"
          >
            <Terminal className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="modern-fade-in relative w-full max-w-3xl">
        <div className="overflow-hidden rounded-[40px] border border-white/80 bg-white/72 p-6 shadow-[0_30px_90px_-32px_rgba(16,18,20,0.28)] backdrop-blur-2xl sm:p-10">
          <div className="flex flex-col items-center gap-7 lg:flex-row lg:items-start lg:gap-8 lg:text-left">
            <div className="relative shrink-0">
              <div className="absolute inset-0 scale-110 rounded-[34px] bg-accent/15 blur-xl" aria-hidden />
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-black/5 sm:h-28 sm:w-28">
                <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-[2.2rem]">
                {greeting}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed font-medium text-black/50 sm:text-[15px] lg:mx-0">
                Выберите чат слева, найдите собеседника или создайте новое пространство. Сообщения, каналы и заметки — в одном аккуратном месте.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                {onCreateGroup && (
                  <button
                    type="button"
                    onClick={onCreateGroup}
                    className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 hover:bg-ink/90 hover:shadow-xl active:scale-95"
                  >
                    <UsersRound className="h-4.5 w-4.5" />
                    Новая группа
                  </button>
                )}
                {onCreateChannel && (
                  <button
                    type="button"
                    onClick={onCreateChannel}
                    className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/90 px-5 py-3.5 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-95"
                  >
                    <Megaphone className="h-4.5 w-4.5 text-accent" />
                    Создать канал
                  </button>
                )}
                {onOpenSaved && (
                  <button
                    type="button"
                    onClick={onOpenSaved}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-white px-5 py-3.5 text-sm font-bold text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
                  >
                    <Star className="h-4.5 w-4.5 text-amber-500" fill="currentColor" strokeWidth={1.8} />
                    Избранное
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="group rounded-[24px] border border-black/6 bg-white/75 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent transition group-hover:scale-105">
                <Search className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-extrabold text-ink">Быстрый поиск</p>
              <p className="mt-1 text-xs leading-relaxed font-medium text-black/45">
                Ищите людей, чаты и группы прямо из боковой панели.
              </p>
            </div>
            <div className="group rounded-[24px] border border-black/6 bg-white/75 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent transition group-hover:scale-105">
                <MessageCircle className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-extrabold text-ink">Все диалоги</p>
              <p className="mt-1 text-xs leading-relaxed font-medium text-black/45">
                Личные переписки, группы и каналы — в едином списке.
              </p>
            </div>
            <div className="group rounded-[24px] border border-black/6 bg-white/75 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent transition group-hover:scale-105">
                <Settings className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-extrabold text-ink">Настройки</p>
              <p className="mt-1 text-xs leading-relaxed font-medium text-black/45">
                Профиль, темы, безопасность и персонализация — рядом.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Messenger({
  me,
  onProfileSaved,
  onLogout,
  onShowLegacy,
  initialSettingsOpen = false,
  initialSettingsTab,
  forcePhoneSettings = false,
  youMode = false,
  initialChatId = null,
  onYouChatRoute,
  onExitYou,
  onOpenYouSettings,
  onYouSettingsClosed,
  inviteChatId = null,
}: Props) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(initialChatId);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [groupOpen, setGroupOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [trollOpen, setTrollOpen] = useState(false);
  const logoTaps = useRef(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  /** Пасхалка: 9 кликов по логотипу — полноэкранный TROLL TROLL. */
  const registerLogoTap = useCallback(() => {
    logoTaps.current += 1;
    if (logoTaps.current < 9) return;
    logoTaps.current = 0;
    setTrollOpen(true);
  }, []);

  /* ---------- высота под мобильную клавиатуру ---------- */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (window.innerWidth >= 768) {
        setViewportHeight(null);
        return;
      }
      setViewportHeight(vv.height);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const isAdmin = me.username.toLowerCase() === "admin";
  const active = chats.find((c) => c.id === activeId) ?? null;

  /* ---------- WinChat You: адрес синхронизирует выбранный чат и настройки ---------- */
  useEffect(() => {
    if (youMode) setActiveId(initialChatId ?? null);
  }, [youMode, initialChatId]);

  useEffect(() => {
    if (initialSettingsOpen) setSettingsOpen(true);
  }, [initialSettingsOpen]);

  /* ---------- загрузка чатов ---------- */
  const loadChats = useCallback(async () => {
    await loadChatsForUser(me.id);
  }, [me.id]);

  const loadChatsForUser = useCallback(async (userId: string) => {
    // «Избранное» — локальный чат, он не хранится в Supabase.
    const savedItem = buildSavedChat(userId);

    const { data: mine } = await supabase
      .from("chat_members")
      .select("chat_id, role")
      .eq("user_id", userId);
    const membership = (mine as { chat_id: string; role: string }[]) || [];
    const ids = membership.map((r) => r.chat_id);
    const roleByChat = new Map(membership.map((r) => [r.chat_id, r.role]));
    if (!ids.length) {
      setChats([savedItem]);
      setLoadingChats(false);
      devLog("chats loaded: 1 (saved only)");
      return;
    }

    const [{ data: chatRows }, { data: memberRows }, { data: lastMsgs }] = await Promise.all([
      supabase.from("chats").select("*").in("id", ids),
      supabase.from("chat_members").select("chat_id, user_id, role, profiles(*)").in("chat_id", ids),
      supabase
        .from("messages")
        .select("*")
        .in("chat_id", ids)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    type MemberRow = { chat_id: string; user_id: string; role: string | null; profiles: Profile | Profile[] | null };
    const membersByChat = new Map<string, Profile[]>();
    const memberRolesByChat = new Map<string, Record<string, string>>();
    ((memberRows as unknown as MemberRow[]) || []).forEach((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (!p) return;
      const list = membersByChat.get(r.chat_id) || [];
      list.push(p);
      membersByChat.set(r.chat_id, list);
      const roles = memberRolesByChat.get(r.chat_id) || {};
      roles[p.id] = r.role || "member";
      memberRolesByChat.set(r.chat_id, roles);
    });

    const lastByChat = new Map<string, Message>();
    ((lastMsgs as Message[]) || []).forEach((m) => {
      if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
    });

    const serverItems: ChatItem[] = ((chatRows as ChatRow[]) || [])
      .map((c) => {
        const members = membersByChat.get(c.id) || [];
        const other = c.is_group ? null : (members.find((p) => p.id !== userId) ?? null);
        if (!c.is_group && !other) return null;
        const last = lastByChat.get(c.id) || null;
        return {
          id: c.id,
          isGroup: !!c.is_group,
          isChannel: !!c.is_channel,
          isOfficial: !!c.is_official,
          verified: !!c.verified,
          myRole: roleByChat.get(c.id) ?? null,
          memberRoles: memberRolesByChat.get(c.id) ?? {},
          invite_code: c.invite_code ?? null,
          title: c.is_group ? c.title || (c.is_channel ? "Канал" : "Группа") : (other?.nickname ?? "Диалог"),
          description: c.is_group ? c.description : (other?.bio ?? null),
          avatarUrl: c.is_group ? c.avatar_url : (other?.avatar_url ?? null),
          other,
          members,
          ownerId: c.created_by,
          lastMessage: last,
          updatedAt: last?.created_at || c.updated_at || "",
        } as ChatItem;
      })
      .filter((x): x is ChatItem => x !== null);

    setChats([savedItem, ...serverItems].sort(bySavedThenDate));
    setLoadingChats(false);
    devLog(`chats loaded: ${serverItems.length + 1}`);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  /* ---------- обновление плитки чата ---------- */
  const applyIncoming = useCallback((m: Message) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === m.chat_id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], lastMessage: m, updatedAt: m.created_at };
      return next.sort(bySavedThenDate);
    });
  }, []);

  /* ---------- realtime для списка ---------- */
  const chatIdsKey = useMemo(() => chats.map((c) => c.id).sort().join(","), [chats]);
  useEffect(() => {
    if (!chatIdsKey) return;
    const channel = supabase.channel(`sidebar:${me.id}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=in.(${chatIdsKey})`,
        },
        (payload) => applyIncoming(payload.new as Message)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chats",
          filter: `id=in.(${chatIdsKey})`,
        },
        () => loadChats()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatIdsKey, me.id, applyIncoming, loadChats]);

  /* ---------- пинг «вас добавили» ---------- */
  useEffect(() => {
    const channel = supabase.channel(`user:${me.id}`);
    channel.on("broadcast", { event: "new_chat" }, () => loadChats()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me.id, loadChats]);

  /* ---------- presence ---------- */
  useEffect(() => {
    const channel = supabase.channel("winchat:presence", {
      config: { presence: { key: me.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        Object.values(state).forEach((arr) =>
          (arr as { user_id?: string }[]).forEach((p) => p?.user_id && ids.add(p.user_id))
        );
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ user_id: me.id });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me.id]);

  /* ---------- открыть/создать личный диалог ---------- */
  const openChatWith = useCallback(
    async (other: Profile) => {
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
      await loadChats();
      setActiveId(chatId!);
      if (youMode) onYouChatRoute?.(chatId!);
    },
    [me.id, loadChats, youMode, onYouChatRoute]
  );

  /** Выбор чата: обновляет и интерфейс, и адрес /themes/you/chat/:id. */
  const selectChat = useCallback(
    (chat: ChatItem) => {
      devLog(`opening chat ${chat.id} (${chat.isGroup ? "group" : "direct"})`);
      setActiveId(chat.id);
      if (youMode) onYouChatRoute?.(chat.id);
    },
    [youMode, onYouChatRoute]
  );

  /** Закрыть чат: в You-режиме возвращаем адрес на /themes/you/chat. */
  const closeChat = useCallback(() => {
    setActiveId(null);
    if (youMode) onYouChatRoute?.(null);
  }, [youMode, onYouChatRoute]);

  /* ---------- Ссылка-приглашение: открыть чат по inviteChatId ---------- */
  useEffect(() => {
    if (!inviteChatId) return;
    const found = chats.find((c) => c.id === inviteChatId);
    if (found) selectChat(found);
  }, [inviteChatId, chats, selectChat]);

  return (
    <div
      className={cn(
        "font-app flex h-dvh overflow-hidden",
        youMode
          ? "you-shell"
          : "messenger-modern bg-gradient-to-br from-[#fbfbfa] via-[#f7f7f4] to-accent-soft/25"
      )}
      style={viewportHeight ? { height: viewportHeight } : undefined}
    >
      {/* Живой фон Material You */}
      {youMode && <YouBackdrop />}

      {/* Проверка версии / баннеры обновления */}
      <CheckVersion />

      <div
        className={cn(
          "winchat-page-transition you-front h-full w-full md:w-[424px] md:shrink-0",
          active ? "hidden md:block" : "block"
        )}
      >
        <Sidebar
          me={me}
          chats={chats}
          loading={loadingChats}
          activeChatId={activeId}
          onlineIds={onlineIds}
          onSelect={selectChat}
          onOpenChatWith={openChatWith}
          onOpenSettings={() =>
            youMode ? onOpenYouSettings?.() : setSettingsOpen(true)
          }
          onCreateGroup={() => setGroupOpen(true)}
          onCreateChannel={() => setChannelOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
          onOpenTerminal={() => setTermOpen(true)}
          isAdmin={isAdmin}
          youMode={youMode}
          onExitYou={onExitYou}
          onLogoTap={registerLogoTap}
        />
      </div>

      <main
        className={cn(
          "winchat-page-transition you-front min-w-0 flex-1",
          active ? "block" : "hidden md:block"
        )}
      >
        {active ? (
          <ChatView
            key={active.id}
            me={me}
            chat={active}
            onlineIds={onlineIds}
            onBack={closeChat}
            onActivity={applyIncoming}
            onOpenInfo={() => setInfoOpen(true)}
            youMode={youMode}
            isAdmin={isAdmin}
            onOpenTerminal={() => setTermOpen(true)}
          />
        ) : (
          <Placeholder
            youMode={youMode}
            onCreateGroup={() => setGroupOpen(true)}
            onCreateChannel={() => setChannelOpen(true)}
            onOpenSaved={() => {
              const saved = chats.find((c) => c.isSaved);
              if (saved) selectChat(saved);
            }}
            isAdmin={isAdmin}
            onOpenTerminal={() => setTermOpen(true)}
            onLogoTap={registerLogoTap}
          />
        )}
      </main>

      {settingsOpen &&
        ((isPhoneSettings() || forcePhoneSettings) ? (
          <AndroidSettings
            me={me}
            onClose={() => {
              setSettingsOpen(false);
              if (youMode) onYouSettingsClosed?.();
            }}
            onSaved={onProfileSaved}
            onLogout={onLogout}
            onShowLegacy={onShowLegacy}
            initialView={
              initialSettingsTab === "winpro"
                ? "winpro"
                : initialSettingsTab === "customization"
                  ? "customization"
                  : "menu"
            }
            youMode={youMode}
          />
        ) : (
          <SettingsModal
            me={me}
            onClose={() => {
              setSettingsOpen(false);
              if (youMode) onYouSettingsClosed?.();
            }}
            onSaved={onProfileSaved}
            onLogout={onLogout}
            onShowLegacy={onShowLegacy}
            initialTab={initialSettingsTab}
            youMode={youMode}
          />
        ))}

      {groupOpen && (
        <CreateGroupModal
          me={me}
          mode="group"
          onClose={() => setGroupOpen(false)}
          onCreated={async (id) => {
            setGroupOpen(false);
            await loadChats();
            setActiveId(id);
            if (youMode) onYouChatRoute?.(id);
          }}
        />
      )}

      {channelOpen && (
        <CreateGroupModal
          me={me}
          mode="channel"
          onClose={() => setChannelOpen(false)}
          onCreated={async (id) => {
            setChannelOpen(false);
            await loadChats();
            setActiveId(id);
            if (youMode) onYouChatRoute?.(id);
          }}
        />
      )}

      {infoOpen && active && (
        <ChatInfoModal
          chat={active}
          me={me}
          onlineIds={onlineIds}
          onClose={() => setInfoOpen(false)}
          onUpdated={loadChats}
          onLeft={async () => {
            setInfoOpen(false);
            closeChat();
            await loadChats();
          }}
        />
      )}

      {adminOpen && (
        <AdminPanel
          meId={me.id}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {termOpen && (
        <AdminTerminal
          me={me}
          open={termOpen}
          onClose={() => setTermOpen(false)}
          onProfileUpdated={() => {
            supabase.from("profiles").select("*").eq("id", me.id).single().then(({ data }) => {
              if (data) onProfileSaved(data as Profile);
            });
          }}
        />
      )}

      {/* Пасхалка: 9 кликов по логотипу. Закрыть можно только перезагрузкой. */}
      {trollOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-black p-4">
          <p className="select-none text-center text-4xl font-black uppercase tracking-[0.22em] text-red-600 sm:text-6xl">
            TROLL TROLL
          </p>
          <div className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-black shadow-[0_0_90px_rgba(220,38,38,0.45)] ring-1 ring-red-600/40">
            <iframe
              width="720"
              height="405"
              src="https://rutube.ru/play/embed/7d0c916c2867a2c217b762f55ee45cf0/"
              style={{ border: "none" }}
              allow="clipboard-write; autoplay"
              allowFullScreen
              className="aspect-video w-full"
              title="TROLL TROLL"
            />
          </div>
        </div>
      )}
    </div>
  );
}
