import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { BOOT_STYLES, type BootStyle } from "../lib/bootAnimation";
import { cn } from "../utils/cn";
import "./boot.css";

interface Props {
  value: BootStyle;
  onChange: (id: BootStyle) => void;
  /** Настройки открыты внутри темы You — используем её тона. */
  you?: boolean;
}

/**
 * Выбор стартовой заставки: стандартная (старый переливающийся логотип),
 * новая (точки) и WinChat You (иконка на тональном фоне). Превью живые.
 */
export default function BootStylePicker({ value, onChange, you = false }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {BOOT_STYLES.map((s) => {
        const on = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            title={s.description}
            onClick={() => onChange(s.id)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-2.5 text-center transition active:scale-[0.97]",
              you
                ? "bg-[var(--you-surface-low)] ring-1 ring-black/5"
                : "bg-black/[0.03] ring-1 ring-black/5 hover:bg-black/[0.055]",
              on && (you ? "ring-2 ring-[var(--you-primary)]" : "ring-2 ring-accent")
            )}
            style={{ borderRadius: you ? "var(--you-r-sm)" : 16 }}
          >
            <span className="bootpick__visual" aria-hidden="true">
              {s.id === "classic" && (
                <span className="bootpick__logo">
                  <img src="/logo.jpg" alt="" draggable={false} />
                  <span className="bootpick__gloss" />
                </span>
              )}

              {s.id === "dots" && (
                <span className="bootpick__orbit">
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} style={{ "--i": i } as CSSProperties} />
                  ))}
                </span>
              )}

              {s.id === "you" && (
                <span className="bootpick__you">
                  <span className="bootpick__you-icon">
                    <img src="/splash-icon.png" alt="" draggable={false} />
                  </span>
                  <span className="bootpick__you-brand">You</span>
                </span>
              )}
            </span>

            <span
              className={cn(
                "text-[11px] font-bold leading-tight",
                you ? "text-[var(--you-on-surface)]" : "text-ink"
              )}
            >
              {s.name}
            </span>

            {on && (
              <span
                className="absolute right-1.5 top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full"
                style={{ background: you ? "var(--you-primary)" : "var(--color-accent)" }}
              >
                <Check className="h-2.5 w-2.5 text-white" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
