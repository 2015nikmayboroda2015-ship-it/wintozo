import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { hasWinPro } from "../lib/winpro";
import type { Profile } from "../lib/supabase";

interface Props {
  me?: Profile | null;
  onBack: () => void;
  onGetWinPro: () => void;
}

/**
 * Экран-заглушка для /themes/glass/* без активного WinPro.
 * Сделан в духе Liquid Glass: прозрачные стеклянные панели, сильное
 * размытие, крупные скругления и мягкие голубые блики.
 */
export default function GlassLocked({ me, onBack, onGetWinPro }: Props) {
  const active = hasWinPro(me);

  return (
    <div className="font-app relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#e7edf6] px-5 py-10">
      {/* Живой фон: мягкие «жидкие» пятна под стеклом */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-[-20%] animate-[glass-float_18s_ease-in-out_infinite_alternate] bg-[radial-gradient(ellipse_45%_40%_at_20%_20%,rgba(110,155,255,0.55),transparent_65%),radial-gradient(ellipse_45%_40%_at_82%_28%,rgba(255,255,255,0.85),transparent_65%),radial-gradient(ellipse_60%_45%_at_50%_100%,rgba(170,200,255,0.55),transparent_70%)] blur-[18px]"
      />

      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[42px] border border-white/80 bg-white/55 px-7 pt-8 pb-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_40px_90px_-40px_rgba(31,55,96,0.55)] backdrop-blur-[34px] backdrop-saturate-150">
        {/* Глянцевый блик сверху */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[130%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.95),transparent_70%)] blur-2xl"
        />

        <div className="relative">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-[30px] border border-white/90 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_20px_40px_-24px_rgba(31,55,96,0.7)]">
            <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-white/80 bg-white/60 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-[#1a2434]/80 backdrop-blur">
              <Sparkles className="h-3 w-3" />
              WinPro
            </span>
          </div>

          <h1 className="mt-3 text-[32px] leading-tight font-extrabold tracking-tight text-[#1a2434]">
            WinChat <span className="bg-gradient-to-r from-[#3f6df6] to-[#7aa2ff] bg-clip-text text-transparent">Glass</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[320px] text-[14px] leading-relaxed font-medium text-[#1a2434]/60">
            Интерфейс из «жидкого стекла»: прозрачные панели, глубокое размытие,
            глянцевые блики и очень крупные скругления.
          </p>

          {/* Палитра-«стекляшки» */}
          <div className="mt-6 flex items-center justify-center gap-2.5">
            {[0.9, 0.7, 0.55, 0.4].map((o, i) => (
              <span
                key={o}
                className="h-8 w-8 rounded-full border border-white/90 bg-white shadow-sm"
                style={{ opacity: o, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>

          <div className="mt-7 space-y-2.5 text-left">
            {[
              "Прозрачные стеклянные панели и сильное размытие",
              "Отдельный маршрут /themes/glass/chat",
              "Очень крупные скругления и глянцевые блики",
            ].map((text) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/70 text-[#3f6df6]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <p className="text-[13px] leading-snug font-semibold text-[#1a2434]/70">
                  {text}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={onGetWinPro}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-full border border-white bg-white/60 px-5 py-3.5 text-[15px] font-extrabold text-[#2c56e8] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_16px_34px_-20px_rgba(28,60,120,0.5)] backdrop-blur-2xl backdrop-saturate-150 transition hover:bg-white/80 active:scale-[0.98]"
          >
            {active ? "Открыть WinChat Glass" : "Оформить WinPro"}
          </button>

          <button
            onClick={onBack}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/60 bg-white/35 px-5 py-3 text-[13px] font-bold text-[#1a2434]/70 backdrop-blur transition hover:bg-white/55 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться в обычный WinChat
          </button>
        </div>
      </div>
    </div>
  );
}
