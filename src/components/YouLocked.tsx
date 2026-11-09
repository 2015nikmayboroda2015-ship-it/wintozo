import { ArrowLeft, Check } from "lucide-react";
import { YOU_SEEDS } from "../lib/materialYou";
import { hasWinPro } from "../lib/winpro";
import type { Profile } from "../lib/supabase";

interface Props {
  me?: Profile | null;
  onBack: () => void;
  onGetWinPro: () => void;
}

/**
 * Экран-заглушка для /themes/you/* без активного WinPro.
 * Сделан в духе Material You: большие формы, тональные поверхности,
 * «обои» из палитры seed-цветов.
 */
export default function YouLocked({ me, onBack, onGetWinPro }: Props) {
  const active = hasWinPro(me);

  return (
    <div className="you-gate font-app relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <div className="you-gate-ambient" aria-hidden />

      <div className="you-gate-card relative w-full max-w-[440px] overflow-hidden rounded-[36px] px-7 pt-8 pb-7 text-center shadow-2xl">
        <div className="you-gate-shine" aria-hidden />

        <div className="relative">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] bg-[var(--you-primary-container)] shadow-inner">
            <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[var(--you-secondary-container)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--you-on-secondary-container)]">
              WinPro
            </span>
          </div>

          <h1 className="mt-3 text-[32px] leading-tight font-extrabold tracking-tight text-[var(--you-on-surface)]">
            WinChat <span className="text-[var(--you-primary)]">You</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[320px] text-[14px] leading-relaxed font-medium text-[var(--you-on-surface-variant)]">
            Интерфейс, который подстраивается под вас: динамическая палитра Material You,
            мягкие тональные поверхности, крупные формы и своя атмосфера в каждом чате.
          </p>

          {/* Палитра-«обои» */}
          <div className="mt-6 flex items-center justify-center gap-2.5">
            {YOU_SEEDS.map((s, i) => (
              <span
                key={s.id}
                className="you-gate-dot h-8 w-8 rounded-full shadow-sm ring-2 ring-white/70"
                style={{ background: s.primary, animationDelay: `${i * 0.12}s` }}
                title={s.name}
              />
            ))}
          </div>

          <div className="mt-7 space-y-2.5 text-left">
            {[
              "10 динамических палитр — как обои рабочего стола",
              "Отдельный маршрут /themes/you/chat",
              "Крупные формы, тональные поверхности и аккуратные акценты",
            ].map((text) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--you-primary-container)] text-[var(--you-on-primary-container)]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <p className="text-[13px] leading-snug font-semibold text-[var(--you-on-surface-variant)]">
                  {text}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={onGetWinPro}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--you-primary)] px-5 py-3.5 text-[15px] font-extrabold text-[var(--you-on-primary)] shadow-lg transition hover:brightness-105 active:scale-[0.98]"
          >
            {active ? "Открыть WinChat You" : "Оформить WinPro"}
          </button>

          <button
            onClick={onBack}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold text-[var(--you-on-surface-variant)] transition hover:bg-[var(--you-surface-container)] active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться в обычный WinChat
          </button>
        </div>
      </div>
    </div>
  );
}
