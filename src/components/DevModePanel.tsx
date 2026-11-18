import { useEffect, useState } from "react";
import { Bug, Check, Copy, Download, Loader2, Power, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import {
  clearLogs,
  getLogLines,
  getLogText,
  saveLogs,
  subscribeLogs,
} from "../lib/devLogs";
import {
  isMonoEnabled,
  setDevMode,
  setMonoEnabled,
  subscribeDevMode,
} from "../lib/devMode";

interface Props {
  className?: string;
  /** Режим WinChat You — подстроить рамки под тона темы. */
  you?: boolean;
}

/** Панель «Режим разработчика»: однотонный интерфейс и логи. */
export default function DevModePanel({ className, you = false }: Props) {
  const [mono, setMono] = useState<boolean>(() => isMonoEnabled());
  const [lines, setLines] = useState<string[]>(() => getLogLines().slice(-80));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(
    () => subscribeLogs(() => setLines(getLogLines().slice(-80))),
    []
  );

  useEffect(
    () => subscribeDevMode(() => setMono(isMonoEnabled())),
    []
  );

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await saveLogs();
      setStatus({ ok: res.ok, text: res.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const text = getLogText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* no-op */
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const card = you
    ? "border-[var(--you-outline-variant)] bg-[var(--you-surface-high)]"
    : "border-black/8 bg-white/60";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Заголовок */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border p-4",
          you ? card : "border-black/8 bg-gradient-to-br from-black/[0.04] to-black/[0.01]"
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            you
              ? "bg-[var(--you-primary)] text-[var(--you-on-primary)]"
              : "bg-ink text-white"
          )}
        >
          <Bug className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold tracking-tight">Режим разработчика</p>
          <p className="text-[11px] font-medium leading-snug text-black/45">
            Скрытые инструменты WinChat: монохромный интерфейс и логи
          </p>
        </div>
      </div>

      {/* Однотонный интерфейс */}
      <button
        type="button"
        onClick={() => setMonoEnabled(!mono)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99]",
          card,
          "hover:bg-black/[0.02]"
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 text-ink">
          <span className="h-4 w-4 rounded-full border-2 border-current bg-gradient-to-br from-white to-black" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-ink">Однотонный интерфейс</span>
          <span className="block text-[11px] font-medium text-black/40">
            Убирает все цвета — только оттенки серого
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition",
            mono ? "bg-ink" : "bg-black/15"
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
              mono ? "left-[22px]" : "left-0.5"
            )}
          />
        </span>
      </button>

      {/* Логи */}
      <div className={cn("overflow-hidden rounded-2xl border", card)}>
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-2.5">
          <span className="text-[12px] font-bold text-black/50">
            Логи · {lines.length ? `${Math.min(lines.length, 80)} последних` : "пусто"}
          </span>
          <button
            type="button"
            onClick={() => {
              clearLogs();
              setStatus(null);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-black/45 transition hover:bg-black/5 hover:text-ink"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Очистить
          </button>
        </div>
        <pre className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap break-words text-black/65">
          {lines.length ? lines.join("\n") : "Пока нет записей"}
        </pre>
      </div>

      {/* Действия */}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-50",
          you
            ? "bg-[var(--you-primary)] text-[var(--you-on-primary)]"
            : "bg-ink text-white hover:bg-black"
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Скачать логи
      </button>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] font-bold transition active:scale-[0.99]",
          card,
          "text-ink hover:bg-black/[0.03]"
        )}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? "Скопировано" : "Скопировать логи"}
      </button>

      {status && (
        <p
          className={cn(
            "rounded-xl border px-3.5 py-2.5 font-mono text-[11px] font-semibold break-all",
            status.ok
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
              : "border-red-500/25 bg-red-500/5 text-red-600"
          )}
        >
          {status.text}
        </p>
      )}

      <p className="px-1 font-mono text-[10.5px] leading-relaxed text-black/35">
        На Android файл сохраняется в /sdcard/WinChat/logs/log.txt. Если система не разрешает
        запись в корень — используется доступная папка, путь показывается выше.
      </p>

      <button
        type="button"
        onClick={() => setDevMode(false)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-2.5 text-[13px] font-bold text-red-600 transition hover:bg-red-500/5 active:scale-[0.99]"
      >
        <Power className="h-4 w-4" />
        Выключить режим разработчика
      </button>
    </div>
  );
}
