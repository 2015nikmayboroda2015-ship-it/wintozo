import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Crown,
  Gem,
  LayoutGrid,
  RefreshCw,
  Settings2,
  Shield,
  Smartphone,
  Terminal,
  UserCheck,
  UserX,
  Wrench,
  X,
} from "lucide-react";
import { supabase, type Profile } from "../../../../lib/supabase";
import { cn } from "../../../../utils/cn";

interface Props {
  me: Profile;
  open: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

interface LogEntry {
  type: "input" | "success" | "error" | "info";
  text: string;
}

interface OtaDeviceRow {
  device_id: string;
  is_wintozo_web: boolean;
  status: string | null;
  platform: string | null;
  app_version: string | null;
  model: string | null;
  manufacturer: string | null;
  os_version: string | null;
  username: string | null;
}

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
  type?: "text" | "number";
};

type GuiAction = {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: Field[];
  build: (v: Record<string, string>) => string;
};

const GUI_ACTIONS: GuiAction[] = [
  {
    id: "ban",
    label: "Бан",
    desc: "Заблокировать пользователя",
    icon: Ban,
    fields: [
      { key: "user", label: "Юзернейм", placeholder: "@username" },
      { key: "reason", label: "Причина", placeholder: "Нарушение правил" },
      { key: "days", label: "Время (дней)", placeholder: "0 = навсегда", optional: true, type: "number" },
    ],
    build: (v) => {
      const u = v.user.replace(/^@/, "").trim();
      const reason = (v.reason || "Без указания причины").trim();
      const days = (v.days || "").trim();
      const suffix = days ? ` · ${days} дн.` : "";
      return `/ban ${u} ${reason}${suffix}`.trim();
    },
  },
  {
    id: "unban",
    label: "Разбан",
    desc: "Снять блокировку",
    icon: UserCheck,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/unban ${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "status",
    label: "Статус",
    desc: "Информация о пользователе",
    icon: Shield,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/status ${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "verify",
    label: "Верификация",
    desc: "Выдать галочку (grey/green/true)",
    icon: BadgeCheck,
    fields: [
      { key: "user", label: "Юзернейм", placeholder: "@username" },
      { key: "level", label: "Уровень", placeholder: "grey | green | true" },
    ],
    build: (v) => `/addverify ${v.user.replace(/^@/, "").trim()} ${(v.level || "true").trim()}`,
  },
  {
    id: "disverify",
    label: "Снять галочку",
    desc: "Убрать верификацию",
    icon: UserX,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/disverify ${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "set_legacy",
    label: "Legacy: вкл",
    desc: "Перевести на базовый интерфейс",
    icon: Settings2,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/set legacy @${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "del_legacy",
    label: "Legacy: выкл",
    desc: "Вернуть новый интерфейс",
    icon: RefreshCw,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/del legacy @${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "give_pro",
    label: "Выдать WinPro",
    desc: "Подписка на N дней",
    icon: Crown,
    fields: [
      { key: "user", label: "Юзернейм", placeholder: "@username" },
      { key: "days", label: "Дней", placeholder: "30", type: "number" },
    ],
    build: (v) => `/give wintozopro @${v.user.replace(/^@/, "").trim()} ${(v.days || "30").trim()}`,
  },
  {
    id: "del_pro",
    label: "Снять WinPro",
    desc: "Удалить подписку",
    icon: Crown,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/delete wintozopro @${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "give_glass",
    label: "Выдать Glass",
    desc: "Доступ к WinChat Glass",
    icon: Gem,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/give glass @${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "del_glass",
    label: "Снять Glass",
    desc: "Убрать доступ к Glass",
    icon: Gem,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/delete glass @${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "oobe",
    label: "Назначить OOBE",
    desc: "Показать OOBE версии (5.0/6.0)",
    icon: Smartphone,
    fields: [
      { key: "user", label: "Юзернейм", placeholder: "@username" },
      { key: "ver", label: "Версия OOBE", placeholder: "5.0 или 6.0" },
    ],
    build: (v) => `/set oobe @${v.user.replace(/^@/, "").trim()} "${(v.ver || "6.0").trim()}"`,
  },
  {
    id: "oobe_off",
    label: "OOBE: сброс",
    desc: "Вернуть обычную логику OOBE",
    icon: Smartphone,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/set oobe @${v.user.replace(/^@/, "").trim()} off`,
  },
  {
    id: "winpass",
    label: "WinPass",
    desc: "Получить код восстановления",
    icon: Wrench,
    fields: [{ key: "user", label: "Юзернейм", placeholder: "@username" }],
    build: (v) => `/get winpass @${v.user.replace(/^@/, "").trim()}`,
  },
  {
    id: "devices",
    label: "Устройства",
    desc: "Список устройств",
    icon: Smartphone,
    fields: [],
    build: () => `/get devices`,
  },
];

export default function ModernAdminTerminal({ me, open, onClose, onProfileUpdated }: Props) {
  const [history, setHistory] = useState<LogEntry[]>([
    { type: "info", text: "WinChat Admin Terminal · Modern" },
    { type: "info", text: "Введите /help или откройте GUI-панель" },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [otaPicker, setOtaPicker] = useState<{ url: string; version: string | null; target: string } | null>(null);
  const [otaPickerDevices, setOtaPickerDevices] = useState<OtaDeviceRow[]>([]);
  const [otaPickerBusy, setOtaPickerBusy] = useState(false);
  const [guiOpen, setGuiOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<GuiAction | null>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, guiOpen]);

  useEffect(() => {
    if (open) {
      const el = document.getElementById("modern-admin-term-input");
      el?.focus();
    }
  }, [open, guiOpen, activeAction]);

  const append = (entries: LogEntry | LogEntry[]) => {
    setHistory((prev) => [...prev, ...(Array.isArray(entries) ? entries : [entries])]);
  };

  async function openOtaPicker(target: string, url: string, version: string | null) {
    setOtaPicker({ url, version, target });
    setOtaPickerBusy(false);
    const { data, error } = await supabase.rpc("get_winchat_ota_devices", {
      _admin_id: me.id,
      _limit: 50,
    });
    if (error) {
      setOtaPickerDevices([]);
      return;
    }
    const res = data as { ok: boolean; devices?: OtaDeviceRow[] };
    let list = (res.devices ?? []) as OtaDeviceRow[];
    if (target.startsWith("@")) {
      const uname = target.slice(1).toLowerCase();
      list = list.filter((d) => (d.username ?? "").toLowerCase() === uname);
    }
    setOtaPickerDevices(list);
    if (list.length === 1) {
      void selectOtaDevice(list[0].device_id, url, version);
    }
  }

  async function selectOtaDevice(deviceId: string, url: string, version: string | null) {
    setOtaPickerBusy(true);
    const { data } = await supabase.rpc("set_winchat_ota", {
      _admin_id: me.id,
      _url: url,
      _version: version,
      _target: deviceId,
    });
    setOtaPickerBusy(false);
    const res = data as { ok: boolean; message?: string; error?: string };
    append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
    if (res.ok) setOtaPicker(null);
  }

  async function runCommand(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    append({ type: "input", text: trimmed });
    setInput("");

    if (!trimmed.startsWith("/")) {
      append({ type: "error", text: "Команды начинаются с /. Введите /help" });
      return;
    }

    const parts = trimmed.toLowerCase().split(/\s+/);
    const cmd = parts[0];

    try {
      if (cmd === "/help") {
        append([
          { type: "info", text: "═══ Команды ═══" },
          { type: "info", text: "/gui — графический интерфейс (кнопки и мастера)" },
          { type: "info", text: "/addverify <user> <grey|green|true> · /disverify <user>" },
          { type: "info", text: "/ban <user> <причина> · /unban <user> · /status <user>" },
          { type: "info", text: "/give wintozopro @user <дней> · /delete wintozopro @user" },
          { type: "info", text: "/give glass @user · /delete glass @user" },
          { type: "info", text: "/set legacy @user · /del legacy @user  (базовый/новый интерфейс)" },
          { type: "info", text: "/give badge @user <1|2|3> · /get badges @user" },
          { type: "info", text: "/get winpass @user · /get devices · /get version · /set version <X.Y.Z>" },
          { type: "info", text: '/set ota [@user] "<url>" [версия] · /set ota off · /get ota' },
          { type: "info", text: '/set oobe @user "<5.0|6.0>" · /set oobe @user off' },
          { type: "info", text: "/channel list|verify|unverify|official|unofficial|delete ..." },
        ]);
        return;
      }
      if (cmd === "/gui") {
        setGuiOpen((g) => !g);
        append({ type: "info", text: guiOpen ? "GUI закрыт" : "GUI открыт — выберите действие" });
        return;
      }
      if (cmd === "/set" && parts[1] === "legacy") {
        const username = parts[2]?.replace(/^@/, "");
        if (!username) {
          append({ type: "error", text: "Использование: /set legacy @username" });
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .update({ is_winchat_legacy: "is_winchat_legacy_true" })
          .ilike("username", username)
          .select("id, username");
        if (error) append({ type: "error", text: `✗ ${error.message}` });
        else if (!data || !data.length) append({ type: "error", text: `✗ Пользователь @${username} не найден` });
        else {
          append({ type: "success", text: `✓ @${username}: включён базовый интерфейс (winchat-legacy)` });
          onProfileUpdated();
        }
        return;
      }
      if (cmd === "/del" && parts[1] === "legacy") {
        const username = parts[2]?.replace(/^@/, "");
        if (!username) {
          append({ type: "error", text: "Использование: /del legacy @username" });
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .update({ is_winchat_legacy: "is_winchat_legacy_false" })
          .ilike("username", username)
          .select("id, username");
        if (error) append({ type: "error", text: `✗ ${error.message}` });
        else if (!data || !data.length) append({ type: "error", text: `✗ Пользователь @${username} не найден` });
        else {
          append({ type: "success", text: `✓ @${username}: включён новый интерфейс` });
          onProfileUpdated();
        }
        return;
      }

      // Delegate to the classic terminal logic by reusing core commands via RPC patterns.
      // For commands not specially handled above, fall back to the existing behavior by
      // executing a minimal inline subset and informing for unsupported ones in modern GUI.
      // (Full legacy command set remains available in base terminal; modern adds GUI + legacy flags.)
      if (cmd === "/addverify") {
        const username = parts[1]?.replace("@", "");
        const level = parts[2] === "true" ? "full" : parts[2];
        if (!username || !level) return append({ type: "error", text: "Использование: /addverify <user> <grey|green|true>" });
        const { data, error } = await supabase.rpc("add_verify_status", { _admin_id: me.id, _target_username: username, _level: level });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as { ok: boolean; message?: string; error?: string };
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/disverify") {
        const username = parts[1]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /disverify <user>" });
        const { data, error } = await supabase.rpc("disverify_status", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as { ok: boolean; message?: string; error?: string };
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/ban") {
        const username = parts[1]?.replace("@", "");
        const reason = trimmed.split(/\s+/).slice(2).join(" ") || "Без указания причины";
        if (!username) return append({ type: "error", text: "Использование: /ban <user> [причина]" });
        const { data, error } = await supabase.rpc("ban_user_by_username", { _admin_id: me.id, _target_username: username, _reason: reason });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as { ok: boolean; message?: string; error?: string };
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        return;
      }
      if (cmd === "/unban") {
        const username = parts[1]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /unban <user>" });
        const { data, error } = await supabase.rpc("unban_user_by_username", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as { ok: boolean; message?: string; error?: string };
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        return;
      }
      if (cmd === "/status") {
        const username = parts[1]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /status <user>" });
        const { data, error } = await supabase.rpc("get_verify_status", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        if (res.ok) {
          const badge = res.verify_status === "full" ? "🔵 Синяя" : res.verify_status === "green" ? "🟢 Зелёная" : res.verify_status === "grey" ? "⚪ Серая" : "— Нет";
          append([
            { type: "info", text: `Пользователь: ${res.nickname} (@${res.username})` },
            { type: "info", text: `Галочка: ${badge}` },
            { type: "info", text: `Заблокирован: ${res.banned ? "да" : "нет"}` },
          ]);
        } else append({ type: "error", text: `✗ ${res.error}` });
        return;
      }
      if (cmd === "/get" && parts[1] === "winpass") {
        const username = parts[2]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /get winpass @user" });
        const { data, error } = await supabase.rpc("admin_get_winpass", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        if (!res.ok) return append({ type: "error", text: `✗ ${res.error}` });
        append({ type: "success", text: `WinPass @${res.username}: ${res.winpass ?? "—"}` });
        return;
      }
      if (cmd === "/get" && parts[1] === "devices") {
        const { data, error } = await supabase.rpc("get_winchat_ota_devices", { _admin_id: me.id, _limit: 50 });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        const list = (res.devices ?? []) as OtaDeviceRow[];
        if (!list.length) append({ type: "info", text: "Устройств нет" });
        else append([{ type: "info", text: `═══ Устройства (${list.length}) ═══` }, ...list.map((d, i) => ({ type: "info" as const, text: `${i + 1}. ${d.username ? "@" + d.username : "—"} · ${[d.manufacturer, d.model].filter(Boolean).join(" ") || d.platform || "устройство"} · ${d.status ?? ""} · v${d.app_version ?? "?"}` }))]);
        return;
      }
      if (cmd === "/give" && parts[1] === "wintozopro") {
        const username = parts[2]?.replace("@", "");
        const days = parts[3] || "30";
        if (!username) return append({ type: "error", text: "Использование: /give wintozopro @user <дней>" });
        const { data, error } = await supabase.rpc("give_wintozopro", { _admin_id: me.id, _target_username: username, _days: parseInt(days, 10) || 30 });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/delete" && parts[1] === "wintozopro") {
        const username = parts[2]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /delete wintozopro @user" });
        const { data, error } = await supabase.rpc("delete_wintozopro", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/give" && parts[1] === "glass") {
        const username = parts[2]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /give glass @user" });
        const { data, error } = await supabase.rpc("give_glass", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/delete" && parts[1] === "glass") {
        const username = parts[2]?.replace("@", "");
        if (!username) return append({ type: "error", text: "Использование: /delete glass @user" });
        const { data, error } = await supabase.rpc("delete_glass", { _admin_id: me.id, _target_username: username });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/set" && parts[1] === "oobe") {
        const username = parts[2]?.replace(/^@/, "");
        const rawVer = trimmed.replace(/^\/set\s+oobe\s*/i, "").replace(/^@[^\s"']+\s*/i, "").trim().replace(/^["']|["']$/g, "");
        if (!username) return append({ type: "error", text: 'Использование: /set oobe @user "5.0|6.0" | off' });
        let version: string | null = rawVer || null;
        if (!version || /^(off|clear|remove|none)$/i.test(version)) version = null;
        const { data, error } = await supabase.rpc("set_oobe", { _admin_id: me.id, _target_username: username, _version: version });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        if (res.ok) onProfileUpdated();
        return;
      }
      if (cmd === "/set" && parts[1] === "version") {
        const rawVersion = trimmed.split(/\s+/).slice(2).join("").trim();
        if (!rawVersion) return append({ type: "error", text: "Использование: /set version <X.Y.Z>" });
        const { data, error } = await supabase.rpc("set_wintozo_version", { _admin_id: me.id, _version: rawVersion });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
        return;
      }
      if (cmd === "/get" && parts[1] === "version") {
        const { data, error } = await supabase.rpc("get_wintozo_version");
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        append({ type: "info", text: `Версия: ${String((data as any)?.version ?? data ?? "—")}` });
        return;
      }
      if (cmd === "/get" && parts[1] === "ota") {
        const { data, error } = await supabase.rpc("get_winchat_ota");
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        if (!res?.ok) return append({ type: "error", text: `✗ ${res?.error ?? "Не удалось получить OTA"}` });
        append([
          { type: "info", text: `OTA URL: ${res.url || "— (выключено)"}` },
          { type: "info", text: `Версия: ${res.version ?? "—"} · Цель: ${res.target ?? "*"}` },
          ...(res.description ? [{ type: "info" as const, text: `Описание: ${res.description}` }] : []),
        ]);
        return;
      }
      if (cmd === "/set" && parts[1] === "ota") {
        const after = trimmed.replace(/^\/set\s+ota\s*/i, "").trim();
        if (!after) {
          append({ type: "error", text: 'Использование: /set ota [@username] "<ссылка>" [версия] [@target|*] ["описание"]' });
          return;
        }
        if (/^(off|clear|remove|delete|disable)$/i.test(after)) {
          const { data, error } = await supabase.rpc("set_winchat_ota", {
            _admin_id: me.id,
            _url: "",
            _version: null,
            _target: null,
          });
          if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
          const res = data as any;
          append({ type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` });
          return;
        }

        let rest = after;
        let prefixTarget: string | null = null;
        const pre = rest.match(/^@([^\s"']+)\s+([\s\S]*)$/);
        if (pre) {
          prefixTarget = `@${pre[1]}`;
          rest = pre[2].trim();
        }

        let description: string | null = null;
        let parseRest = rest.replace(/"([^"]*)"/g, (_m, g: string) => {
          description = g;
          return "";
        });
        parseRest = parseRest.replace(/'([^']*)'/g, (_m, g: string) => {
          description = g;
          return "";
        });

        const urlM = /https?:\/\/[^\s"']+/i.exec(parseRest);
        const url = urlM ? urlM[0] : "";
        const remainder = urlM ? parseRest.slice(urlM.index + urlM[0].length).trim() : "";
        if (!url) {
          append({ type: "error", text: "Ссылка должна начинаться с http:// или https://" });
          return;
        }

        let version: string | null = null;
        let target: string | null = null;
        const tokens = remainder.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          const clean = token.replace(/^["']|["']$/g, "");
          if (!version && /^\d+\.\d+(\.\d+)?(-[0-9a-z][0-9a-z.\-]*(\+[0-9a-z.\-]+)?)?$/i.test(clean)) {
            version = clean;
          } else if (!target) {
            target = clean;
          }
        }

        const finalTarget = prefixTarget ?? target ?? null;
        const finalDescription =
          description ??
          (tokens
            .filter((t) => t !== version && t !== target)
            .map((t) => t.replace(/^["']|["']$/g, ""))
            .join(" ")
            .trim() || null);

        const { data, error } = await supabase.rpc("set_winchat_ota", {
          _admin_id: me.id,
          _url: url,
          _version: version,
          _target: finalTarget,
          _desc: finalDescription,
        });
        if (error) return append({ type: "error", text: `Ошибка: ${error.message}` });
        const res = data as any;
        if (!res?.ok) {
          append({ type: "error", text: `✗ ${res?.error ?? "Ошибка установки OTA"}` });
          return;
        }
        append({ type: "success", text: `✓ ${res.message ?? "OTA установлена"}` });
        append({ type: "info", text: `URL: ${res.url ?? url}` });
        append({ type: "info", text: `Версия: ${res.version ?? version ?? "не указана"} · Цель: ${res.target ?? finalTarget ?? "*"}` });
        if (res.description ?? finalDescription) {
          append({ type: "info", text: `Описание: ${res.description ?? finalDescription}` });
        }
        if (url && finalTarget && finalTarget !== "*") {
          void openOtaPicker(finalTarget, res.url ?? url, res.version ?? version ?? null);
        }
        return;
      }

      append({ type: "error", text: `Команда пока не поддержана в новом GUI-терминале: ${cmd}. Откройте legacy-терминал или используйте /help.` });
    } catch (err) {
      append({ type: "error", text: `Ошибка: ${(err as Error).message}` });
    }
  }

  const wizardField = activeAction?.fields[step];

  function startAction(action: GuiAction) {
    if (action.fields.length === 0) {
      void runCommand(action.build({}));
      return;
    }
    setActiveAction(action);
    setStep(0);
    setValues({});
  }

  function submitWizardStep() {
    if (!activeAction || !wizardField) return;
    const v = (values[wizardField.key] || "").trim();
    if (!wizardField.optional && !v) return;
    if (step < activeAction.fields.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    const cmd = activeAction.build({ ...values, [wizardField.key]: v });
    setActiveAction(null);
    setStep(0);
    setValues({});
    void runCommand(cmd);
  }

  if (!open) return null;

  if (otaPicker) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220] text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2 font-bold"><Terminal className="h-4 w-4 text-emerald-400" />Выбор устройства</div>
            <button onClick={() => setOtaPicker(null)} className="rounded-xl p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
            {otaPickerDevices.length === 0 ? <p className="text-white/60">Устройства не найдены</p> : otaPickerDevices.map((d, i) => (
              <button key={d.device_id} disabled={otaPickerBusy} onClick={() => void selectOtaDevice(d.device_id, otaPicker.url, otaPicker.version)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10">
                <div className="font-semibold">{i + 1}. {d.username ? `@${d.username}` : "—"}</div>
                <div className="text-xs text-white/60">{[d.manufacturer, d.model].filter(Boolean).join(" ") || d.platform} · v{d.app_version ?? "?"}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-md sm:p-6">
      <div className="relative flex h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] text-white shadow-2xl sm:h-[88vh]">
        {/* Left: GUI (на телефонах — отдельное окно поверх терминала) */}
        <div
          className={cn(
            "flex flex-col bg-gradient-to-b from-white/[0.04] to-[#0b1220] sm:border-r sm:border-white/10 sm:to-transparent",
            guiOpen
              ? "absolute inset-0 z-20 w-full sm:static sm:z-auto sm:w-[360px]"
              : "hidden sm:static sm:z-auto sm:flex sm:w-[300px]"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:border-b-0">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold"><LayoutGrid className="h-4 w-4 text-emerald-400" />Панель команд</div>
              <p className="mt-0.5 text-xs text-white/45">Нажмите действие — заполните шаги — команда выполнится</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setGuiOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10" aria-label="Закрыть панель">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3 pt-3 sm:pt-0">
            {GUI_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.id} onClick={() => startAction(a)} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08] hover:shadow-lg active:scale-[0.98]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Icon className="h-4.5 w-4.5" /></div>
                  <div className="mt-2 text-[13px] font-bold leading-tight">{a.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-white/45">{a.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: terminal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <button onClick={() => setGuiOpen((g) => !g)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10">
                <LayoutGrid className="h-4 w-4" /> GUI
              </button>
              <div className="flex items-center gap-2 font-mono text-sm font-bold"><Terminal className="h-4 w-4 text-emerald-400" />Admin Terminal</div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">@{me.username}</span>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed sm:p-5">
            {history.map((entry, i) => (
              <div key={i} className="mb-1.5">
                {entry.type === "input" && <span><span className="text-emerald-400">$ </span>{entry.text}</span>}
                {entry.type === "success" && <span className="text-emerald-400">{entry.text}</span>}
                {entry.type === "error" && <span className="text-red-400">{entry.text}</span>}
                {entry.type === "info" && <span className="text-sky-300">{entry.text}</span>}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 p-3 sm:p-4">
            <form onSubmit={(e) => { e.preventDefault(); void runCommand(input); }} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="font-mono text-sm text-emerald-400">$</span>
              <input id="modern-admin-term-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введите команду… (/gui, /help, /ban …)" className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-white/30" autoComplete="off" spellCheck={false} />
              <button type="submit" className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400">Выполнить</button>
            </form>
          </div>
        </div>
      </div>

      {/* Wizard */}
      {activeAction && wizardField && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-sm font-extrabold">{activeAction.label}</div>
                <div className="mt-0.5 text-xs text-white/45">Шаг {step + 1} из {activeAction.fields.length}</div>
              </div>
              <button onClick={() => setActiveAction(null)} className="rounded-xl p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/50">{wizardField.label}</label>
              <input
                autoFocus
                type={wizardField.type || "text"}
                value={values[wizardField.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [wizardField.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitWizardStep(); } }}
                placeholder={wizardField.placeholder}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10"
              />
              {wizardField.optional && <p className="mt-2 text-xs text-white/40">Можно оставить пустым</p>}
              <div className="mt-5 flex gap-2">
                <button onClick={() => setActiveAction(null)} className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-bold hover:bg-white/5">Отмена</button>
                <button onClick={submitWizardStep} className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-400">
                  {step < activeAction.fields.length - 1 ? "Далее" : "Выполнить"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-white/35">Будет выполнено: <span className="font-mono text-white/60">{activeAction.build({ ...values, [wizardField.key]: values[wizardField.key] || "" })}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
