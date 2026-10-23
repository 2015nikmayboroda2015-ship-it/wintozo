import { useEffect, useRef, useState } from "react";
import { Terminal, X } from "lucide-react";
import { supabase, type Profile } from "../lib/supabase";

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

export default function AdminTerminal({ me, open, onClose, onProfileUpdated }: Props) {
  const [history, setHistory] = useState<LogEntry[]>([
    { type: "info", text: "WinChat Admin Terminal v2.0" },
    { type: "info", text: "Введите /help для списка команд" },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  useEffect(() => {
    if (open) {
      const el = document.getElementById("admin-term-input");
      el?.focus();
    }
  }, [open]);

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

        case "/get": {
          const what = parts[1];
          if (what !== "winpass") {
            setHistory((prev) => [
              ...prev,
              { type: "error", text: "Использование: /get winpass @username" },
            ]);
            return;
          }
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

        case "/clear": {
          setHistory([{ type: "info", text: "WinChat Admin Terminal v2.0" }]);
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
