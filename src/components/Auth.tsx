import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  AtSign,
  CircleAlert,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Lock,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  User,
  Zap,
} from "lucide-react";
import { emailFor, loginByWinpass, supabase } from "../lib/supabase";
import { normalizeWinpass, validateNickname, validatePassword, validateUsername } from "../lib/utils";
void normalizeWinpass; // канонизация в supabase.loginByWinpass
import { cn } from "../utils/cn";

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white py-3 pr-4 pl-11 text-[15px] font-medium outline-none transition placeholder:text-black/30 focus:border-accent focus:ring-4 focus:ring-accent/15";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

const FEATURES = [
  { icon: Zap, title: "Мгновенная доставка", sub: "Realtime-сообщения без обновления страницы" },
  { icon: ImagePlus, title: "Фотографии в чате", sub: "Отправляйте снимки прямо в диалог" },
  { icon: ShieldCheck, title: "Защита на уровне БД", sub: "Row Level Security и изолированные диалоги" },
];

/** Достаёт читаемый текст из любой ошибки (никогда не вернёт "{}"). */
function rawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err === "{}" ? "" : err;
  const e = err as Record<string, unknown>;
  for (const key of ["message", "msg", "error_description", "error"]) {
    const v = e[key];
    if (typeof v === "string" && v.trim() && v !== "{}") return v;
  }
  try {
    const s = JSON.stringify(err);
    return s === "{}" ? "" : s;
  } catch {
    return "";
  }
}

/** Переводит ошибки Supabase Auth на русский и подсказывает действие. */
function mapAuthError(err: unknown): string {
  console.error("[WinChat] ошибка авторизации:", err);
  const raw = rawMessage(err);
  const e = err as Record<string, unknown> | null;
  const code = String(e?.error_code ?? e?.code ?? "");
  const t = `${code} ${raw}`.toLowerCase();

  if (t.includes("failed to fetch") || t.includes("network") || t.includes("load failed"))
    return "Нет соединения с сервером. Проверьте интернет и что проект Supabase не на паузе.";
  if (t.includes("rate limit") || t.includes("over_request_rate_limit") || t.includes("too many"))
    return "Слишком много попыток. Подождите пару минут и повторите.";
  if (t.includes("signup_disabled") || t.includes("email_provider_disabled") || t.includes("signups not allowed"))
    return "Регистрация отключена на сервере. В Supabase включите провайдер Email: Authentication → Sign In / Providers.";
  if (t.includes("database error") || t.includes("unexpected_failure") || t.includes("error saving"))
    return "Сервер не смог создать профиль. Выполните целиком SQL из файла winchat_setup.sql — особенно шаг 5 (триггер handle_new_user).";
  if (t.includes("already registered") || t.includes("already exists") || t.includes("user_already_exists"))
    return "Такой аккаунт уже существует — войдите.";
  if (t.includes("invalid login credentials"))
    return "Неверный username или пароль.";
  if (t.includes("email_address_invalid") || (t.includes("invalid") && t.includes("email")))
    return "Supabase отклонил служебную почту аккаунта. Проверьте настройки Email-провайдера в разделе Authentication.";
  if (t.includes("weak_password") || (t.includes("password") && (t.includes("least") || t.includes("short") || t.includes("weak"))))
    return "Пароль слишком простой — минимум 6 символов с английскими буквами.";
  if (raw) return raw;
  return "Сервер вернул пустой ответ об ошибке. Проверьте: 1) SQL из winchat_setup.sql выполнен целиком; 2) включён провайдер Email; 3) отключено «Confirm email». Подробности — в консоли браузера.";
}

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register" | "winpass">("login");
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverOk, setServerOk] = useState<"checking" | "ok" | "fail">("checking");
  /* WinPass */
  const [wpInput, setWpInput] = useState("");
  const [issuedWinpass, setIssuedWinpass] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Проверка: выполнен ли SQL на сервере (таблица profiles существует) */
  useEffect(() => {
    let alive = true;
    supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .then(({ error: pingErr }) => {
        if (alive) setServerOk(pingErr ? "fail" : "ok");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const uErr = validateUsername(username);
    if (uErr) return setError(uErr);
    const pErr = validatePassword(password);
    if (pErr) return setError(pErr);

    setLoading(true);
    try {
      if (mode === "register") {
        const nErr = validateNickname(nickname);
        if (nErr) return setError(nErr);

        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", username.trim())
          .maybeSingle();
        if (taken) return setError("Такой username уже занят");

        const { data, error: upErr } = await supabase.auth.signUp({
          email: emailFor(username),
          password,
          options: {
            data: { username: username.trim().toLowerCase(), nickname: nickname.trim() },
          },
        });
        if (upErr) return setError(mapAuthError(upErr));

        /* При включённом «Confirm email» gotrue не выдаёт сессию */
        if (data.user && !data.session) {
          if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return setError("Такой аккаунт уже существует — войдите");
          }
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: emailFor(username),
            password,
          });
          if (siErr) {
            return /email not confirmed/i.test(rawMessage(siErr))
              ? setNotice(
                  "Аккаунт создан. Осталось отключить «Confirm email»: Supabase → Authentication → Sign In / Providers → Email → Save. После этого входите."
                )
              : setError(mapAuthError(siErr));
          }
        }

        /* Забрать WinPass, который выдал триггер на сервере */
        const uid = data.user?.id;
        if (uid) {
          let code: string | null = null;
          for (let attempt = 0; attempt < 5 && !code; attempt++) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("winpass")
              .eq("id", uid)
              .maybeSingle();
            code = (prof as { winpass?: string } | null)?.winpass || null;
            if (!code) await new Promise((r) => setTimeout(r, 400));
          }
          if (code) setIssuedWinpass(code);
        }
      } else {
        const { error: inErr } = await supabase.auth.signInWithPassword({
          email: emailFor(username),
          password,
        });
        if (inErr) return setError(mapAuthError(inErr));
      }
    } catch (errCaught) {
      setError(mapAuthError(errCaught));
    } finally {
      setLoading(false);
    }
  }

  async function submitWinpass(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const code = normalizeWinpass(wpInput);
    if (!code) return setError("Неверный формат WinPass. Пример: 33b42-a1b2c3d4e5f6");

    setLoading(true);
    try {
      // Вход по WinPass без пароля — сервер сам сбрасывает пароль и выдаёт сессию
      await loginByWinpass(code);
    } catch (errCaught) {
      setError(mapAuthError(errCaught));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Экран-подарок: выданный WinPass ---------- */
  if (issuedWinpass) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-5">
        <div className="animate-scale-in w-full max-w-[420px] rounded-[28px] bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-accent-soft">
            <ShieldCheck className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Аккаунт создан!</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-black/50">
            Сохраните <b>WinPass</b> — это ваш код восстановления. Он навсегда привязан к аккаунту и
            поможет войти, если вы забудете пароль.
          </p>

          <div className="relative mt-6 rounded-2xl border border-dashed border-accent/40 bg-accent-soft px-4 py-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent/70">
              Ваш WinPass
            </p>
            <p className="mt-2 break-all font-mono text-lg font-extrabold text-ink">
              {issuedWinpass}
            </p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(issuedWinpass).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className={cn(
              "mt-4 w-full rounded-xl py-3 text-sm font-bold transition active:scale-[0.99]",
              copied ? "bg-emerald-500 text-white" : "bg-ink text-white hover:bg-black"
            )}
          >
            {copied ? "Скопировано ✓" : "Скопировать код"}
          </button>

          <button
            onClick={() => setIssuedWinpass(null)}
            className="mt-3 w-full rounded-xl border border-black/10 py-3 text-sm font-bold text-black/60 transition hover:bg-black/5"
          >
            Войти в мессенджер
          </button>
          <p className="mt-4 text-[11px] font-semibold text-black/35">
            После закрытия окна код можно посмотреть в Настройках профиля.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      {/* ---- Брендовая панель ---- */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex xl:w-1/2 xl:p-16">
        <div className="dot-grid absolute inset-0 opacity-70" />
        <div className="animate-drift absolute -right-40 -bottom-44 h-[520px] w-[520px] rounded-full bg-accent/50 blur-[150px]" />
        <div
          className="animate-drift absolute -top-32 -left-28 h-96 w-96 rounded-full bg-white/10 blur-[130px]"
          style={{ animationDelay: "-7s" }}
        />

        <header className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-extrabold text-ink">
            W
          </div>
          <span className="text-xl font-extrabold tracking-tight">WinChat</span>
        </header>

        <div className="relative">
          <h1 className="max-w-xl text-[56px] leading-[1.02] font-extrabold tracking-[-0.035em] xl:text-[68px]">
            Пишите.
            <br />
            Делитесь.
            <br />
            <span className="text-accent">В моменте.</span>
          </h1>
          <ul className="mt-12 space-y-4">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                  <Icon className="h-5 w-5 text-white/85" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[15px] font-bold">{title}</p>
                  <p className="text-[13px] font-medium text-white/45">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" />
      </aside>

      {/* ---- Форма ---- */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="dot-grid-dark absolute inset-0 opacity-40 lg:hidden" />
        <div className="animate-slide-up relative w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lg font-extrabold text-white">
              W
            </div>
            <span className="text-xl font-extrabold tracking-tight">WinChat</span>
          </div>

          <h2 className="text-[28px] font-extrabold tracking-tight">
            {mode === "login" ? "С возвращением" : "Создать аккаунт"}
          </h2>
          <p className="mt-1 text-sm font-medium text-black/45">
            {mode === "login"
              ? "Войдите в свой аккаунт"
              : "Никнейм, username и пароль"}
          </p>

          {serverOk === "fail" && (
            <div className="animate-fade-in mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed font-semibold text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Сервер не настроен: таблица <span className="font-mono">profiles</span> не найдена.
                Выполните целиком <span className="font-mono">winchat_setup.sql</span> в SQL Editor
                проекта Supabase — иначе регистрация не заработает.
              </span>
            </div>
          )}

          <div className="mt-7 flex rounded-xl bg-black/5 p-1">
            {([
              ["login", "Вход"],
              ["register", "Регистрация"],
              ["winpass", "По WinPass"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-bold transition",
                  mode === m
                    ? "bg-ink text-white shadow-sm"
                    : "text-black/45 hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={mode === "winpass" ? submitWinpass : submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Никнейм">
                <div className="relative">
                  <User className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-black/35" />
                  <input
                    className={inputCls}
                    placeholder="Как вас видят люди"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    autoComplete="nickname"
                  />
                </div>
              </Field>
            )}

            {mode === "winpass" && (
              <Field label="WinPass">
                <div className="relative">
                  <KeyRound className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-black/35" />
                  <input
                    className={cn(inputCls, "font-mono")}
                    placeholder="33b42-a1b2c3d4e5f6"
                    value={wpInput}
                    onChange={(e) => setWpInput(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <p className="mt-1.5 text-xs font-medium text-black/40">
                  Код восстановления, полученный при регистрации
                </p>
              </Field>
            )}

            {(mode === "login" || mode === "register") && (
              <Field label="Username">
                <div className="relative">
                  <AtSign className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-black/35" />
                  <input
                    className={cn(inputCls, "font-mono")}
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    autoComplete="username"
                  />
                </div>
                {mode === "register" && (
                  <p className="mt-1.5 text-xs font-medium text-black/40">
                    Английские строчные буквы, цифры, «_» и «.»
                  </p>
                )}
              </Field>
            )}

            {(mode === "login" || mode === "register") && (
              <Field label="Пароль">
                <div className="relative">
                  <Lock className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-black/35" />
                  <input
                    className={cn(inputCls, "pr-11")}
                    type={showPw ? "text" : "password"}
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-black/35 transition hover:bg-black/5 hover:text-ink"
                    aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            )}

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-600 animate-fade-in">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm font-semibold text-accent animate-fade-in">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 text-[15px] font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Войти" : mode === "register" ? "Создать аккаунт" : "Войти по WinPass"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
