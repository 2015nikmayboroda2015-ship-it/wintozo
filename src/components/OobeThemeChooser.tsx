/**
 * Окно выбора стиля OOBE: WinChat You (Material You) или Liquid Glass.
 *
 * Само окно выполнено в стиле WinChat You: живой фон (YouBackdrop),
 * тональные поверхности, filled-кнопка. Выбор сохраняется в localStorage
 * (winchat_oobe_theme) и передаётся в OobeUpdate / OobeInstall через variant.
 */
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import YouBackdrop from "./YouBackdrop";
import { cn } from "../utils/cn";

export type OobeVariant = "you" | "liquid";

interface Props {
  onChoose: (variant: OobeVariant) => void;
}

export default function OobeThemeChooser({ onChoose }: Props) {
  const pick = (variant: OobeVariant) => () => onChoose(variant);

  return (
    <div className="theme-you oobe-you-shell relative min-h-dvh overflow-hidden">
      {/* Живой фон Material You */}
      <YouBackdrop />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[460px] flex-col items-center justify-center px-6 py-10 text-center">
        {/* Логотип — в цветах палитры You */}
        <div className="animate-[oobe-pop_0.7s_cubic-bezier(0.22,1.3,0.4,1)_both] relative">
          <span
            aria-hidden
            className="absolute -inset-6 animate-[oobe-breathe_3s_ease-in-out_infinite] rounded-full opacity-70 blur-2xl"
            style={{ background: "var(--you-primary-container)" }}
          />
          <div className="oobe-you-logo relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border">
            <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
          </div>
        </div>

        <h1 className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.15s_both] mt-7 text-[32px] leading-tight font-extrabold tracking-tight oobe-you-title">
          WinChat 5.0
        </h1>
        <p className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.28s_both] mt-2 text-[16px] font-bold oobe-you-subtitle">
          Выберите стиль приветствия
        </p>
        <p className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.4s_both] mt-3 max-w-[340px] text-[13px] leading-relaxed font-medium oobe-you-subtitle">
          Весь OOBE подстроится под выбранную тему: WinChat You или Liquid Glass.
        </p>

        <div className="animate-[oobe-rise_0.7s_cubic-bezier(0.22,1.2,0.4,1)_0.5s_both] mt-9 w-full max-w-[360px] space-y-3">
          {/* OOBE You — filled (Material 3) */}
          <button
            type="button"
            onClick={pick("you")}
            className="oobe-you-btn group flex w-full items-center justify-center gap-2 px-6 py-4 text-[15px] font-extrabold tracking-wide transition active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            OOBE You
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* OOBE Liquid — outlined */}
          <button
            type="button"
            onClick={pick("liquid")}
            className={cn(
              "oobe-you-btn-outline group flex w-full items-center justify-center gap-2 bg-white/70 px-6 py-4 text-[15px] font-extrabold tracking-wide transition active:scale-[0.98]",
              "backdrop-blur-md"
            )}
          >
            <Layers className="h-4 w-4" />
            OOBE Liquid
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <p className="animate-[oobe-rise_0.65s_cubic-bezier(0.22,1.2,0.4,1)_0.6s_both] mt-9 text-[11px] font-semibold oobe-you-subtitle opacity-70">
          Стиль сохраняется и будет у OOBE при следующем запуске.
        </p>
      </div>
    </div>
  );
}
