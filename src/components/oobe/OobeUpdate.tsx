import { useEffect, useState } from "react";
import { ArrowRight, CheckCheck, Palette, Play, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn";
import YouBackdrop from "../YouBackdrop";
import type { OobeVariant } from "./OobeThemeChooser";
import { applyTheme, getThemeById, saveThemeId, THEMES, YOU_THEME_ID } from "../../lib/themes";
import { applyYouPalette, getYouSeedId } from "../../lib/materialYou";

interface Props {
  /** Активен ли WinPro у пользователя (null — ещё проверяется). */
  winPro: boolean | null;
  /** Завершить OOBE и открыть список чатов. */
  onFinish: () => void;
  /** Стиль OOBE: You (Material You). */
  variant?: OobeVariant;
}

/** Что нового в WinChat 6.0 (шаг 3). */
const WHATS_NEW = [
  "Material You — живые палитры и тональные поверхности",
  "Новый шрифт Google Sans в Material You",
  "Обновлённая OOBE и новые анимации",
  "Каналы, приглашения и OTA-обновления стали надёжнее",
];

/**
 * OOBE обновления на WinChat 6.0: приветствие → живое видео-превью
 * Material You с кнопкой активации → экран «Что нового».
 * Показывается один раз после обновления; на ПК доступен по /oobe_update.
 */
export default function OobeUpdate({ winPro, onFinish, variant = "you" }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activated, setActivated] = useState(false);
  /** Стиль Material You (Material 3). */
  const you = variant === "you";

  /* Прокручиваем страницу наверх при смене шага (на всякий случай). */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  /* Активировать тему WinChat You (Material You) — кнопка на шаге 2. */
  function activateYou() {
    saveThemeId(YOU_THEME_ID);
    applyTheme(getThemeById(YOU_THEME_ID) ?? THEMES[0]);
    applyYouPalette(getYouSeedId());
    setActivated(true);
  }

  return (
    <div
      className={cn(
        "oobe-root relative min-h-dvh overflow-hidden",
        you ? "theme-you oobe-you-shell" : "oobe-card bg-white"
      )}
    >
      {/* Живой фон Material You */}
      {you && <YouBackdrop />}

      {/* Индикатор шага */}
      <div className="absolute top-5 left-0 z-20 flex w-full items-center justify-center gap-2">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              n === step
                ? you
                  ? "oobe-you-dot w-7"
                  : "w-7 bg-[#3f6df6]"
                : you
                  ? "oobe-you-dot-inactive w-2"
                  : "w-2 bg-black/15"
            )}
            style={{ animationDelay: `${n * 0.1}s` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-6 py-[72px]">
        {/* ================================================== ШАГ 1: Приветствие */}
        {step === 1 && (
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            {/* Логотип + вращающиеся орбиты */}
            <div className="relative flex h-44 w-44 items-center justify-center">
              <span
                aria-hidden
                className="absolute inset-0 animate-[oobe-spin_9s_linear_infinite] rounded-full border border-black/5"
              >
                <span className="absolute top-0 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3f6df6] shadow-[0_0_14px_rgba(63,109,246,0.6)]" />
                <span className="absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full bg-[#7aa2ff]" />
              </span>
              <span
                aria-hidden
                className="absolute inset-5 animate-[oobe-spin_6s_linear_infinite_reverse] rounded-full border border-black/5"
              >
                <span className="absolute top-1/2 left-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6cc9b8]" />
                <span className="absolute bottom-1.5 left-1.5 h-3 w-3 rounded-full bg-[#ffb5e6]" />
              </span>
              <span
                aria-hidden
                className="absolute inset-10 animate-[oobe-spin_4s_ease-in-out_infinite_alternate] rounded-full border border-dashed border-black/10"
              >
                <span className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rounded-full bg-[#ffd166]" />
              </span>

              <div
                className={cn(
                  "relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-black/5 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_24px_50px_-28px_rgba(31,55,96,0.6)]",
                  you && "oobe-you-logo"
                )}
              >
                <img
                  src="/logo.jpg"
                  alt="WinChat"
                  className="h-full w-full animate-[oobe-breathe_3s_ease-in-out_infinite] object-cover"
                />
              </div>
            </div>

            <h1 className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.15s_both] mt-8 text-[34px] leading-tight font-extrabold tracking-tight oobe-title">
              WinChat <span className="text-[#3f6df6] oobe-accent-text">6.0</span>
            </h1>
            <p className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.28s_both] mt-2 text-[16px] font-bold oobe-subtitle">
              Обновление завершено
            </p>
            <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed font-medium oobe-subtitle">
              Впереди живое видео нового интерфейса — смотри, каким стал WinChat.
            </p>

            <OobeButton
              onClick={() => setStep(2)}
              className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both]"
              label="Смотреть превью"
              you={you}
            />
          </div>
        )}

        {/* ================================================== ШАГ 2: Видео-превью + активация */}
        {step === 2 && (
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            {/* Живое видео Material You */}
            <div
              className={cn(
                "w-full max-w-[300px] overflow-hidden rounded-[34px] border border-black/10 shadow-[0_34px_76px_-46px_rgba(28,60,140,0.45)]",
                you ? "oobe-you-card" : "oobe-preview bg-white"
              )}
            >
              <video
                src="/Preview_you.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="block h-auto w-full"
              />
            </div>
            <p
              className={cn(
                "mt-4 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em]",
                you ? "oobe-you-subtitle" : "text-[#1a2434]/55"
              )}
            >
              <Play className="h-3.5 w-3.5" />
              WinChat 6.0 · живое превью
            </p>

            {/* Активация Material You — только с WinPro */}
            {winPro ? (
              <div className="mt-5 w-full max-w-[340px]">
                <button
                  type="button"
                  onClick={activateYou}
                  disabled={activated}
                  className={cn(
                    "group flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-extrabold tracking-wide transition active:scale-[0.98]",
                    activated
                      ? "cursor-default bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/30"
                        : "oobe-you-btn"
                  )}
                >
                  {activated ? (
                    <>
                      <CheckCheck className="h-4 w-4" strokeWidth={2.6} />
                      Тема WinChat You активирована
                    </>
                  ) : (
                    <>
                      <Palette className="h-4 w-4" />
                      Активировать WinChat You
                    </>
                  )}
                </button>
                <p
                  className={cn(
                    "mt-2 text-[12px] font-semibold",
                    you ? "oobe-you-subtitle" : "text-black/45"
                  )}
                >
                  {activated
                    ? "Палитра уже применена — можно менять её в настройках."
                    : "Тема применится сразу, палитру можно сменить позже в настройках."}
                </p>
              </div>
            ) : (
              <p
                className={cn(
                  "mt-5 max-w-[320px] text-[13px] leading-relaxed font-semibold",
                  you ? "oobe-you-subtitle" : "text-black/45"
                )}
              >
                Активация Material You доступна с WinPro — оформить можно во вкладке «WinPro»
                в настройках.
              </p>
            )}

            <OobeButton disabled={winPro === null} onClick={() => setStep(3)} label="Далее" you={you} />
          </div>
        )}

        {/* ================================================== ШАГ 3: Что нового */}
        {step === 3 && (
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            <div
              className={cn(
                "flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] border border-black/5 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_24px_50px_-28px_rgba(31,55,96,0.6)]",
                you && "oobe-you-logo"
              )}
            >
              <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
            </div>

            <h1 className="mt-6 text-[30px] leading-tight font-extrabold tracking-tight oobe-title">
              Что нового в <span className="text-[#3f6df6] oobe-accent-text">6.0</span>
            </h1>

            {/* Список нововведений */}
            <div
              className={cn(
                "mt-6 w-full max-w-[400px] space-y-2.5 rounded-[32px] border border-black/10 px-5 py-5 text-left shadow-[0_24px_56px_-40px_rgba(28,60,140,0.45)]",
                you ? "oobe-you-card" : "oobe-preview bg-white"
              )}
            >
              {WHATS_NEW.map((text, i) => (
                <div
                  key={text}
                  className="animate-[oobe-msg-in_0.5s_cubic-bezier(0.22,1.3,0.36,1)_both] flex items-start gap-2.5"
                  style={{ animationDelay: `${0.15 + i * 0.12}s` }}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      you ? "oobe-you-check-current" : "bg-[#3f6df6]/10"
                    )}
                  >
                    <CheckCheck className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                  <p
                    className={cn(
                      "text-[13px] leading-snug font-semibold",
                      you ? "oobe-you-title" : "text-[#1a2434]/75"
                    )}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>

            <p
              className={cn(
                "mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]",
                you ? "oobe-you-subtitle" : "text-black/35"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Хорошего пользования WinChat 6.0!
            </p>

            <OobeButton
              onClick={onFinish}
              label="Продолжить"
              className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.5s_both]"
              you={you}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Единая кнопка OOBE (You — filled) ---------- */
export function OobeButton({
  label,
  onClick,
  className,
  disabled,
  you = false,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  /** Стиль WinChat You (Material 3 filled). */
  you?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "group mt-9 flex w-full max-w-[340px] items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-extrabold tracking-wide transition active:scale-[0.98]",
        you
          ? "oobe-you-btn"
          : "border border-white bg-white/70 text-[#1a2434] shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-10px_22px_-14px_rgba(44,86,232,0.35),0_22px_48px_-26px_rgba(28,60,120,0.55)] backdrop-blur-xl backdrop-saturate-150 oobe-accent-2",
        className,
        // Пока идёт проверка — кнопка приглушена и не кликается
        disabled
          ? "cursor-not-allowed opacity-50 saturate-50"
          : you
            ? ""
            : "hover:bg-white/90"
      )}
    >
      {label}
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full transition group-hover:translate-x-0.5",
          you ? "bg-white/25" : "bg-[#3f6df6] text-white"
        )}
      >
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}
