import { useEffect, useState } from "react";
import { ArrowRight, CheckCheck, Crown, Sparkles } from "lucide-react";
import { cn } from "../utils/cn";

interface Props {
  /** Активен ли WinPro у пользователя (null — ещё проверяется). */
  winPro: boolean | null;
  /** Завершить OOBE и открыть список чатов. */
  onFinish: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

/** Фазы «реалистичной проверки»: каждая — своя страница с анимацией. */
const CHECKS = [
  "Подключение к серверу…",
  "Проверка целостности обновления…",
  "Синхронизация настроек…",
  "Проверка WinPro…",
];
const CHECK_DURS = [900, 1200, 1100, 1600];
const CHECK_ANIMS: Record<number, string> = { 0: "oobe-rise", 1: "oobe-pop", 2: "oobe-breathe", 3: "oobe-float" };

/** Шапка OOBE: маленький логотип и WinChat — всегда сверху. */
export function OobeHeader() {
  return (
    <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-center gap-2.5 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[14px] border border-black/8 bg-white shadow-sm">
        <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
      </div>
      <span className="text-[16px] leading-none font-extrabold tracking-tight text-[#101214]">
        WinChat
      </span>
    </div>
  );
}

/**
 * OOBE обновления на WinChat 5.0:
 * 1 — приветствие • 2 — предпросмотр Liquid Glass • 3 — проверки (по очереди)
 * 4 — вердикт WinPro • 5 — финал «Обновление завершено».
 * Показывается один раз после обновления; на ПК доступен по /oobe_update.
 */
export default function OobeUpdate({ winPro, onFinish }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [checkPhase, setCheckPhase] = useState(0);

  /* Последовательный прогон проверок: ~4–9 с суммарно, каждая своя анимация. */
  useEffect(() => {
    if (step !== 3) return;
    let alive = true;
    const timers: number[] = [];
    setCheckPhase(0);

    let acc = 0;
    CHECKS.forEach((_, i) => {
      acc += CHECK_DURS[i];
      timers.push(
        window.setTimeout(() => {
          if (!alive) return;
          setCheckPhase(i);
          if (i < CHECKS.length - 1) {
            timers.push(
              window.setTimeout(() => {
                if (alive) setCheckPhase(i + 1);
              }, CHECK_DURS[i] * 1000)
            );
          } else {
            timers.push(
              window.setTimeout(() => {
                if (!alive) return;
                setCheckPhase(CHECKS.length - 1);
                // Пауза после последней проверки — переход к вердикту WinPro.
                timers.push(
                  window.setTimeout(() => {
                    if (alive) setStep(4);
                  }, 1000)
                );
              }, CHECK_DURS[CHECKS.length - 1] * 1000 + 900)
            );
          }
        }, Math.round(acc * 1000))
      );
    });

    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step]);

  const next = () => setStep((s: Step) => (s === 5 ? s : ((s + 1) as Step)));

  const CHECK = checkPhase;

  return (
    <div className="oobe-root oobe-font relative min-h-dvh overflow-hidden bg-white">
      <OobeHeader />

      {/* Индикатор шага */}
      <div className="absolute top-14 left-0 z-20 flex w-full items-center justify-center gap-2">
        {([1, 2, 3, 4, 5] as Step[]).map((n) => (
          <span
            key={n}
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              n === step ? "w-7 bg-[#3f6df6]" : "w-2 bg-black/15"
            )}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-6 pt-[92px] pb-10">
        {/* ================================================== ШАГ 1: приветствие */}
        {step === 1 && (
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
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

              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_24px_50px_-28px_rgba(31,55,96,0.6)]">
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

            <OobeButton
              onClick={next}
              className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both]"
              label="Далее"
            />
          </div>
        )}

        {/* ================================================== ШАГ 2: предпросмотр Liquid Glass */}
        {step === 2 && (
          <div className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-full max-w-[400px] overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-[0_34px_76px_-46px_rgba(28,60,140,0.45)]">
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

              <div className="space-y-2.5 p-4">
                <div className="animate-[oobe-msg-in_0.8s_cubic-bezier(0.22,1.3,0.36,1)_0.35s_both] ml-auto w-[68%] rounded-3xl rounded-br-lg bg-gradient-to-br from-[#6085ff]/95 to-[#3658e0]/92 px-4 py-2.5 text-left text-[13px] font-semibold text-white shadow-[0_16px_34px_-22px_rgba(30,60,150,0.9)]">
                  Смотри, какой прозрачный интерфейс!
                </div>
                <div className="animate-[oobe-msg-in_0.8s_cubic-bezier(0.22,1.3,0.36,1)_0.6s_both] mr-auto w-[64%] rounded-3xl rounded-bl-lg border border-black/10 bg-[#f7f8fa] px-4 py-2.5 text-left text-[13px] font-semibold text-[#10233f]">
                  Вау! Как жидкое стекло!
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-full border border-black/10 bg-[#f7f8fa] py-2 pr-2 pl-4">
                  <span className="flex-1 text-left text-[12px] font-semibold text-black/35">
                    Сообщение
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3f6df6] text-white">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </div>
              </div>
            </div>

            <p className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.25s_both] mt-5 text-[24px] font-extrabold tracking-tight text-[#101214]">
              Liquid Glass
            </p>
            <p className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.35s_both] mt-2 max-w-[330px] text-[13px] leading-relaxed font-semibold text-black/45">
              Новый интерфейс WinChat: стеклянные панели, блики и огромные скругления.
              Его оценят все пользователи WinPro.
            </p>

            <OobeButton
              onClick={next}
              className="animate-[oobe-rise_0.6s_cubic-bezier(0.22,1.2,0.4,1)_0.45s_both]"
              label="Далее"
            />
          </div>
        )}

        {/* ================================================== ШАГ 3: одна проверка — одна страница */}
        {step === 3 && (
          <div className="animate-[oobe-pop_0.5s_cubic-bezier(0.22,1.3,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-full max-w-[380px] rounded-[32px] border border-black/10 bg-white px-7 py-9 text-center shadow-[0_30px_70px_-46px_rgba(28,60,140,0.45)]">
              <div
                key={CHECK}
                className={cn(
                  "flex flex-col items-center gap-4 text-center",
                  `animate-[${CHECK_ANIMS[CHECK]}_0.85s_cubic-bezier(0.22,1.2,0.4,1)_both]`
                )}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-[#eef4ff] text-[#3f6df6]">
                  {CHECK >= CHECKS.length - 1 ? (
                    <CheckCheck className="h-7 w-7" strokeWidth={2.6} />
                  ) : (
                    <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#3f6df6]/25 border-t-[#3f6df6]" />
                  )}
                </span>
                <h2 className="text-[17px] font-extrabold text-[#101214]">{CHECKS[Math.min(CHECK, CHECKS.length - 1)]}</h2>
              </div>

              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                <span className="animate-[oobe-progress_1.6s_ease-in-out_infinite] block h-full w-1/3 rounded-full bg-[#3f6df6]" />
              </div>
            </div>
          </div>
        )}

        {/* ================================================== ШАГ 4: вердикт WinPro */}
        {step === 4 && (
          <div className="animate-[oobe-pop_0.55s_cubic-bezier(0.22,1.3,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-full max-w-[400px] rounded-[32px] border border-black/10 bg-white px-7 py-9 text-center shadow-[0_30px_70px_-46px_rgba(28,60,140,0.45)]">
              {winPro ? (
                <>
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-[#fff7e0] text-[26px]">
                    <Crown className="h-8 w-8 text-[#d99a00]" strokeWidth={1.8} />
                  </span>
                  <p className="mt-4 text-[17px] leading-snug font-extrabold text-[#101214]">
                    У вас есть WinPro
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed font-semibold text-black/50">
                    Вы можете использовать WinChat Glass как основную тему —
                    Настройки → Оформление → WinChat Glass.
                  </p>
                </>
              ) : (
                <>
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-[#eef4ff]">
                    <Sparkles className="h-7 w-7 text-[#3f6df6]" />
                  </span>
                  <p className="mt-4 text-[17px] leading-snug font-extrabold text-[#101214]">
                    У вас нет WinPro
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed font-semibold text-black/50">
                    Получайте его в раздаче или у админа и пользуйтесь WinChat Glass или
                    WinChat You!
                  </p>
                </>
              )}
            </div>

            <OobeButton onClick={next} label="Далее" />
          </div>
        )}

        {/* ================================================== ШАГ 5: финал */}
        {step === 5 && (
          <div className="animate-[oobe-pop_0.6s_cubic-bezier(0.22,1.3,0.4,1)_both] flex flex-1 flex-col items-center justify-center text-center">
            <div className="relative">
              <span
                aria-hidden
                className="absolute -inset-6 animate-[oobe-breathe_3s_ease-in-out_infinite] rounded-full bg-[#3f6df6]/10 blur-2xl"
              />
              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] border border-black/8 bg-white shadow-[0_30px_60px_-32px_rgba(28,60,140,0.55)]">
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

/* ---------- Единая синяя плоская кнопка OOBE ---------- */
export function OobeButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group mt-9 flex w-full max-w-[340px] items-center justify-center gap-2 rounded-full bg-[#3f6df6] px-6 py-4 text-[15px] font-extrabold text-white tracking-wide shadow-[0_18px_38px_-22px_rgba(44,86,232,0.9)] transition hover:bg-[#2c56e8] active:scale-[0.98]",
        className
      )}
    >
      {label}
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition group-hover:translate-x-0.5">
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}
