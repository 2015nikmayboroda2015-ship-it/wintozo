import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  AtSign,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { emailFor, loginByWinpass, supabase } from "../lib/supabase";
import { mapAuthError } from "./Auth";
import { rememberLegacyPassword } from "./LegacyScreen";
import { normalizeWinpass, validateNickname, validatePassword, validateUsername } from "../lib/utils";
import { cn } from "../utils/cn";
import { OobeButton } from "./OobeUpdate";
import type { Profile } from "../lib/supabase";

interface Props {
  /** Есть ли сессия (во время проверки профиля профиль ещё null). */
  hasSession: boolean;
  /** Профиль текущего пользователя (null, пока грузится). */
  profile: Profile | null;
  /** Завершить OOBE и открыть мессенджер. */
  onFinish: () => void;
}

type Step = "welcome" | "auth" | "winpass" | "checking" | "success";

/**
 * OOBE первого скачивания WinChat: приветствие → Liquid Glass регистрация
 * / вход → экран «Проверка..» → финал «WinChat · Продолжить».
 * Показывается на телефонах при первом запуске; на ПК — по /install_oobe.
 */
export default function OobeInstall({ hasSession, profile, onFinish }: Props) {
  const [step, setStep] = useState<Step>(() => (hasSession ? "checking" : "welcome"));
  const [mode, setMode] = useState<"register" | "login">("register");

  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [wpInput, setWpInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuedWinpass, setIssuedWinpass] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Уже вошли (сессия сохранена) → сразу проверка. */
  useEffect(() => {
    if (hasSession && step === "welcome") setStep("checking");
  }, [hasSession, step]);

  /* Профиль получен → успех проверок (бан проверяется в App). */
  useEffect(() => {
    if (step === "checking" && profile) setStep("success");
  }, [step, profile]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  /* ---------------- Аутентификация (register / login / winpass) ---------------- */
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

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

        /* Пароль нужен для моста «Память о Wintozo» */
        void rememberLegacyPassword(password);

        if (data.user && !data.session) {
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: emailFor(username),
            password,
          });
          if (siErr) return setError(mapAuthError(siErr));
        }

        /* Забрать WinPass, выданный триггером на сервере */
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
          if (code) {
            setIssuedWinpass(code);
            setStep("winpass");
            return;
          }
        }
        /* Сессия появилась — App прогрузит профиль и включится экран «Проверка..» */
        setStep("checking");
      } else {
        const { error: inErr } = await supabase.auth.signInWithPassword({
          email: emailFor(username),
          password,
        });
        if (inErr) return setError(mapAuthError(inErr));
        setStep("checking");
      }
    } catch {
      setError("Нет соединения с сервером. Проверьте интернет.");
    } finally {
      setLoading(false);
    }
  }

  async function submitWinpass(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const code = normalizeWinpass(wpInput);
    if (!code) return setError("Неверный формат WinPass. Пример: 33b42-a1b2c3d4e5f6");

    setLoading(true);
    try {
      await loginByWinpass(code);
      setStep("checking");
    } catch (errCaught) {
      setError(mapAuthError(errCaught));
    } finally {
      setLoading(false);
    }
  }

  /* Экран WinPass закрывают в «Проверка..» */
  function closeWinpass() {
    setStep("checking");
  }

  return (
    <div className="oobe-root font-app relative min-h-dvh overflow-hidden">
      {/* Живые световые пятна Liquid Glass */}
      <div className="oobe-bg" aria-hidden />

      {/* ============ ШАГ: ПРИВЕТСТВИЕ УСТАНОВКИ ============ */}
      {step === "welcome" && (
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
          <div className="animate-[oobe-pop_0.7s_cubic-bezier(0.22,1.3,0.4,1)_both] relative">
            <span
              aria-hidden
              className="absolute -inset-6 animate-[oobe-breathe_3s_ease-in-out_infinite] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, rgba(123,162,255,0.55), rgba(63,109,246,0.35) 55%, transparent 75%)",
              }}
            />
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] border border-white/90 bg-white/70 shadow-[0_30px_60px_-32px_rgba(28,60,140,0.55)] backdrop-blur-xl">
              <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
            </div>
          </div>

          <h1 className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.15s_both] mt-7 text-[30px] leading-snug font-extrabold tracking-tight text-[#101214]">
            Установка завершена!
            <span className="mt-1 block bg-gradient-to-r from-[#3f6df6] via-[#7aa2ff] to-[#5b8cff] bg-clip-text text-transparent">
              Добро пожаловать в WinChat!
            </span>
          </h1>

          <p className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.25s_both] mt-3 max-w-[300px] text-[13.5px] leading-relaxed font-semibold text-black/45">
            Ваши данные и WinPass уже на месте — теперь зайдём в аккаунт, чтобы
            продолжить общение.
          </p>

          <OobeButton onClick={() => setStep("auth")} label="Далее" />
        </div>
      )}

      {/* ============ ШАГ: РЕГИСТРАЦИЯ ИЛИ ВХОД (Liquid Glass) ============ */}
      {step === "auth" && (
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-5 py-12">
          {/* Шапка */}
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] mb-6 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-white/80 bg-white/70 shadow-lg backdrop-blur-xl">
              <img src="/logo.jpg" alt="" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-[20px] leading-none font-extrabold tracking-tight text-[#101214]">
                WinChat
              </p>
              <p className="mt-1 text-[11px] font-extrabold tracking-[0.16em] text-[#3f6df6] uppercase">
                {mode === "register" ? "Регистрация" : "Вход"}
              </p>
            </div>
          </div>

          {/* Стеклянная карточка с формой */}
          <div className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.12s_both] oobe-card p-6">
            <form onSubmit={submit} className="space-y-3.5">
              {mode === "register" && (
                <OobeField
                  icon={<UserRound className="h-4 w-4" />}
                  label="Ваше имя"
                  value={nickname}
                  onChange={setNickname}
                  placeholder="Как вас звать?"
                  maxLength={30}
                  autoFocus
                />
              )}
              <OobeField
                icon={<AtSign className="h-4 w-4" />}
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="юзернейм латиницей"
                maxLength={20}
              />
              <OobeField
                label="Пароль"
                value={password}
                onChange={setPassword}
                placeholder="минимум 6 символов"
                type={showPw ? "text" : "password"}
                maxLength={64}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#3f6df6]/80 transition hover:bg-[#3f6df6]/10"
                    aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              {error && (
                <div className="animate-fade-in flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-50/80 px-3.5 py-2.5 text-[12.5px] leading-snug font-semibold text-red-600 backdrop-blur">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="oobe-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Продолжить
                {!loading && (
                  <span className="oobe-btn-arrow">
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/10" />
              <span className="text-[10px] font-extrabold tracking-[0.18em] text-black/35 uppercase">
                или
              </span>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <button
              type="button"
              onClick={() => setMode(mode === "register" ? "login" : "register")}
              className="oobe-btn-ghost"
            >
              {mode === "register" ? "Есть аккаунт? Войти" : "Создать аккаунт"}
            </button>
          </div>

          {/* Вход по WinPass — сворачиваемая секция */}
          <WinpassGlass
            onSubmit={submitWinpass}
            value={wpInput}
            onChange={setWpInput}
            loading={loading}
          />
        </div>
      )}

      {/* ============ ШАГ: ПОДАРОК-WinPASS ============ */}
      {step === "winpass" && issuedWinpass && (
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center px-6 text-center">
          <div className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_both] oobe-card w-full p-7">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3f6df6]/10">
              <ShieldCheck className="h-8 w-8 text-[#3f6df6]" />
            </div>
            <p className="mt-4 text-[20px] font-extrabold tracking-tight text-[#101214]">
              Аккаунт создан! 🎉
            </p>
            <p className="mt-2 text-[13px] leading-relaxed font-semibold text-black/50">
              Сохраните <b>WinPass</b> — код восстановления, привязанный к аккаунту навсегда.
            </p>
            <div className="mt-5 break-all rounded-[24px] border border-black/10 bg-black/[0.04] px-4 py-4 font-mono text-lg font-extrabold text-[#101214] tracking-wide">
              {issuedWinpass}
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(issuedWinpass).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className={cn(
                "mt-3 w-full rounded-full border border-black/8 py-3 text-[13px] font-extrabold text-[#1a2434] transition active:scale-[0.98]",
                copied ? "bg-[#3f6df6] text-white" : "bg-white/70"
              )}
            >
              {copied ? "Скопировано ✓" : "Скопировать код"}
            </button>
            <OobeButton onClick={closeWinpass} label="Продолжить" />
          </div>
        </div>
      )}

      {/* ============ ШАГ: ПРОВЕРКА ============ */}
      {step === "checking" && (
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center px-6 text-center">
          <div className="animate-[oobe-pop_0.6s_cubic-bezier(0.22,1.3,0.4,1)_both] oobe-card flex flex-col items-center gap-4 rounded-full border border-white/80 bg-white/70 px-10 py-7 shadow-2xl backdrop-blur-xl">
            <span className="relative flex h-12 w-12 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#3f6df6]/20" />
              <span className="relative h-10 w-10 animate-spin rounded-full border-4 border-[#3f6df6]/20 border-t-[#3f6df6]" />
            </span>
            <p className="text-[17px] font-extrabold tracking-tight text-[#101214]">
              Проверка<span className="animate-pulse">..</span>
            </p>
            <p className="max-w-[230px] text-[12px] leading-relaxed font-semibold text-black/45">
              Проверяем аккаунт, WinPro и безопасность…
            </p>
          </div>
        </div>
      )}

      {/* ============ ШАГ: ФИНАЛ — ЛОГОТИП WINCHAT ============ */}
      {step === "success" && (
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
          <div className="animate-[oobe-pop_0.7s_cubic-bezier(0.22,1.3,0.4,1)_both] relative">
            <span
              aria-hidden
              className="absolute -inset-6 animate-[oobe-breathe_3s_ease-in-out_infinite] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, rgba(168,224,106,0.5), rgba(63,109,246,0.3) 55%, transparent 75%)",
              }}
            />
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] border border-white/90 bg-white/70 shadow-[0_30px_60px_-32px_rgba(28,60,140,0.55)] backdrop-blur-xl">
              <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
            </div>
          </div>

          <h1 className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.2s_both] mt-7 text-[40px] font-extrabold tracking-tight text-[#101214]">
            <span className="bg-gradient-to-r from-[#3f6df6] via-[#7aa2ff] to-[#8aa0c8] bg-clip-text text-transparent">
              WinChat
            </span>
          </h1>

          <OobeButton
            onClick={onFinish}
            label="Продолжить"
            className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.35s_both]"
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Стеклянное поле ввода ---------- */
function OobeField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  maxLength,
  autoFocus,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  type?: string;
  maxLength?: number;
  autoFocus?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-extrabold tracking-[0.18em] text-black/40 uppercase">
        {label}
      </span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#3f6df6]/80">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={cn("oobe-input", icon && "oobe-input-icon", trailing && "pr-11")}
        />
        {trailing}
      </span>
    </label>
  );
}

/* ---------- Вход по WinPass (сворачиваемая секция) ---------- */
function WinpassGlass({
  onSubmit,
  value,
  onChange,
  loading,
}: {
  onSubmit: (e: FormEvent) => void;
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 text-center">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="oobe-btn-ghost"
        >
          <KeyRound className="h-3.5 w-3.5 text-[#3f6df6]" />
          Войти по WinPass
        </button>
      ) : (
        <form
          onSubmit={onSubmit}
          className="animate-fade-in oobe-card rounded-[30px] p-4 text-left"
        >
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.18em] text-black/40 uppercase">
              <KeyRound className="h-3 w-3 text-[#3f6df6]" />
              WinPass
            </span>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="33b42-a1b2c3d4e5f6"
              autoComplete="off"
              className="oobe-input font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="oobe-btn-primary mt-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Войти по WinPass
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="oobe-btn-ghost mt-2"
          >
            Назад
          </button>
        </form>
      )}
    </div>
  );
}
