/* ============================================================
   Настройки стартовой заставки (boot animation).

   • classic — старая «переливающаяся» заставка из первых релизов:
     логотип по центру с бегущим блеском;
   • dots — новая: чёрные точки слетаются в логотип;
   • you — WinChat You (Material You): голубой тональный фон,
     настоящий логотип и перетекающие формы Material 3 Expressive.
   ============================================================ */

export type BootStyle = "classic" | "dots" | "you";

/** Уникальный номер каждой boot-анимации. Изначально активна — «dots» (№1). */
export const BOOT_STYLE_NUMBERS: Record<BootStyle, number> = {
  dots: 1,
  you: 2,
  classic: 3,
};

export function getBootStyleNumber(style: BootStyle = getBootStyle()): number {
  return BOOT_STYLE_NUMBERS[style];
}

export const BOOT_STYLES: { id: BootStyle; name: string; description: string }[] = [
  {
    id: "classic",
    name: "Стандартная",
    description: "Классический логотип с переливом",
  },
  {
    id: "dots",
    name: "Новая",
    description: "Чёрные точки слетаются в логотип",
  },
  {
    id: "you",
    name: "WinChat You",
    description: "Голубой фон и формы Material You",
  },
];

export const BOOT_STYLE_KEY = "winchat_boot_style";
/** Пользователю уже предлагали переключить заставку на You-стиль. */
const YOU_BOOT_ASKED_KEY = "winchat_you_boot_asked";

export function getBootStyle(): BootStyle {
  try {
    const v = localStorage.getItem(BOOT_STYLE_KEY);
    return v === "classic" || v === "dots" || v === "you" ? v : "dots";
  } catch {
    return "dots";
  }
}

export function saveBootStyle(id: BootStyle): void {
  try {
    localStorage.setItem(BOOT_STYLE_KEY, id);
  } catch {
    /* no-op */
  }
  window.dispatchEvent(new Event("winchat-boot-style-change"));
}

/** Плашку «переключить заставку на You?» уже показывали. */
export function isYouBootAsked(): boolean {
  try {
    return localStorage.getItem(YOU_BOOT_ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markYouBootAsked(): void {
  try {
    localStorage.setItem(YOU_BOOT_ASKED_KEY, "1");
  } catch {
    /* no-op */
  }
}
