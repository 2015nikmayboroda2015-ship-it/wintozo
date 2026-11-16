import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./boot.css";

type Phase = "loading" | "converge" | "reveal" | "exit";

const OUTER_DOTS = 16;
const INNER_DOTS = 10;

/** Минимум, чтобы точки успели покрутиться, а не просто мигнули. */
const MIN_LOAD_MS = 950;
/** Первый запуск / запуск после обновления: вся анимация длится ~10–13 с
 *  (7–10 с крутятся точки + ~3 с на сход, логотип и подпись). */
const LONG_LOAD_MIN_MS = 7000;
const LONG_LOAD_MAX_MS = 10000;
const CONVERGE_MS = 680;
const REVEAL_MS = 1800;
const EXIT_MS = 460;

interface Props {
  /** Приложение загружено — точкам пора сходиться в логотип. */
  ready: boolean;
  /** Первый запуск или обновление: анимация загрузки заметно длиннее. */
  long?: boolean;
  /** classic — старая заставка с переливающимся логотипом, dots — новая. */
  variant?: "dots" | "classic";
  onDone: () => void;
}

function Orbit({ count, layer }: { count: number; layer: "outer" | "inner" }) {
  return (
    <div className={`boot__orbit boot__orbit--${layer}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        /* Хвост кометы: точки в начале круга ярче и крупнее. */
        const t = (count - i) / count;
        return (
          <span
            key={i}
            className="boot__dot"
            style={
              {
                "--i": i,
                "--step": `${360 / count}deg`,
                "--o": (0.18 + 0.82 * t).toFixed(3),
                "--k": (0.7 + 0.45 * t).toFixed(3),
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/**
 * Стартовый экран WinChat: на белом фоне по двум орбитам крутятся
 * чёрные точки. Когда сервер готов, они слетаются в центр, мягко
 * вспыхивает свет, появляется логотип, а из-под него выезжает надпись.
 */
export default function BootAnimation({
  ready,
  long = false,
  variant = "dots",
  onDone,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  /* Длительность фиксируем на маунт (10–13 с при первом запуске/обновлении). */
  const minWaitMs = useMemo(
    () =>
      long
        ? LONG_LOAD_MIN_MS + Math.random() * (LONG_LOAD_MAX_MS - LONG_LOAD_MIN_MS)
        : MIN_LOAD_MS,
    [long],
  );
  const startedAt = useRef(Date.now());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /* Загрузка: точки крутятся, пока сервер не отдал данные (ready). */
  useEffect(() => {
    if (phase !== "loading" || !ready) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, minWaitMs - elapsed);
    const timer = window.setTimeout(() => setPhase("converge"), wait);
    return () => window.clearTimeout(timer);
  }, [phase, ready, minWaitMs]);

  /* Дальше фазы идут строго по таймеру. */
  useEffect(() => {
    if (phase === "converge") {
      const timer = window.setTimeout(() => setPhase("reveal"), CONVERGE_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "reveal") {
      const timer = window.setTimeout(() => setPhase("exit"), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "exit") {
      const timer = window.setTimeout(() => doneRef.current(), EXIT_MS);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  return (
    <div
      className="boot"
      data-phase={phase}
      data-variant={variant}
      role="status"
      aria-live="polite"
      aria-label="Загрузка WinChat"
    >
      <div className="boot__stage" aria-hidden="true">
        {variant === "dots" && (
          <>
            <div className="boot__orbits">
              <Orbit count={OUTER_DOTS} layer="outer" />
              <Orbit count={INNER_DOTS} layer="inner" />
            </div>

            <span className="boot__core" />
            <span className="boot__flash" />
            <span className="boot__halo" />
            <span className="boot__pulse" />
            <span className="boot__line" />
          </>
        )}

        <div className="boot__mark">
          <img src="/logo.jpg" alt="" draggable={false} />
          <span className="boot__shine" />
        </div>

        {variant === "dots" && (
          <div className="boot__word">
            <span>WinChat</span>
          </div>
        )}
      </div>
    </div>
  );
}
