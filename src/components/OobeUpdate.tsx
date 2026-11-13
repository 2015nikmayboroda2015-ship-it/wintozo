import { useEffect, useState } from "react";
import { ArrowRight, CheckCheck, Palette, Sparkles } from "lucide-react";
import { cn } from "../utils/cn";
import YouBackdrop from "./YouBackdrop";
import type { OobeVariant } from "./OobeThemeChooser";

interface Props {
  /** Активен ли WinPro у пользователя (null — ещё проверяется). */
  winPro: boolean | null;
  /** Завершить OOBE и открыть список чатов. */
  onFinish: () => void;
  /** Стиль OOBE: You (Material You) или Liquid Glass. */
  variant?: OobeVariant;
  /** Переключить стиль OOBE на лету (кнопка сверху). */
  onThemeSwitch?: (variant: OobeVariant) => void;
}

/** Фазы «реалистичной проверки» на шаге 2 (без указания времени). */
const CHECKS = [
  "Подключение к серверу…",
  "Проверка целостности обновления…",
  "Синхронизация настроек…",
  "Проверка WinPro…",
];

/**
 * OOBE обновления на WinChat 5.0: приветствие → предпросмотр Liquid Glass
 * с проверкой WinPro → финальный экран «Обновление завершено».
 * Показывается один раз после обновления; на ПК доступен по /oobe_update.
 */
export default function OobeUpdate({ winPro, onFinish, variant = "liquid", onThemeSwitch }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checkPhase, setCheckPhase] = useState(0);
  const [checksDone, setChecksDone] = useState(false);
  /** Настоящий Material You (не перекраска Liquid). */
  const you = variant === "you";

  /* Реалистичная последовательность «проверок» на шаге 2: суммарно ~4–9 с. */
  useEffect(() => {
    if (step !== 2) return;
    let alive = true;
    const timers: number[] = [];
    setCheckPhase(0);
    setChecksDone(false);

    /* Общая длительность: 4–9 секунд, раскидываем по фазам.weighted */
    const total = 4000 + Math.floor(Math.random() * 5000);
    const weights = [1, 1.15, 1.35, 1.5]; // первые фазы быстрее, WinPro — дольше
    const sum = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    weights.forEach((w, i) => {
      acc += w;
      timers.push(
        window.setTimeout(() => {
          if (!alive) return;
          if (i === weights.length - 1) setChecksDone(true);
          else setCheckPhase(i + 1);
        }, Math.round((acc / sum) * total))
      );
    });

    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step]);

  /* Прокручиваем страницу наверх при смене шага (на всякий случай). */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div
      className={cn(
        "oobe-root relative min-h-dvh overflow-hidden",
        you ? "theme-you oobe-you-shell" : "oobe-card bg-white"
      )}
    >
      {/* Живой фон Material You */}
      {you && <YouBackdrop />}

      {/* Переключатель стиля OOBE: You ↔ Liquid */}
      {onThemeSwitch && (
        <OobeThemeToggle variant={variant} onSwitch={onThemeSwitch} />
      )}

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
                : step === 1
                  ? you
                    ? "oobe-you-dot-inactive w-2"
                    : "w-2 bg-black/15"
                  : you
                    ? "oobe-you-dot-inactive w-2"
                    : "w-2 bg-[#1a2434]/20"
            )}
            style={{ animationDelay: `${n * 0.1}s` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-6 py-[72px]">
        {/* ================================================== ШАГ 1 */}
        {step === 1 && (
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            {/* Логотип + вращающиеся «штуки» */}
            <div className="relative flex h-44 w-44 items-center justify-center">
              {/* Орбиты с точками */}
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

              {/* Стеклянная линза с логотипом */}
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
              WinChat <span className="text-[#3f6df6] oobe-accent-text">5.0</span>
            </h1>
            <p className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.28s_both] mt-2 text-[16px] font-bold oobe-subtitle">
              Обновление завершено
            </p>
            <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed font-medium oobe-subtitle">
              {you
                ? "Впереди красочный Material You: живые палитры, тональные поверхности и крупные формы. Добро пожаловать в эру WinChat You."
                : "Впереди самый прозрачный интерфейс в истории WinChat — добро пожаловать в эру Liquid Glass."}
            </p>

            <OobeButton
              onClick={() => setStep(2)}
              className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both]"
              label="Далее"
              you={you}
            />
          </div>
        )}

        {/* ================================================== ШАГ 2 */}
        {step === 2 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {/* Предпросмотр: Liquid Glass или Material You */}
            <div
              className={cn(
                "animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_both] w-full max-w-[400px] overflow-hidden rounded-[34px] border border-black/10 shadow-[0_34px_76px_-46px_rgba(28,60,140,0.45)]",
                you ? "oobe-you-card" : "oobe-preview bg-white"
              )}
            >
              {/* Шапка-островок / тональная шапка You */}
              <div
                className={cn(
                  "m-3 mb-0 flex items-center justify-between px-4 py-2.5",
                  you
                    ? "rounded-[28px] oobe-you-card"
                    : "rounded-full bg-[#0d1220]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_16px_36px_-24px_rgba(8,18,40,0.9)] oobe-preview-bar"
                )}
              >
                <span className="flex items-center gap-2">
                  <img
                    src="/logo.jpg"
                    alt=""
                    className={cn(
                      "h-6 w-6 object-cover",
                      you ? "rounded-full ring-2 ring-white/40" : "rounded-lg"
                    )}
                  />
                  <span className={cn("text-[12px] font-extrabold", you ? "oobe-you-title" : "text-white")}>
                    Мария
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  <span className={cn("text-[10px] font-bold", you ? "oobe-you-subtitle" : "text-white/70")}>
                    в сети
                  </span>
                </span>
              </div>

              {/* Пузыри сообщений */}
              <div className="space-y-2.5 p-4">
                <div
                  className={cn(
                    "animate-[oobe-msg-in_0.8s_cubic-bezier(0.22,1.3,0.36,1)_0.35s_both] ml-auto w-[68%] px-4 py-2.5 text-left text-[13px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_16px_34px_-22px_rgba(30,60,150,0.9)]",
                    you
                      ? "rounded-3xl rounded-br-lg oobe-you-msg-me"
                      : "rounded-3xl rounded-br-lg bg-gradient-to-br from-[#6085ff]/95 to-[#3658e0]/92 text-white oobe-preview-msg-me"
                  )}
                >
                  Смотри, какой прозрачный интерфейс! 
                </div>
                <div
                  className={cn(
                    "animate-[oobe-msg-in_0.8s_cubic-bezier(0.22,1.3,0.36,1)_0.6s_both] mr-auto w-[64%] rounded-3xl rounded-bl-lg px-4 py-2.5 text-left text-[13px] font-semibold",
                    you
                      ? "oobe-you-msg-other"
                      : "border border-black/10 bg-[#f7f8fa] text-[#10233f] oobe-preview-msg-other"
                  )}
                >
                  {you ? "Какие красивые цвета! 🎨" : "Вау! Как жидкое стекло!"}
                </div>

                {/* Капсула ввода */}
                <div
                  className={cn(
                    "mt-3 flex items-center gap-2 rounded-full py-2 pr-2 pl-4",
                    you ? "oobe-you-input" : "border border-black/10 bg-[#f7f8fa] oobe-preview-input"
                  )}
                >
                  <span className="flex-1 text-left text-[12px] font-semibold text-black/35">
                    Сообщение
                  </span>
                  <span className="oobe-accent flex h-8 w-8 items-center justify-center rounded-full text-white">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </div>
              </div>
            </div>
            <p
              className={cn(
                "animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.25s_both] mt-4 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em]",
                you ? "oobe-you-subtitle" : "text-[#1a2434]/55"
              )}
            >
              {you ? (
                <>
                  <Palette className="h-3.5 w-3.5" />
                  Material You · превью
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Liquid Glass · превью
                </>
              )}
            </p>

            {/* Проверка окружения и WinPro — реалистичная последовательность */}
            <div
              className={cn(
                "animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both] mt-5 w-full max-w-[400px] rounded-[32px] border border-black/10 px-6 py-6 shadow-[0_24px_56px_-40px_rgba(28,60,140,0.45)]",
                you ? "oobe-you-card" : "oobe-preview bg-white"
              )}
            >
              {!checksDone ? (
                <div className="flex flex-col gap-3 py-1 text-left">
                  {CHECKS.map((label, i) => {
                    const done = i < checkPhase;
                    const current = i === checkPhase;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500",
                            done
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                              : current
                                ? you
                                  ? "oobe-you-check-current"
                                  : "border-[#3f6df6]/40 bg-[#3f6df6]/10"
                                : "border-black/10 bg-black/[0.03]",
                            !done && !current && "opacity-40"
                          )}
                        >
                          {done ? (
                            <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.6} />
                          ) : current ? (
                            <span
                              className={cn(
                                "h-3 w-3 animate-spin rounded-full border-2 border-[#3f6df6]/25 border-t-[#3f6df6]",
                                you && "oobe-you-spinner"
                              )}
                            />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-black/15" />
                          )}
                        </span>
                        <p
                          className={cn(
                            "text-[13px] font-bold",
                            done || current
                              ? you
                                ? "oobe-you-title"
                                : "text-[#1a2434]/75"
                              : "text-black/30"
                          )}
                        >
                          {label}
                        </p>
                      </div>
                    );
                  })}
                  {/* Индетерминированный индикатор прогресса */}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <span
                      className={cn(
                        "animate-[oobe-progress_1.6s_ease-in-out_infinite] block h-full w-1/3 rounded-full",
                        you ? "oobe-you-dot" : "bg-[#3f6df6]"
                      )}
                    />
                  </div>
                </div>
              ) : winPro ? (
                <div className="flex flex-col items-center gap-2.5 py-1">
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border border-white/95 bg-white/85 text-[#ffd166] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_14px_30px_-18px_rgba(255,180,60,0.8)]",
                      you && "oobe-you-chip"
                    )}
                  >
                    
                  </span>
                  <p className={cn("text-[15px] leading-snug font-extrabold", you ? "oobe-you-title" : "text-[#12295c]")}>
                    У вас есть WinPro. Вы можете использовать WinChat Glass как основную
                    тему!
                  </p>
                  <p className={cn("text-[12px] font-semibold", you ? "oobe-you-subtitle" : "text-[#1a2434]/55")}>
                    Настройки → Оформление → WinChat Glass
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 py-1">
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border border-white/95 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,1)]",
                      you && "oobe-you-chip"
                    )}
                  >
                    <Sparkles className={cn("h-6 w-6", you ? "oobe-accent-text" : "text-[#3f6df6]")} />
                  </span>
                  <p className={cn("text-[15px] leading-snug font-extrabold", you ? "oobe-you-title" : "text-[#12295c]")}>
                    У вас нет WinPro. Получайте его в раздаче или у админа и пользуйтесь
                    WinChat Glass или WinChat You!
                  </p>
                </div>
              )}
            </div>

            <OobeButton disabled={!checksDone} onClick={() => setStep(3)} label="Далее" you={you} />
          </div>
        )}

        {/* ================================================== ШАГ 3 */}
        {step === 3 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="animate-[oobe-pop_0.7s_cubic-bezier(0.22,1.3,0.4,1)_both] relative">
              <span
                aria-hidden
                className="absolute -inset-6 animate-[oobe-breathe_3s_ease-in-out_infinite] rounded-full bg-white/70 blur-2xl"
              />
              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] border border-white/90 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_30px_60px_-32px_rgba(28,60,140,0.7)] backdrop-blur-2xl">
                <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
              </div>
            </div>

            <h1 className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.2s_both] mt-7 text-[38px] font-extrabold tracking-tight text-[#101214] oobe-title">
              <span className="bg-gradient-to-r from-[#3f6df6] via-[#7aa2ff] to-[#8aa0c8] bg-clip-text text-transparent oobe-accent-grad">
                WinChat
              </span>
            </h1>

            <p className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.35s_both] mt-3 flex items-center gap-2 text-[15px] font-bold text-black/45 oobe-subtitle">
              <CheckCheck className="h-4.5 w-4.5 text-emerald-500" />
              Обновление завершено
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

/* ---------- Единая кнопка OOBE (Liquid — стеклянная, You — filled) ---------- */
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

/* ---------- Переключатель стиля OOBE (You ↔ Liquid) ---------- */
export function OobeThemeToggle({
  variant,
  onSwitch,
}: {
  variant: OobeVariant;
  onSwitch: (variant: OobeVariant) => void;
}) {
  const you = variant === "you";
  return (
    <button
      type="button"
      onClick={() => onSwitch(you ? "liquid" : "you")}
      title="Переключить стиль OOBE"
      className={cn(
        "absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-extrabold tracking-wide transition active:scale-[0.97]",
        you
          ? "oobe-you-chip"
          : "border border-white bg-white/60 text-[#1a2434] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-20px_rgba(28,60,120,0.5)] backdrop-blur-md"
      )}
    >
      <Palette className="h-3.5 w-3.5" />
      {you ? "Liquid Glass" : "Material You"}
    </button>
  );
}
