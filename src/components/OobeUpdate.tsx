import { useEffect, useState } from "react";
import { ArrowRight, CheckCheck, Crown, Sparkles } from "lucide-react";
import { cn } from "../utils/cn";

interface Props {
  /** Активен ли WinPro у пользователя (null — ещё проверяется). */
  winPro: boolean | null;
  /** Завершить OOBE и открыть список чатов. */
  onFinish: () => void;
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
export default function OobeUpdate({ winPro, onFinish }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checkPhase, setCheckPhase] = useState(0);
  const [checksDone, setChecksDone] = useState(false);

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
    <div className="oobe-root relative min-h-dvh overflow-hidden">
      {/* Индикатор шага */}
      <div className="absolute top-5 left-0 z-20 flex w-full items-center justify-center gap-2">
        <div className="oobe-steps" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn("oobe-step-dot", n < step ? "is-done" : n === step ? "is-active" : "")}
            />
          ))}
        </div>
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
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-black/5 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_24px_50px_-28px_rgba(31,55,96,0.6)]">
                <img
                  src="/logo.jpg"
                  alt="WinChat"
                  className="h-full w-full animate-[oobe-breathe_3s_ease-in-out_infinite] object-cover"
                />
              </div>
            </div>

            <h1 className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.15s_both] mt-8 text-[34px] leading-tight font-extrabold tracking-tight text-[#101214]">
              WinChat <span className="text-[#3f6df6]">5.0</span>
            </h1>
            <p className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.28s_both] mt-2 text-[16px] font-bold text-black/55">
              Обновление завершено
            </p>
            <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed font-medium text-black/40">
              Впереди самый прозрачный интерфейс в истории WinChat — добро пожаловать
              в эру Liquid Glass.
            </p>

            <OobeButton
              onClick={() => setStep(2)}
              className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both]"
              label="Далее"
            />
          </div>
        )}

        {/* ================================================== ШАГ 2 */}
        {step === 2 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {/* Предпросмотр Liquid Glass */}
            <div className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_both] oobe-card w-full max-w-[400px] overflow-hidden">
              {/* Шапка-островок */}
              <div className="m-3 mb-0 flex items-center justify-between rounded-full bg-[#0d1220]/92 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_16px_36px_-24px_rgba(8,18,40,0.9)]">
                <span className="flex items-center gap-2">
                  <img src="/logo.jpg" alt="" className="h-6 w-6 rounded-lg object-cover" />
                  <span className="text-[12px] font-extrabold text-white">Мария</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  <span className="text-[10px] font-bold text-white/70">в сети</span>
                </span>
              </div>

              {/* Пузыри сообщений */}
              <div className="space-y-2.5 p-4">
                <div className="animate-[oobe-msg-in_0.8s_cubic-bezier(0.22,1.3,0.36,1)_0.35s_both] ml-auto w-[68%] rounded-3xl rounded-br-lg bg-gradient-to-br from-[#6085ff]/95 to-[#3658e0]/92 px-4 py-2.5 text-left text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_16px_34px_-22px_rgba(30,60,150,0.9)]">
                  Смотри, какой прозрачный интерфейс! 
                </div>
                <div className="animate-[oobe-msg-in_0.8s_cubic-bezier(0.22,1.3,0.36,1)_0.6s_both] mr-auto w-[64%] rounded-3xl rounded-bl-lg border border-black/10 bg-[#f7f8fa] px-4 py-2.5 text-left text-[13px] font-semibold text-[#10233f]">
                  Вау! Как жидкое стекло!
                </div>

                {/* Капсула ввода */}
                <div className="mt-3 flex items-center gap-2 rounded-full border border-black/10 bg-white/70 py-2 pr-2 pl-4">
                  <span className="flex-1 text-left text-[12px] font-semibold text-black/35">
                    Сообщение
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3f6df6] text-white">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </div>
              </div>
            </div>
            <p className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.25s_both] mt-4 flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.14em] text-[#1a2434]/55 uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              Liquid Glass · превью
            </p>

            {/* Проверка окружения и WinPro — реалистичная последовательность */}
            <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both] mt-5 w-full max-w-[400px] oobe-card px-6 py-6">
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
                                ? "border-[#3f6df6]/40 bg-[#3f6df6]/10"
                                : "border-black/10 bg-black/[0.03]",
                            !done && !current && "opacity-40"
                          )}
                        >
                          {done ? (
                            <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.6} />
                          ) : current ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#3f6df6]/25 border-t-[#3f6df6]" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-black/15" />
                          )}
                        </span>
                        <p
                          className={cn(
                            "text-[13px] font-bold",
                            done || current ? "text-[#1a2434]/75" : "text-black/30"
                          )}
                        >
                          {label}
                        </p>
                      </div>
                    );
                  })}
                  {/* Индетерминированный индикатор прогресса */}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <span className="animate-[oobe-progress_1.6s_ease-in-out_infinite] block h-full w-1/3 rounded-full bg-[#3f6df6]" />
                  </div>
                </div>
              ) : winPro ? (
                <div className="flex flex-col items-center gap-2.5 py-1">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/95 bg-white/85 text-[#ffd166] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_14px_30px_-18px_rgba(255,180,60,0.8)]">
                    <Crown className="h-7 w-7" />
                  </span>
                  <p className="text-[15px] leading-snug font-extrabold text-[#12295c]">
                    У вас есть WinPro. Вы можете использовать WinChat Glass как основную
                    тему!
                  </p>
                  <p className="text-[12px] font-semibold text-[#1a2434]/55">
                    Настройки → Оформление → WinChat Glass
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 py-1">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/95 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                    <Sparkles className="h-6 w-6 text-[#3f6df6]" />
                  </span>
                  <p className="text-[15px] leading-snug font-extrabold text-[#12295c]">
                    У вас нет WinPro. Получайте его в раздаче или у админа и пользуйтесь
                    WinChat Glass или WinChat You!
                  </p>
                </div>
              )}
            </div>

            <OobeButton disabled={!checksDone} onClick={() => setStep(3)} label="Далее" />
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

            <h1 className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.2s_both] mt-7 text-[38px] font-extrabold tracking-tight text-[#101214]">
              <span className="bg-gradient-to-r from-[#3f6df6] via-[#7aa2ff] to-[#8aa0c8] bg-clip-text text-transparent">
                WinChat
              </span>
            </h1>

            <p className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.35s_both] mt-3 flex items-center gap-2 text-[15px] font-bold text-black/45">
              <CheckCheck className="h-4.5 w-4.5 text-emerald-500" />
              Обновление завершено
            </p>

            <OobeButton
              onClick={onFinish}
              label="Продолжить"
              className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.5s_both]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Единая стеклянная кнопка OOBE ---------- */
export function OobeButton({
  label,
  onClick,
  className,
  disabled,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "group oobe-btn-primary disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {label}
      <span className="oobe-btn-arrow">
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}
