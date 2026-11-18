import { useEffect, useState } from "react";

/**
 * Лёгкий режим отрисовки для телефонов и слабых устройств.
 *
 * На мобильных Android WebView тяжёлые эффекты (blur на огромных слоях,
 * backdrop-filter, mix-blend-mode и пересчёт SVG-пути каждый кадр) приводят
 * к мерцанию, белым «квадратам» и просадке FPS. В лёгком режиме оставляем
 * тональный фон и статичные expressive-формы, но убираем всё GPU-тяжёлое.
 */
export function prefersLiteMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
    if (window.matchMedia?.("(max-width: 900px)").matches) return true;

    const nav = navigator as Navigator & {
      hardwareConcurrency?: number;
      connection?: { saveData?: boolean };
    };
    /* Мало ядер или включён режим экономии трафика — тоже лёгкий режим. */
    if ((nav.hardwareConcurrency ?? 8) <= 4) return true;
    if (nav.connection?.saveData) return true;
  } catch {
    /* приватный режим / старый WebView — считаем обычным */
  }
  return false;
}

/** Подписка на смену размера экрана, чтобы лёгкий режим обновлялся сам. */
export function useLiteMotion(): boolean {
  const [lite, setLite] = useState(() => prefersLiteMotion());

  useEffect(() => {
    const mq = window.matchMedia?.("(pointer: coarse), (max-width: 900px)");
    if (!mq) return;
    const onChange = () => setLite(prefersLiteMotion());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return lite;
}
