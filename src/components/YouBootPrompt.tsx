import { Sparkles } from "lucide-react";
import { getYouSeed } from "../lib/materialYou";

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Плашка после активации темы WinChat You: предлагает переключить
 * стартовую заставку на You-стиль.
 */
export default function YouBootPrompt({ open, onAccept, onDecline }: Props) {
  if (!open) return null;
  const seed = getYouSeed();

  return (
    <div className="font-app pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div
        className="animate-scale-in pointer-events-auto w-full max-w-md overflow-hidden p-4 shadow-2xl"
        style={{
          background: seed.surfaceLow,
          color: seed.onSurface,
          borderRadius: "var(--you-r-lg, 26px)",
          boxShadow: `0 26px 64px -24px ${seed.primary}99, 0 0 0 1px ${seed.outlineVariant}`,
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: seed.primary, color: seed.onPrimary }}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold leading-tight">
              Активирована тема You
            </p>
            <p
              className="mt-1 text-[12.5px] font-medium leading-snug"
              style={{ color: seed.onSurfaceVariant }}
            >
              Хотите поменять бут-анимацию на You-стиль?
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 px-4 py-2.5 text-[12.5px] font-bold transition active:scale-[0.98]"
            style={{
              background: seed.surfaceHighest,
              color: seed.onSurface,
              borderRadius: "999px",
            }}
          >
            Оставить
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 px-4 py-2.5 text-[12.5px] font-bold transition active:scale-[0.98]"
            style={{
              background: seed.primary,
              color: seed.onPrimary,
              borderRadius: "999px",
              boxShadow: `0 10px 24px -12px ${seed.primary}`,
            }}
          >
            На You-стиль
          </button>
        </div>
      </div>
    </div>
  );
}
