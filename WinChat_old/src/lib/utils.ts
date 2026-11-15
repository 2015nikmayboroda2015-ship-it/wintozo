/* ---------- Валидация ---------- */

export function validateNickname(v: string): string | null {
  const s = v.trim();
  if (!s) return "Введите никнейм";
  if (s.length < 2) return "Никнейм — минимум 2 символа";
  if (s.length > 32) return "Никнейм — максимум 32 символа";
  if (!/^[A-Za-zА-Яа-яЁё0-9 _-]+$/.test(s))
    return "Только русские и английские буквы, цифры, пробел, «-» и «_»";
  return null;
}

export function validateUsername(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (!s) return "Введите username";
  if (!/^[a-z0-9_.]+$/.test(s)) return "Только английские строчные буквы, цифры, «_» и «.»";
  if (s.length < 3) return "Username — минимум 3 символа";
  if (s.length > 24) return "Username — максимум 24 символа";
  return null;
}

export function validatePassword(v: string): string | null {
  if (!v) return "Введите пароль";
  if (v.length < 6) return "Пароль — минимум 6 символов";
  if (!/^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};:,.<>/?]+$/.test(v))
    return "Только английские буквы, цифры и символы";
  if (!/[A-Za-z]/.test(v)) return "Пароль должен содержать английские буквы";
  return null;
}

/* ---------- Форматирование ---------- */

const RU_MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(iso, now.toISOString())) return "Сегодня";
  if (sameDay(iso, yesterday.toISOString())) return "Вчера";
  const base = `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Детерминированная «волна» для голосового сообщения. */
export function waveform(seed: string, bars = 34): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push(0.25 + ((h >>> 8) % 1000) / 1000 * 0.75);
  }
  return out;
}

export function validateBio(v: string): string | null {
  if (v.length > 160) return "Описание — максимум 160 символов";
  return null;
}

export function validateGroupTitle(v: string): string | null {
  const s = v.trim();
  if (!s) return "Введите название группы";
  if (s.length < 2) return "Название — минимум 2 символа";
  if (s.length > 48) return "Название — максимум 48 символов";
  return null;
}

/* ---------- Аватары ---------- */

const GRADIENTS: Array<[string, string]> = [
  ["#2b4fff", "#87a1ff"],
  ["#ff5c39", "#ffb199"],
  ["#0ea47a", "#6ee7b7"],
  ["#7c3aed", "#c4b5fd"],
  ["#e8930c", "#fcd34d"],
  ["#db2777", "#f9a8d4"],
  ["#0284c7", "#7dd3fc"],
  ["#1f2937", "#9ca3af"],
];

export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "W";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

/** Ключ личного чата из двух id (порядок не важен). */
export function directKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/**
 * UUID v4, который работает везде:
 * crypto.randomUUID (HTTPS) → crypto.getRandomValues → Math.random.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (typeof crypto.getRandomValues === "function") {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h: string[] = [];
      b.forEach((v) => h.push(v.toString(16).padStart(2, "0")));
      return (
        h.slice(0, 4).join("") + "-" + h.slice(4, 6).join("") + "-" +
        h.slice(6, 8).join("") + "-" + h.slice(8, 10).join("") + "-" +
        h.slice(10, 16).join("")
      );
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
