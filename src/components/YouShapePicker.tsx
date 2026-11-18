import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { YOU_SHAPES, type YouShape, type YouShapeOption } from "../lib/youShapes";
import { applyYouShape, saveYouShape } from "../lib/materialYou";
import { cn } from "../utils/cn";

interface Props {
  value: YouShape;
  onChange: (id: YouShape) => void;
}

const STANDARD = YOU_SHAPES.filter((s) => s.group === "standard");
const EXPRESSIVE = YOU_SHAPES.filter((s) => s.group === "expressive");

/**
 * Выбор формы WinChat You. Сверху — привычные варианты скругления,
 * снизу — силуэты из бут-анимации (lib/youShapes.ts). Выбранная
 * expressive-форма сразу применяется к кнопкам интерфейса.
 */
export default function YouShapePicker({ value, onChange }: Props) {
  const pick = (id: YouShape) => {
    saveYouShape(id);
    applyYouShape(id);
    onChange(id);
  };

  const tile = (sh: YouShapeOption, preview: ReactNode) => {
    const on = value === sh.id;
    return (
      <button
        key={sh.id}
        type="button"
        title={sh.hint}
        aria-pressed={on}
        onClick={() => pick(sh.id)}
        className={cn(
          "relative flex flex-col items-center gap-2 p-2.5 transition active:scale-95",
          on
            ? "bg-[var(--you-surface-highest)] ring-2 ring-[var(--you-on-surface)]"
            : "bg-[var(--you-surface-low)]/70 ring-1 ring-black/5 hover:bg-[var(--you-surface-container)]"
        )}
        style={{ borderRadius: "var(--you-r-sm)" }}
      >
        {preview}
        <span className="text-[10px] font-bold leading-tight text-[var(--you-on-surface)]">
          {sh.name}
        </span>

        {on && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
            style={{ background: "var(--you-on-surface)" }}
          >
            <Check className="h-2.5 w-2.5" style={{ color: "var(--you-surface-low)" }} />
          </span>
        )}
      </button>
    );
  };

  const fill = (on: boolean) =>
    on
      ? "linear-gradient(135deg, var(--you-primary), var(--you-primary-strong))"
      : "var(--you-surface-highest)";

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-bold text-[var(--you-on-surface-variant)]">
          Стандартные
        </p>
        <div className="grid grid-cols-4 gap-2">
          {STANDARD.map((sh) =>
            tile(
              sh,
              <span
                aria-hidden="true"
                className="h-8 w-full"
                style={{
                  borderRadius: sh.r,
                  background: fill(value === sh.id),
                  boxShadow:
                    "inset 0 0 0 1px color-mix(in srgb, var(--you-outline-variant) 60%, transparent)",
                }}
              />
            )
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold text-[var(--you-on-surface-variant)]">
          Формы из заставки
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXPRESSIVE.map((sh) =>
            tile(
              sh,
              <span
                aria-hidden="true"
                className="h-9 w-9"
                style={{
                  WebkitClipPath: sh.clip,
                  clipPath: sh.clip,
                  background: fill(value === sh.id),
                  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--you-outline-variant) 60%, transparent)",
                }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
