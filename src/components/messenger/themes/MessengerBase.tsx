import { useCallback, useEffect, useMemo, useState } from "react";
import {
  supabase,
  type ChatItem,
  type ChatRow,
  type Message,
  type Profile,
} from "../../../lib/supabase";
import { directKey, uuid } from "../../../lib/utils";
import Sidebar from "../../Sidebar";
import ChatView from "../../ChatView";
import SettingsModal from "../../SettingsModal";
import AndroidSettings from "../../AndroidSettings";
import { Capacitor } from "@capacitor/core";
import { isPhoneDevice } from "../../../lib/oobe";
import { devLog } from "../../../lib/devLogs";
import "../../you-chat.css";

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
import ChatInfoModal from "../../ChatInfoModal";
import AdminPanel from "../../AdminPanel";
import AdminTerminal from "../../AdminTerminal";
import CheckVersion from "../../CheckVersion";
import YouBackdrop from "../../YouBackdrop";
import { cn } from "../../../utils/cn";
import { loadSavedNotes, SAVED_CHAT_ID } from "../../../lib/savedNotes";
import { Megaphone, Star, UsersRound } from "lucide-react";

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
}: {
  youMode?: boolean;
  onCreateGroup?: () => void;
  onCreateChannel?: () => void;
  onOpenSaved?: () => void;
}) {
  if (youMode) {
    return (
      <div className="yc-placeholder you-chat yc-chat h-full">
        <span className="yc-placeholder-halo" aria-hidden />
        <span className="yc-placeholder-orb yc-placeholder-orb-a" aria-hidden />
        <span className="yc-placeholder-orb yc-placeholder-orb-b" aria-hidden />
        <div className="yc-placeholder-card">
          <div className="yc-placeholder-mark">
            <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
          </div>
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

  return (
    <div className="dot-grid-dark relative flex h-full flex-col items-center justify-center overflow-hidden bg-paper text-center">
      {/* Мягкий световой фон — мягче для глаза, без резких пятен. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-accent-soft blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="animate-scale-in relative w-full max-w-md rounded-[32px] bg-white/80 p-8 shadow-2xl backdrop-blur">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[26px] bg-white shadow-lg">
          <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
        </div>
        <p className="text-xl font-extrabold tracking-tight">WinChat</p>
        <p className="mt-2 max-w-[320px] text-sm leading-relaxed font-medium text-black/45">
          Выберите чат слева, найдите человека или соберите группу
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {onCreateGroup && (
            <button
              type="button"
              onClick={onCreateGroup}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-bold text-white shadow-lg shadow-ink/25 transition hover:bg-ink/85 active:scale-95"
            >
              <UsersRound className="h-4 w-4" />
              Создать группу
            </button>
          )}
          {onCreateChannel && (
            <button
              type="button"
              onClick={onCreateChannel}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-black/[0.03] active:scale-95"
            >
              <Megaphone className="h-4 w-4" />
              Создать канал
            </button>
          )}
          {onOpenSaved && (
            <button
              type="button"
              onClick={onOpenSaved}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-black/[0.03] active:scale-95"
            >
              <Star className="h-4 w-4 text-amber-500" fill="currentColor" strokeWidth={1.8} />
              Избранное
            </button>
          )}
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
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

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
      className={cn("font-app flex h-dvh overflow-hidden", youMode ? "you-shell" : "bg-paper")}
      style={viewportHeight ? { height: viewportHeight } : undefined}
    >
      {/* Живой фон Material You */}
      {youMode && <YouBackdrop />}

      {/* Проверка версии / баннеры обновления */}
      <CheckVersion />

      <div
        className={cn(
          "winchat-page-transition you-front h-full w-full md:w-[380px] md:shrink-0",
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
    </div>
  );
}
