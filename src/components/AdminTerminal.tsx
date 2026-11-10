import { useEffect, useRef, useState } from "react";
import { Terminal, X } from "lucide-react";
import { supabase, type Profile } from "../lib/supabase";
import { BADGE_LABELS } from "../lib/badges";

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

export default function AdminTerminal({ me, open, onClose, onProfileUpdated }: Props) {
  const [history, setHistory] = useState<LogEntry[]>([
    { type: "info", text: "WinChat Admin Terminal v2.0" },
    { type: "info", text: "Введите /help для списка команд" },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  /* Окно выбора устройства для OTA-обновления (/set ota @user "ссылка" версия). */
  const [otaPicker, setOtaPicker] = useState<{ url: string; version: string | null; target: string } | null>(null);
  const [otaPickerDevices, setOtaPickerDevices] = useState<OtaDeviceRow[]>([]);
  const [otaPickerBusy, setOtaPickerBusy] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  useEffect(() => {
    if (open) {
      const el = document.getElementById("admin-term-input");
      el?.focus();
    }
  }, [open]);

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
    setHistory((prev) => [
      ...prev,
      { type: res.ok ? "success" : "error", text: res.ok ? `✓ ${res.message}` : `✗ ${res.error}` },
    ]);
    if (res.ok) setOtaPicker(null);
  }

  async function runCommand(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setHistory((prev) => [...prev, { type: "input", text: trimmed }]);
    setInput("");

    if (!trimmed.startsWith("/")) {
      setHistory((prev) => [
        ...prev,
        { type: "error", text: "Команды начинаются с / . Введите /help для справки" },
      ]);
      return;
    }

    const parts = trimmed.toLowerCase().split(/\s+/);
    const cmd = parts[0];

    try {
      switch (cmd) {
        case "/help": {
          setHistory((prev) => [
            ...prev,
            { type: "info", text: "═══ Команды админ-терминала ═══" },
            { type: "info", text: "/addverify <username> grey  — Серая галочка (1 этап)" },
            { type: "info", text: "/addverify <username> green — Зелёная галочка (2 этап)" },
            { type: "info", text: "/addverify <username> true  — Синяя галочка (полная верификация)" },
            { type: "info", text: "/disverify <username>       — Снять галочку" },
            { type: "info", text: "/ban <username> <причина>   — Заблокировать" },
            { type: "info", text: "/unban <username>           — Разблокировать" },
            { type: "info", text: "/status <username>          — Статус пользователя" },
            { type: "info", text: "/get winpass @username      — WinPass аккаунта (восстановление)" },
            { type: "info", text: "/give wintozopro @username X — Выдать WinPro на X дней" },
            { type: "info", text: "/delete wintozopro @username — Удалить WinPro" },
            { type: "info", text: "/give badge @username <1|2|3> — Выдать бейдж (1 — Дизайнер, 2 — Тестер, 3 — Олд)" },
            { type: "info", text: "/get badges @username — Получить бейджи пользователя" },
            { type: "info", text: "/channel list — Список каналов (id, название, подписчики)" },
            { type: "info", text: "/channel verify <id|название> — Выдать синюю галочку каналу" },
            { type: "info", text: "/channel unverify <id|название> — Снять галочку канала" },
            { type: "info", text: "/channel official <id|название> — Сделать канал официальным" },
            { type: "info", text: "/channel unofficial <id|название> — Снять статус официального" },
            { type: "info", text: "/channel delete <id|название> — Удалить канал" },
            { type: "info", text: "/set version <X.Y.Z>        — Установить версию (можно 4.0.0-beta)" },
            { type: "info", text: "/get version                — Текущая версия приложения" },
            { type: "info", text: '/set ota [@username] "<ссылка>" [версия] [@target|*] — OTA для Android' },
            { type: "info", text: "/set ota off                — Отключить OTA" },
            { type: "info", text: "/get ota                    — Текущая OTA-настройка" },
            { type: "info", text: "/get devices                — Устройства, которые запускали приложение" },
            { type: "info", text: "/help                       — Эта справка" },
          ]);
          break;
        }

        case "/addverify": {
          const username = parts[1]?.replace("@", "");
          const level = parts[2];
          if (!username || !level) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /addverify <username> <grey|green|true>" },
            ]);
            return;
          }
          const mappedLevel = level === "true" ? "full" : level;
          if (!["grey", "green", "full"].includes(mappedLevel)) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Неверный уровень. Доступные: grey, green, true" },
            ]);
            return;
          }

          const { data, error } = await supabase.rpc("add_verify_status", {
            _admin_id: me.id,
            _target_username: username,
            _level: mappedLevel,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            return;
          }

          const res = data as { ok: boolean; message?: string; error?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
            onProfileUpdated();
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/disverify": {
          const username = parts[1]?.replace("@", "");
          if (!username) {
            setHistory((prev) => [...prev, { type: "error", text: "Использование: /disverify <username>" }]);
            return;
          }

          const { data, error } = await supabase.rpc("disverify_status", {
            _admin_id: me.id,
            _target_username: username,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            return;
          }

          const res = data as { ok: boolean; message?: string; error?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
            onProfileUpdated();
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/ban": {
          const username = parts[1]?.replace("@", "");
          const reason = parts.slice(2).join(" ") || "Без указания причины";
          if (!username) {
            setHistory((prev) => [...prev, { type: "error", text: "Использование: /ban <username> [причина]" }]);
            return;
          }

          const { data, error } = await supabase.rpc("ban_user_by_username", {
            _admin_id: me.id,
            _target_username: username,
            _reason: reason,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            return;
          }

          const res = data as { ok: boolean; message?: string; error?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/unban": {
          const username = parts[1]?.replace("@", "");
          if (!username) {
            setHistory((prev) => [...prev, { type: "error", text: "Использование: /unban <username>" }]);
            return;
          }

          const { data, error } = await supabase.rpc("unban_user_by_username", {
            _admin_id: me.id,
            _target_username: username,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            return;
          }

          const res = data as { ok: boolean; message?: string; error?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/status": {
          const username = parts[1]?.replace("@", "");
          if (!username) {
            setHistory((prev) => [...prev, { type: "error", text: "Использование: /status <username>" }]);
            return;
          }

          const { data, error } = await supabase.rpc("get_verify_status", {
            _admin_id: me.id,
            _target_username: username,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            return;
          }

          const res = data as { ok: boolean; error?: string; nickname?: string; username?: string; verify_status?: string; banned?: boolean };
          if (res.ok) {
            const badge = res.verify_status === "full" ? "🔵 Синяя" :
                          res.verify_status === "green" ? "🟢 Зелёная" :
                          res.verify_status === "grey" ? "⚪ Серая" : "— Нет";
            setHistory((prev) => [
              ...prev,
              { type: "info", text: `Пользователь: ${res.nickname} (@${res.username})` },
              { type: "info", text: `Галочка: ${badge}` },
              { type: "info", text: `Заблокирован: ${res.banned ? "да" : "нет"}` },
            ]);
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/set": {
          const what = parts[1];

          if (what === "ota") {
            // Всё после "/set ota" — исходная строка (URL чувствителен к регистру).
            const after = trimmed.replace(/^\/set\s+ota\s*/i, "").trim();
            if (!after) {
              setHistory((prev) => [
                ...prev,
                { type: "error", text: 'Использование: /set ota [@username] "<ссылка>" [версия] [@target|*]' },
              ]);
              break;
            }

            // Отключение OTA
            if (/^(off|clear|remove|delete|disable)$/i.test(after)) {
              const { data, error } = await supabase.rpc("set_winchat_ota", {
                _admin_id: me.id,
                _url: "",
                _version: null,
                _target: null,
              });
              if (error) {
                setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
                break;
              }
              const res = data as { ok: boolean; message?: string; error?: string };
              setHistory((prev) => [
                ...prev,
                res.ok
                  ? { type: "success", text: `✓ ${res.message}` }
                  : { type: "error", text: `✗ ${res.error}` },
              ]);
              break;
            }

            // /set ota [@username] "[ссылка]" [версия] [@target|*]
            // Пример: /set ota @user "https://.../app.apk" 4.0.1
            let rest = after;
            let prefixTarget: string | null = null;
            const pre = rest.match(/^@([^\s"']+)\s+([\s\S]*)$/);
            if (pre) {
              prefixTarget = `@${pre[1]}`;
              rest = pre[2].trim();
            }

            const urlM = /https?:\/\/[^\s"']+/i.exec(rest);
            const url = urlM ? urlM[0] : "";
            const remainder = urlM ? rest.slice(urlM.index + urlM[0].length).trim() : "";

            if (!url) {
              setHistory((prev) => [
                ...prev,
                { type: "error", text: 'Ссылка должна начинаться с http:// или https://' },
              ]);
              break;
            }

            // Необязательные аргументы: версия и цель
            let version: string | null = null;
            let target: string | null = null;
            for (const token of remainder.split(/\s+/).filter(Boolean)) {
              const clean = token.replace(/^["']|["']$/g, "");
              if (!version && /^\d+\.\d+(\.\d+)?(-[0-9a-z][0-9a-z.\-]*(\+[0-9a-z.\-]+)?)?$/i.test(clean)) {
                version = clean;
              } else if (!target) {
                target = clean;
              }
            }

            const finalTarget = prefixTarget ?? target ?? null;

            const { data, error } = await supabase.rpc("set_winchat_ota", {
              _admin_id: me.id,
              _url: url,
              _version: version,
              _target: finalTarget,
            });

            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              break;
            }

            const res = data as {
              ok: boolean;
              message?: string;
              error?: string;
              version?: string | null;
              target?: string;
            };
            if (!res.ok) {
              setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
              break;
            }

            setHistory((prev) => [
              ...prev,
              { type: "success", text: `✓ ${res.message}` },
              { type: "info", text: `URL: ${url}` },
              { type: "info", text: `Версия: ${res.version ?? "не указана"} · Цель: ${res.target ?? "*"}` },
            ]);

            // Если задана конкретная цель (например, @username) — открываем выбор устройства.
            if (url && finalTarget && finalTarget !== "*") {
              void openOtaPicker(finalTarget, url, version);
            }
            break;
          }

          if (what !== "version") {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: 'Использование: /set version <X.Y.Z[-beta]> | /set ota [@username] "<ссылка>" [версия]' },
            ]);
            return;
          }
          // Версия берётся из исходной строки — toLowerCase() не нужен,
          // но и не вредит: цифры и точки регистронезависимы.
          const rawVersion = trimmed.split(/\s+/).slice(2).join("").trim();
          if (!rawVersion || !/^\d+\.\d+(\.\d+)?(-[0-9a-z][0-9a-z.\-]*(\+[0-9a-z.\-]+)?)?$/i.test(rawVersion)) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Неверный формат версии. Пример: /set version 4.0.0-beta" },
            ]);
            return;
          }

          const { data, error } = await supabase.rpc("set_wintozo_version", {
            _admin_id: me.id,
            _version: rawVersion,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            return;
          }

          const res = data as { ok: boolean; message?: string; error?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/get": {
          const what = parts[1];
          if (what === "winpass") {
            const username = parts[2]?.replace("@", "");
            if (!username) {
              setHistory((prev) => [
                ...prev,
                { type: "error", text: "Использование: /get winpass @username" },
              ]);
              return;
            }

            const { data, error } = await supabase.rpc("admin_get_winpass", {
              _admin_id: me.id,
              _target_username: username,
            });

            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              return;
            }

            const res = data as {
              ok: boolean;
              error?: string;
              nickname?: string;
              username?: string;
              winpass?: string | null;
            };
            if (!res.ok) {
              setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
              break;
            }
            if (!res.winpass) {
              setHistory((prev) => [
                ...prev,
                { type: "info", text: `У @${res.username} WinPass ещё нет — выдаю новый…` },
              ]);
              // Выдать код существующему аккаунту через серверный генератор (формат 33b42 + строчные hex)
              const { data: newCode, error: genErr } = await supabase.rpc("generate_winpass");
              if (genErr || !newCode) {
                setHistory((prev) => [
                  ...prev,
                  { type: "error", text: `Не удалось сгенерировать WinPass: ${genErr?.message || "пустой ответ"}` },
                ]);
                break;
              }
              const { error: setErr } = await supabase
                .from("profiles")
                .update({ winpass: newCode as string })
                .eq("username", username);
              if (setErr) {
                setHistory((prev) => [
                  ...prev,
                  { type: "error", text: `Не удалось выдать WinPass: ${setErr.message}` },
                ]);
                break;
              }
              setHistory((prev) => [
                ...prev,
                { type: "success", text: `✓ WinPass выдан: ${newCode}` },
              ]);
              break;
            }
            setHistory((prev) => [
              ...prev,
              { type: "info", text: `${res.nickname} (@${res.username})` },
              { type: "success", text: `WinPass: ${res.winpass}` },
            ]);
            break;
          }

          if (what === "version") {
            const { data, error } = await supabase.rpc("get_wintozo_version");
            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              return;
            }
            setHistory((prev) => [
              ...prev,
              { type: "success", text: `✓ Текущая версия приложения: ${data}` },
            ]);
            break;
          }

          if (what === "ota") {
            const { data, error } = await supabase.rpc("get_winchat_ota", {
              _admin_id: me.id,
            });
            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              break;
            }
            const res = data as {
              ok: boolean;
              error?: string;
              url?: string | null;
              version?: string | null;
              target?: string;
            };
            if (!res.ok) {
              setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
              break;
            }
            if (!res.url) {
              setHistory((prev) => [
                ...prev,
                { type: "info", text: 'OTA не настроена. Используйте /set ota [@username] "<ссылка>" [версия]' },
              ]);
              break;
            }
            setHistory((prev) => [
              ...prev,
              { type: "info", text: `OTA URL: ${res.url}` },
              { type: "info", text: `Версия: ${res.version ?? "не указана"}` },
              { type: "info", text: `Цель: ${res.target ?? "*"}` },
            ]);
            break;
          }

          if (what === "devices") {
            const { data, error } = await supabase.rpc("get_winchat_ota_devices", {
              _admin_id: me.id,
              _limit: 20,
            });
            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              break;
            }
            const res = data as {
              ok: boolean;
              error?: string;
              devices?: Array<{
                device_id: string;
                is_wintozo_web: boolean;
                status: string | null;
                platform: string | null;
                app_version: string | null;
                model: string | null;
                manufacturer: string | null;
                os_version: string | null;
                username: string | null;
              }>;
            };
            if (!res.ok) {
              setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
              break;
            }
            const devices = res.devices ?? [];
            if (!devices.length) {
              setHistory((prev) => [
                ...prev,
                { type: "info", text: "Устройства пока не регистрировались" },
              ]);
              break;
            }
            setHistory((prev) => [
              ...prev,
              { type: "info", text: `═══ Устройства (${devices.length}) ═══` },
              ...devices.map((d) => ({
                type: "info" as const,
                text: `${d.username ? `@${d.username}` : "—"} · ${[d.manufacturer, d.model].filter(Boolean).join(" ") || d.platform || "устройство"} · ${
                  d.status ?? (d.is_wintozo_web ? "is_wintozo_web_true" : "is_wintozo_web_no")
                } · v${d.app_version ?? "?"} · ${d.device_id}`,
              })),
            ]);
            break;
          }

          if (what === "badges") {
            const username = parts[2]?.replace("@", "");
            if (!username) {
              setHistory((prev) => [
                ...prev,
                { type: "error", text: "Использование: /get badges @username" },
              ]);
              break;
            }

            const { data, error } = await supabase.rpc("get_user_badges", {
              _target_username: username,
            });

            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              break;
            }

            const res = data as { ok: boolean; codes?: number[] };
            if (!res.ok) {
              setHistory((prev) => [...prev, { type: "error", text: "✗ Не удалось получить бейджи" }]);
              break;
            }
            const labels = (res.codes ?? []).map((c) => BADGE_LABELS[c]).filter(Boolean);
            setHistory((prev) => [
              ...prev,
              { type: "info", text: labels.length ? `Бейджи @${username}: ${labels.join(", ")}` : `У @${username} бейджей пока нет` },
            ]);
            break;
          }

          setHistory((prev) => [
            ...prev,
            { type: "error", text: "Использование: /get winpass @username | /get version | /get ota | /get devices | /get badges @username" },
          ]);
          break;
        }

        case "/clear": {
          setHistory([{ type: "info", text: "WinChat Admin Terminal v2.0" }]);
          break;
        }

        case "/give": {
          const feature = parts[1];
          if (feature === "badge") {
            const badgeUsername = parts[2]?.replace("@", "");
            const badgeCode = parseInt(parts[3] || "0", 10);
            const badgeLabel = BADGE_LABELS[badgeCode];
            if (!badgeUsername || !badgeLabel) {
              setHistory((prev) => [
                ...prev,
                { type: "error", text: "Использование: /give badge @username <1|2|3>" },
              ]);
              break;
            }
            const { data, error } = await supabase.rpc("give_badge", {
              _admin_id: me.id,
              _target_username: badgeUsername,
              _code: badgeCode,
            });
            if (error) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
              break;
            }
            const badgeRes = data as { ok: boolean; message?: string; error?: string; code?: number };
            if (badgeRes.ok) {
              const badgeResCode = badgeRes.code ?? badgeCode;
              setHistory((prev) => [
                ...prev,
                { type: "success", text: `✓ Бейдж ${badgeResCode} (@${badgeUsername}) выдан — ${BADGE_LABELS[badgeResCode] ?? ""}` },
              ]);
              onProfileUpdated();
            } else {
              setHistory((prev) => [...prev, { type: "error", text: `✗ ${badgeRes.error}` }]);
            }
            break;
          }
          if (feature !== "wintozopro") {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /give wintozopro @username X" },
            ]);
            break;
          }
          const username = parts[2]?.replace("@", "");
          const days = parseInt(parts[3] || "0", 10);
          if (!username || !days || days < 1) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /give wintozopro @username X (X — число дней)" },
            ]);
            break;
          }

          const { data, error } = await supabase.rpc("give_winpro", {
            _admin_id: me.id,
            _target_username: username,
            _days: days,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            break;
          }

          const res = data as { ok: boolean; message?: string; error?: string; expires?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
            onProfileUpdated();
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/delete": {
          const feature = parts[1];
          if (feature !== "wintozopro") {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /delete wintozopro @username" },
            ]);
            break;
          }
          const username = parts[2]?.replace("@", "");
          if (!username) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /delete wintozopro @username" },
            ]);
            break;
          }

          const { data, error } = await supabase.rpc("delete_winpro", {
            _admin_id: me.id,
            _target_username: username,
          });

          if (error) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${error.message}` }]);
            break;
          }

          const res = data as { ok: boolean; message?: string; error?: string };
          if (res.ok) {
            setHistory((prev) => [...prev, { type: "success", text: `✓ ${res.message}` }]);
            onProfileUpdated();
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${res.error}` }]);
          }
          break;
        }

        case "/channel": {
          const action = parts[1];
          const allowed = ["list", "verify", "unverify", "official", "unofficial", "delete"];
          if (!action || !allowed.includes(action)) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /channel list | verify | unverify | official | unofficial | delete <id|название>" },
            ]);
            break;
          }

          const { data: listData, error: listErr } = await supabase.rpc("list_winchat_channels", {
            _user_id: me.id,
          });
          if (listErr) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${listErr.message}` }]);
            break;
          }
          const listRes = listData as {
            ok: boolean;
            error?: string;
            channels?: Array<{
              id: string;
              title: string | null;
              verified: boolean;
              is_official: boolean;
              subscribers: number;
            }>;
          };
          if (!listRes.ok) {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${listRes.error}` }]);
            break;
          }
          const channels = listRes.channels || [];

          if (action === "list") {
            if (!channels.length) {
              setHistory((prev) => [...prev, { type: "info", text: "Каналов пока нет" }]);
              break;
            }
            setHistory((prev) => [
              ...prev,
              { type: "info", text: `═══ Каналы (${channels.length}) ═══` },
              ...channels.map((c) => ({
                type: "info" as const,
                text: `${c.is_official ? "★ " : ""}${c.title || "Без названия"} — ${c.id} · ${c.subscribers} подписчиков${c.verified ? " · ✓ синяя" : ""}`,
              })),
            ]);
            break;
          }

          const target = parts.slice(2).join(" ");
          if (!target) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Укажите id или название канала" },
            ]);
            break;
          }

          const found = channels.find(
            (c) => c.id === target || (c.title || "").toLowerCase() === target
          );
          if (!found) {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: `Канал не найден: ${target}. Используйте /channel list` },
            ]);
            break;
          }

          if (action === "delete") {
            const { data: delData, error: delErr } = await supabase.rpc("delete_winchat_ch", {
              _user_id: me.id,
              _chat_id: found.id,
            });
            if (delErr) {
              setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${delErr.message}` }]);
              break;
            }
            const delRes = delData as { ok: boolean; error?: string };
            if (delRes.ok) {
              setHistory((prev) => [
                ...prev,
                { type: "success", text: `✓ Канал «${found.title}» удалён` },
              ]);
              onProfileUpdated();
            } else {
              setHistory((prev) => [...prev, { type: "error", text: `✗ ${delRes.error}` }]);
            }
            break;
          }

          const verifyArg = action === "verify" ? true : action === "unverify" ? false : null;
          const officialArg =
            action === "official" ? true : action === "unofficial" ? false : null;

          const { data: editData, error: editErr } = await supabase.rpc("edit_wintozo_channel", {
            _user_id: me.id,
            _chat_id: found.id,
            _title: null,
            _description: null,
            _avatar_url: null,
            _verified: verifyArg,
            _is_official: officialArg,
          });
          if (editErr) {
            setHistory((prev) => [...prev, { type: "error", text: `Ошибка: ${editErr.message}` }]);
            break;
          }
          const editRes = editData as { ok: boolean; error?: string };
          if (editRes.ok) {
            const labels: Record<string, string> = {
              verify: "выдана синяя галочка",
              unverify: "галочка снята",
              official: "канал стал официальным",
              unofficial: "статус официального снят",
            };
            setHistory((prev) => [
              ...prev,
              { type: "success", text: `✓ «${found.title}»: ${labels[action]}` },
            ]);
            onProfileUpdated();
          } else {
            setHistory((prev) => [...prev, { type: "error", text: `✗ ${editRes.error}` }]);
          }
          break;
        }

        default:
          setHistory((prev) => [
            ...prev,
            { type: "error", text: `Неизвестная команда: ${cmd}. Введите /help для списка` },
          ]);
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { type: "error", text: `Непредвиденная ошибка: ${(err as Error).message}` },
      ]);
    }
  }

  if (!open) return null;

  /* ---------- Окно выбора устройства для OTA-обновления ---------- */
  if (otaPicker) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#0d1117] text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-400" />
              <span className="font-mono text-sm font-bold">Выбор устройства</span>
            </div>
            <button
              onClick={() => setOtaPicker(null)}
              className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px]">
            <p className="mb-3 text-white/60">
              Цель: <span className="text-green-400">{otaPicker.target}</span>
              {otaPicker.version ? <span className="text-white/40"> · Версия: {otaPicker.version}</span> : null}
            </p>
            {otaPickerDevices.length === 0 ? (
              <p className="text-white/60">Устройства не найдены для этой цели</p>
            ) : (
              otaPickerDevices.map((d, i) => (
                <button
                  key={d.device_id}
                  onClick={() => void selectOtaDevice(d.device_id, otaPicker.url, otaPicker.version)}
                  disabled={otaPickerBusy}
                  className="mb-2 block w-full rounded-xl bg-white/5 px-3 py-2 text-left transition hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="font-bold text-green-400">{i + 1}.</span>{" "}
                  {d.username ? `@${d.username}` : "—"}
                  {" · "}
                  {[d.manufacturer, d.model].filter(Boolean).join(" ") || d.platform || "устройство"}
                  {" · "}
                  {d.status ?? (d.is_wintozo_web ? "is_wintozo_web_true" : "is_wintozo_web_no")}
                  {" · v"}
                  {d.app_version ?? "?"}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-white/10 bg-[#0d1117] px-4 py-3">
            <button
              onClick={() => setOtaPicker(null)}
              className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs font-bold transition hover:bg-white/20"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#0d1117] text-white shadow-2xl ring-1 ring-white/10">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-green-400" />
            <span className="font-mono text-sm font-bold">Admin Terminal</span>
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 font-mono text-[10px] text-green-400">
              @{me.username}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Лента */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">
          {history.map((entry, i) => (
            <div key={i} className="mb-1">
              {entry.type === "input" && (
                <span className="text-white/90">
                  <span className="text-green-400">$ </span>
                  {entry.text}
                </span>
              )}
              {entry.type === "success" && <span className="text-green-400">{entry.text}</span>}
              {entry.type === "error" && <span className="text-red-400">{entry.text}</span>}
              {entry.type === "info" && <span className="text-blue-300">{entry.text}</span>}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Ввод */}
        <div className="border-t border-white/10 bg-[#0d1117] px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runCommand(input);
            }}
            className="flex items-center gap-2"
          >
            <span className="font-mono text-sm text-green-400">$</span>
            <input
              id="admin-term-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Введите команду..."
              className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/30"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs font-bold transition hover:bg-white/20"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
