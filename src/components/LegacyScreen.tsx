/// <reference types="vite/client" />
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
// legacy-bundle.js — собранный старый интерфейс Wintozo (scripts/build-legacy.mjs).
// ?raw даёт содержимое строкой, которую мы загружаем в iframe через srcdoc.
import legacyBundle from "../legacy/legacy-bundle.js?raw";
import { chooseLegacyUi } from "../lib/checkVersion";
import type { Profile } from "../lib/supabase";

interface Props {
  me: Profile;
  /** Пользователь решил остаться в новом интерфейсе WinChat. */
  onStayNew: () => void;
  /** Пропустить плашку выбора (роут /events/themes/wintozo/*). */
  skipAsk?: boolean;
}

/** Ключ шифрования пароля для legacy-моста (один на устройство). */
const PW_KEY = "winchat_pw_v1";

/** Превратить «случайные» байты в стабильный AES-ключ WebCrypto. */
async function deriveKey(secretBytes: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("winchat_legacy_bridge"),
      iterations: 100000,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPassword(password: string): Promise<string | null> {
  try {
    let secret = localStorage.getItem(PW_KEY);
    if (!secret) {
      const rnd = crypto.getRandomValues(new Uint8Array(32));
      secret = Array.from(rnd)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      localStorage.setItem(PW_KEY, secret);
    }
    const key = await deriveKey(new TextEncoder().encode(secret));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(password)
    );
    const merged = new Uint8Array(iv.length + data.byteLength);
    merged.set(iv, 0);
    merged.set(new Uint8Array(data), iv.length);
    let bin = "";
    merged.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  } catch {
    return null;
  }
}

/** Получить пароль: из памяти этой сессии, иначе из зашифрованного хранилища. */
export async function getLegacyPassword(): Promise<string | null> {
  try {
    const mem = sessionStorage.getItem(PW_KEY);
    if (mem) return mem;
    const enc = localStorage.getItem(`${PW_KEY}_enc`);
    if (!enc) return null;
    const secret = localStorage.getItem(PW_KEY);
    if (!secret) return null;
    const key = await deriveKey(new TextEncoder().encode(secret));
    const bin = atob(enc);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Сохранить пароль при входе/регистрации (для моста в legacy-интерфейс). */
export async function rememberLegacyPassword(password: string): Promise<void> {
  try {
    sessionStorage.setItem(PW_KEY, password);
    const enc = await encryptPassword(password);
    if (enc) localStorage.setItem(`${PW_KEY}_enc`, enc);
  } catch {
    /* no-op */
  }
}

/** Хеш по алгоритму старого Wintozo: SHA-256(password + 'wintozo_salt_2026'). */
async function legacyHashPassword(password: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(password + "wintozo_salt_2026");
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

const DOC_HTML = `<!doctype html><html><head><base href="."><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Wintozo</title></head><body><div id="root"></div></body></html>`;

// Бандл кладём в sessionStorage, а iframe грузим через обычный src (blob:) —
// внутри about:srcdoc у react-router не получается построить location.href.
const BUNDLE_KEY = "wintozo_legacy_bundle_v1";

/**
 * URL документа с legacy-бандлом. Создаётся ОДИН раз на всё время жизни
 * приложения (кэш в module scope), поэтому хук не нужен и порядок хуков
 * в LegacyScreen всегда стабилен.
 */
let cachedDocUrl: string | null = null;

function getLegacyDocUrl(): string {
  if (cachedDocUrl) return cachedDocUrl;
  const scriptTag = "<" + "script>";
  const closeTag = "<" + "/script>";
  let html: string;
  try {
    sessionStorage.setItem(BUNDLE_KEY, legacyBundle);
    // Бандл читается из sessionStorage — сам документ остаётся крошечным.
    html =
      DOC_HTML +
      scriptTag +
      `eval(sessionStorage.getItem(${JSON.stringify(BUNDLE_KEY)}))` +
      closeTag;
  } catch {
    // sessionStorage переполнен/недоступен — инлайн бандл прямо в документ.
    html = DOC_HTML + scriptTag + legacyBundle + closeTag;
  }
  cachedDocUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  return cachedDocUrl;
}

export default function LegacyScreen({ me, onStayNew, skipAsk = false }: Props) {
  const [choice, setChoice] = useState<"ask" | "loading">(skipAsk ? "loading" : "ask");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const sessionSent = useRef(false);
  // Ключ iframe: при каждом входе в legacy создаём НОВЫЙ документ. Иначе
  // старый React остаётся живым с прошлыми вкладками/realtime-подписками,
  // и любое переключение вкладок подвешивает весь интерфейс.
  const [frameKey, setFrameKey] = useState(0);


  /** Собрать данные сессии и отправить их внутрь iframe. */
  const sendSession = useCallback(async () => {
    if (sessionSent.current) return;
    sessionSent.current = true;

    let passwordHash: string | null = null;
    const pw = await getLegacyPassword();
    if (pw) {
      passwordHash = await legacyHashPassword(pw);
    }

    const payload = {
      type: "wintozo-legacy-session",
      username: me.username.toLowerCase(),
      nickname: me.nickname,
      avatarUrl: me.avatar_url && !me.avatar_url.startsWith("#") ? me.avatar_url : null,
      passwordHash,
      device: "phone",
    };
    frameRef.current?.contentWindow?.postMessage(payload, "*");
  }, [me]);

  // Слушаем готовность legacy-документа внутри iframe.
  useEffect(() => {
    if (choice !== "loading") return;
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "wintozo-legacy-ready") void sendSession();
    };
    window.addEventListener("message", onMsg);
    // Резервная отправка, если событие уже прошло до подписки.
    const t = setTimeout(() => void sendSession(), 700);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, [choice, sendSession, frameKey]);

  /** Выход из legacy: чистим bridge-сессию внутри iframe и скрываем экран. */
  const exitToNewUi = useCallback(() => {
    try {
      const win = frameRef.current?.contentWindow as
        | (Window & { wintozoLegacyReset?: () => void })
        | null
        | undefined;
      win?.wintozoLegacyReset?.();
      win?.postMessage({ type: "wintozo-legacy-reset" }, "*");
    } catch {
      /* кросс-доменный доступ мог закрыться — не блокируем выход */
    }
    chooseLegacyUi(false);
    onStayNew();
  }, [onStayNew]);

  /* ---------- Экран выбора ---------- */
  if (choice === "ask") {
    return (
      <div className="font-app fixed inset-0 z-[70] flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-6">
        <div className="animate-scale-in w-full max-w-md rounded-[28px] bg-white/95 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg">
            <History className="h-8 w-8 text-[#1a1a2e]" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-[#1a1a2e]">
            Память о Wintozo
          </h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-black/55">
            Сервер всё ещё работает на старой версии. Вы можете вернуться в
            привычный интерфейс Wintozo или остаться с новым WinChat.
          </p>
          <button
            type="button"
            onClick={() => {
              chooseLegacyUi(true);
              sessionSent.current = false; // bridge нужно пройти заново
              setFrameKey((k) => k + 1); // свежий документ вместо «живого» прошлого UI
              setChoice("loading");
            }}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-extrabold text-[#1a1a2e] transition hover:brightness-110 active:scale-[0.99]"
          >
            Вернуться в интерфейс Wintozo
          </button>
          <button
            type="button"
            onClick={onStayNew}
            className="mt-2.5 w-full rounded-xl border border-black/10 bg-paper py-3 text-sm font-bold text-ink transition hover:bg-black/5 active:scale-[0.99]"
          >
            Остаться с новым интерфейсом
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Legacy-интерфейс (iframe со старым бандлом) ---------- */
  return (
    <div className="fixed inset-0 z-[70] bg-[#1a1a2e]">
      <iframe
        key={frameKey}
        ref={frameRef}
        title="Wintozo (legacy)"
        src={getLegacyDocUrl()}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className="h-full w-full border-0"
      />
      {/* Кнопка возврата в новый интерфейс */}
      <button
        type="button"
        onClick={exitToNewUi}
        className="font-app absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-2 text-[12px] font-bold text-white backdrop-blur transition hover:bg-black/65 active:scale-95"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        WinChat
      </button>
    </div>
  );
}

