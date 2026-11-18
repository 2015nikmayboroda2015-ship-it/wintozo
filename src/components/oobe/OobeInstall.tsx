import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  AtSign,
  Check,
  CheckCheck,
  CircleAlert,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { emailFor, loginByWinpass, supabase } from "../../lib/supabase";
import { mapAuthError } from "../Auth";
import { rememberLegacyPassword } from "../LegacyScreen";
import {
  normalizeWinpass,
  validateNickname,
  validatePassword,
  validateUsername,
} from "../../lib/utils";
import { cn } from "../../utils/cn";
import type { OobeVariant } from "./OobeThemeChooser";
import type { Profile } from "../../lib/supabase";
import {
  OobeMorphMark,
  OobeYouBackdrop,
  OobeYouButton,
  OobeYouSteps,
  OobeYouTopBar,
  useOobeShell,
  youPaletteStyle,
} from "./OobeYouKit";

interface Props {
  /** Есть ли сессия (во время проверки профиля профиль ещё null). */
  hasSession: boolean;
  /** Профиль текущего пользователя (null, пока грузится). */
  profile: Profile | null;
  /** Завершить OOBE и открыть мессенджер. */
  onFinish: () => void;
  /** Стиль OOBE (в 6.0 всегда Material You). */
  variant?: OobeVariant;
}

type Step = "welcome" | "auth" | "winpass" | "checking" | "success";

const CHECK_STEPS = ["Аккаунт", "WinPro и подписка", "Безопасность профиля"];

/**
 * OOBE первого скачивания WinChat 6.0 в стиле Material You:
 * приветствие → регистрация / вход → WinPass → проверка → финал.
 * Фон и логотип живут теми же expressive-формами, что и бут-анимация.
 */
export default function OobeInstall({
  hasSession,
  profile,
  onFinish,
  variant = "you",
}: Props) {
  const [step, setStep] = useState<Step>(() =>
    hasSession ? "checking" : "welcome",
  );
  const [mode, setMode] = useState<"register" | "login">("register");
  /** Палитра You для корня OOBE — без глобального перекрашивания темы. */
  const palette = useMemo(() => youPaletteStyle(), []);

  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [wpInput, setWpInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuedWinpass, setIssuedWinpass] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkPhase, setCheckPhase] = useState(0);

  /* Пока OOBE открыт — гасим фоновые анимации WinPro на <html>. */
  useOobeShell();

  /* Уже вошли (сессия сохранена) → сразу проверка. */
  useEffect(() => {
    if (hasSession && step === "welcome") setStep("checking");
  }, [hasSession, step]);

  /* Профиль получен → успех проверок (бан проверяется в App). */
  useEffect(() => {
    if (step === "checking" && profile) setStep("success");
  }, [step, profile]);

  /* Поэтапные статусы проверки — просто чтобы экран «жил». */
  useEffect(() => {
    if (step !== "checking") return;
    setCheckPhase(0);
    const t1 = window.setTimeout(() => setCheckPhase(1), 850);
    const t2 = window.setTimeout(() => setCheckPhase(2), 1700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [step]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const stepLabel =
    step === "welcome"
      ? "Первый запуск"
      : step === "auth"
        ? "Аккаунт"
        : step === "winpass"
          ? "WinPass"
          : step === "checking"
            ? "Проверка"
            : "Готово";

  const stepIndex =
    step === "welcome"
      ? 0
      : step === "auth" || step === "winpass"
        ? 1
        : step === "checking"
          ? 2
          : 3;

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
            data: {
              username: username.trim().toLowerCase(),
              nickname: nickname.trim(),
            },
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
    if (!code)
      return setError("Неверный формат WinPass. Пример: 33b42-a1b2c3d4e5f6");

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

  function switchMode(next: "register" | "login") {
    setMode(next);
    setError(null);
  }

  function copyWinpass() {
    if (!issuedWinpass) return;
    navigator.clipboard?.writeText(issuedWinpass).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className="theme-you oobe-you-page"
      style={palette}
      data-variant={variant}
    >
      {/* Живой фон из форм бут-анимации */}
      <OobeYouBackdrop />

      <OobeYouTopBar subtitle={stepLabel} />

      <main className="oobe-you-main">
        <OobeYouSteps value={stepIndex} total={3} />

        {/* ============ ШАГ: ПРИВЕТСТВИЕ ============ */}
        {step === "welcome" && (
          <section key="welcome" className="oobe-you-step oobe-you-center">
            <OobeMorphMark className="oobe-you-hero-mark" />

            <span className="oobe-you-eyebrow">
              <Sparkles />
              WinChat 6.0 · Material You
            </span>

            <h1 className="oobe-you-h1">
              Установка завершена
              <span className="oobe-you-grad">Добро пожаловать</span>
            </h1>

            <p className="oobe-you-lead">
              Всё готово к первому запуску. Создайте аккаунт или войдите —
              и WinChat откроется в новой теме.
            </p>

            <div className="oobe-you-actions">
              <OobeYouButton
                label="Начать"
                onClick={() => {
                  setError(null);
                  setStep("auth");
                }}
              />
              <button
                type="button"
                className="oobe-you-textbtn"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setStep("auth");
                }}
              >
                У меня уже есть аккаунт
              </button>
            </div>

            <div className="oobe-you-chips">
              <span className="oobe-you-chip">
                <Sparkles /> Живые формы
              </span>
              <span className="oobe-you-chip">
                <ShieldCheck /> Аккаунт защищён
              </span>
              <span className="oobe-you-chip">
                <CheckCheck /> Готово к работе
              </span>
            </div>
          </section>
        )}

        {/* ============ ШАГ: РЕГИСТРАЦИЯ ИЛИ ВХОД ============ */}
        {step === "auth" && (
          <section key="auth" className="oobe-you-step">
            <div className="oobe-you-head">
              <button
                type="button"
                className="oobe-you-back"
                aria-label="Назад"
                onClick={() => {
                  setError(null);
                  setStep("welcome");
                }}
              >
                <ArrowLeft />
              </button>
              <div className="oobe-you-head-copy">
                <p className="oobe-you-kicker">Аккаунт WinChat</p>
                <h1>
                  {mode === "register" ? "Создайте аккаунт" : "С возвращением"}
                </h1>
                <p>
                  {mode === "register"
                    ? "Это займёт меньше минуты — и вы внутри."
                    : "Войдите, чтобы продолжить с того же места."}
                </p>
              </div>
            </div>

            <div
              className="oobe-you-segmented"
              data-mode={mode}
              role="tablist"
              aria-label="Регистрация или вход"
            >
              <span className="oobe-you-segmented-thumb" aria-hidden />
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => switchMode("register")}
              >
                Регистрация
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => switchMode("login")}
              >
                Вход
              </button>
            </div>

            <div className="oobe-you-card">
              <form onSubmit={submit}>
                {mode === "register" && (
                  <OobeField
                    icon={<UserRound />}
                    label="Ваше имя"
                    value={nickname}
                    onChange={setNickname}
                    placeholder="Как вас звать?"
                    maxLength={30}
                    autoFocus
                    autoComplete="nickname"
                  />
                )}
                <OobeField
                  icon={<AtSign />}
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  placeholder="юзернейм латиницей"
                  maxLength={20}
                  autoComplete="username"
                />
                <OobeField
                  icon={<LockKeyhole />}
                  label="Пароль"
                  value={password}
                  onChange={setPassword}
                  placeholder={
                    mode === "register" ? "минимум 6 символов" : "ваш пароль"
                  }
                  type={showPw ? "text" : "password"}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  trailing={
                    <button
                      type="button"
                      className="oobe-you-field-trail"
                      aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
                      onClick={() => setShowPw((v) => !v)}
                    >
                      {showPw ? <Eye /> : <EyeOff />}
                    </button>
                  }
                />

                {error && (
                  <div className="oobe-you-error">
                    <CircleAlert />
                    <span>{error}</span>
                  </div>
                )}

                <OobeYouButton
                  type="submit"
                  loading={loading}
                  label={mode === "register" ? "Создать аккаунт" : "Войти"}
                />
              </form>
            </div>

            <WinpassSection
              onSubmit={submitWinpass}
              value={wpInput}
              onChange={setWpInput}
              loading={loading}
            />
          </section>
        )}

        {/* ============ ШАГ: ПОДАРОК-WinPASS ============ */}
        {step === "winpass" && issuedWinpass && (
          <section key="winpass" className="oobe-you-step oobe-you-center">
            <div className="oobe-you-card oobe-you-winpass-hero">
              <div className="oobe-you-icon-badge">
                <KeyRound />
              </div>
              <h2 className="oobe-you-h2">Аккаунт создан</h2>
              <p className="oobe-you-lead">
                Сохраните <b>WinPass</b> — код восстановления, привязанный к
                аккаунту навсегда.
              </p>

              <div className="oobe-you-code">{issuedWinpass}</div>

              <div className="oobe-you-winpass-actions">
                <OobeYouButton
                  variant="tonal"
                  label={copied ? "Скопировано" : "Скопировать код"}
                  leading={copied ? <CheckCheck /> : <Copy />}
                  onClick={copyWinpass}
                />
                <OobeYouButton label="Продолжить" onClick={closeWinpass} />
              </div>
            </div>
          </section>
        )}

        {/* ============ ШАГ: ПРОВЕРКА ============ */}
        {step === "checking" && (
          <section key="checking" className="oobe-you-step oobe-you-center">
            <div className="oobe-you-check-stage">
              <span className="oobe-you-check-ring" aria-hidden />
              <span className="oobe-you-check-ring-inner" aria-hidden />
              <OobeMorphMark className="oobe-you-check-mark" />
            </div>

            <span className="oobe-you-eyebrow">
              <ShieldCheck />
              Проверка
            </span>
            <h1 className="oobe-you-h2">Проверяем аккаунт…</h1>
            <p className="oobe-you-lead">
              Совсем чуть-чуть — проверяем профиль, WinPro и безопасность.
            </p>

            <div className="oobe-you-checks">
              {CHECK_STEPS.map((label, i) => {
                const on = checkPhase >= i;
                const done = checkPhase > i;
                return (
                  <div
                    key={label}
                    className={cn("oobe-you-check", on && "is-on")}
                  >
                    <i>
                      {done ? (
                        <Check />
                      ) : (
                        <Loader2 className={on ? "oobe-you-spin" : ""} />
                      )}
                    </i>
                    {label}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ============ ШАГ: ФИНАЛ ============ */}
        {step === "success" && (
          <section key="success" className="oobe-you-step oobe-you-center">
            <OobeMorphMark settle className="oobe-you-success-mark" />

            <span className="oobe-you-eyebrow">
              <CheckCheck />
              Всё готово
            </span>

            <h1 className="oobe-you-h1">
              Добро пожаловать
              <span className="oobe-you-grad">
                {profile?.nickname?.trim() || "в WinChat"}
              </span>
            </h1>

            <p className="oobe-you-lead">
              Аккаунт проверен. Внутри — чаты, каналы и новая тема Material You.
            </p>

            <div className="oobe-you-actions">
              <OobeYouButton label="Открыть WinChat" onClick={onFinish} />
            </div>

            <div className="oobe-you-chips">
              <span className="oobe-you-chip">
                <ShieldCheck /> Профиль защищён
              </span>
              <span className="oobe-you-chip">
                <Sparkles /> Material You
              </span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------- Material You поле ввода ---------- */
function OobeField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  maxLength,
  autoFocus,
  autoComplete,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon: ReactNode;
  type?: string;
  maxLength?: number;
  autoFocus?: boolean;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="oobe-you-field">
      <span className="oobe-you-field-label">{label}</span>
      <span className="oobe-you-field-box">
        {icon}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          maxLength={maxLength}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
        />
        {trailing}
      </span>
    </label>
  );
}

/* ---------- Вход по WinPass (сворачиваемая секция) ---------- */
function WinpassSection({
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
    <div className="oobe-you-winpass">
      {!open ? (
        <button
          type="button"
          className="oobe-you-winpass-cta"
          onClick={() => setOpen(true)}
        >
          <KeyRound />
          Войти по WinPass
        </button>
      ) : (
        <div className="oobe-you-card oobe-you-winpass-card">
          <h3>Вход по WinPass</h3>
          <p>Введите код восстановления, который сохранили при регистрации.</p>
          <form onSubmit={onSubmit}>
            <OobeField
              icon={<KeyRound />}
              label="WinPass"
              value={value}
              onChange={onChange}
              placeholder="33b42-a1b2c3d4e5f6"
              autoComplete="off"
            />
            <div className="oobe-you-winpass-actions">
              <OobeYouButton
                type="submit"
                label="Войти"
                loading={loading}
              />
              <OobeYouButton
                variant="text"
                label="Назад"
                onClick={() => setOpen(false)}
              />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
