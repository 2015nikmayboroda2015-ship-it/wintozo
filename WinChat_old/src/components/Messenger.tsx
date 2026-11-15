import { useCallback, useEffect, useMemo, useState } from "react";
import {
  supabase,
  type ChatItem,
  type ChatRow,
  type Message,
  type Profile,
} from "../lib/supabase";
import { directKey, uuid } from "../lib/utils";
import Sidebar from "./Sidebar";
import ChatView from "./ChatView";
import SettingsModal from "./SettingsModal";
import CreateGroupModal from "./CreateGroupModal";
import ChatInfoModal from "./ChatInfoModal";
import AdminPanel from "./AdminPanel";
import { cn } from "../utils/cn";

interface Props {
  me: Profile;
  onProfileSaved: (p: Profile) => void;
  onLogout: () => void;
}

function Placeholder() {
  return (
    <div className="dot-grid-dark flex h-full flex-col items-center justify-center gap-5 bg-paper text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-ink text-3xl font-extrabold text-white shadow-xl">
        W
      </div>
      <div>
        <p className="text-xl font-extrabold tracking-tight">WinChat</p>
        <p className="mt-2 max-w-[300px] text-sm leading-relaxed font-medium text-black/45">
          Выберите чат слева, найдите человека через поиск или соберите группу
        </p>
      </div>
    </div>
  );
}

export default function Messenger({ me, onProfileSaved, onLogout }: Props) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Admin flag: check if username is 'admin'
  const isAdmin = me.username.toLowerCase() === "admin";

  const active = chats.find((c) => c.id === activeId) ?? null;

  /* ---------- загрузка чатов ---------- */
  const loadChats = useCallback(async () => {
    loadChatsForUser(me.id);
  }, [me.id]);

  const loadChatsForUser = useCallback(async (userId: string) => {
    const { data: mine } = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", userId);
    const ids = ((mine as { chat_id: string }[]) || []).map((r) => r.chat_id);
    if (!ids.length) {
      setChats([]);
      setLoadingChats(false);
      return;
    }

    const [{ data: chatRows }, { data: memberRows }, { data: lastMsgs }] = await Promise.all([
      supabase.from("chats").select("*").in("id", ids),
      supabase.from("chat_members").select("chat_id, user_id, profiles(*)").in("chat_id", ids),
      supabase
        .from("messages")
        .select("*")
        .in("chat_id", ids)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    type MemberRow = { chat_id: string; user_id: string; profiles: Profile | Profile[] | null };
    const membersByChat = new Map<string, Profile[]>();
    ((memberRows as unknown as MemberRow[]) || []).forEach((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (!p) return;
      const list = membersByChat.get(r.chat_id) || [];
      list.push(p);
      membersByChat.set(r.chat_id, list);
    });

    const lastByChat = new Map<string, Message>();
    ((lastMsgs as Message[]) || []).forEach((m) => {
      if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
    });

    const items: ChatItem[] = ((chatRows as ChatRow[]) || [])
      .map((c) => {
        const members = membersByChat.get(c.id) || [];
        const other = c.is_group ? null : (members.find((p) => p.id !== userId) ?? null);
        if (!c.is_group && !other) return null;
        const last = lastByChat.get(c.id) || null;
        return {
          id: c.id,
          isGroup: !!c.is_group,
          title: c.is_group ? c.title || "Группа" : (other?.nickname ?? "Диалог"),
          description: c.is_group ? c.description : (other?.bio ?? null),
          avatarUrl: c.is_group ? c.avatar_url : (other?.avatar_url ?? null),
          other,
          members,
          ownerId: c.created_by,
          lastMessage: last,
          updatedAt: last?.created_at || c.updated_at || "",
        } as ChatItem;
      })
      .filter((x): x is ChatItem => x !== null)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    setChats(items);
    setLoadingChats(false);
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
      return next.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
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
    },
    [me.id, loadChats]
  );

  /* ---------- impersonation handler ---------- */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        targetId: string;
        targetUsername: string;
        targetNickname: string;
      };
      loadChatsForUser(detail.targetId);
      setActiveId(null);
      setAdminOpen(false);
    };
    window.addEventListener("winchat:impersonate", handler);
    return () => window.removeEventListener("winchat:impersonate", handler);
  }, [loadChatsForUser]);

  return (
    <div className="font-app flex h-dvh overflow-hidden bg-paper">
      <div
        className={cn("h-full w-full md:w-[380px] md:shrink-0", active ? "hidden md:block" : "block")}
      >
        <Sidebar
          me={me}
          chats={chats}
          loading={loadingChats}
          activeChatId={activeId}
          onlineIds={onlineIds}
          onSelect={(c) => setActiveId(c.id)}
          onOpenChatWith={openChatWith}
          onOpenSettings={() => setSettingsOpen(true)}
          onCreateGroup={() => setGroupOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
          isAdmin={isAdmin}
        />
      </div>

      <main className={cn("min-w-0 flex-1", active ? "block" : "hidden md:block")}>
        {active ? (
          <ChatView
            key={active.id}
            me={me}
            chat={active}
            onlineIds={onlineIds}
            onBack={() => setActiveId(null)}
            onActivity={applyIncoming}
            onOpenInfo={() => setInfoOpen(true)}
            onResign={async () => {
              const { clearImpersonateSession } = await import("../lib/supabase");
              clearImpersonateSession();
              window.dispatchEvent(new CustomEvent("winchat:resign"));
              await loadChats();
            }}
          />
        ) : (
          <Placeholder />
        )}
      </main>

      {settingsOpen && (
        <SettingsModal
          me={me}
          onClose={() => setSettingsOpen(false)}
          onSaved={onProfileSaved}
          onLogout={onLogout}
        />
      )}

      {groupOpen && (
        <CreateGroupModal
          me={me}
          onClose={() => setGroupOpen(false)}
          onCreated={async (id) => {
            setGroupOpen(false);
            await loadChats();
            setActiveId(id);
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
            setActiveId(null);
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
    </div>
  );
}
