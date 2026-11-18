import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  Palette,
  Play,
  Scale,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { OobeVariant } from "./OobeThemeChooser";
import {
  applyTheme,
  getThemeById,
  saveThemeId,
  THEMES,
  YOU_THEME_ID,
} from "../../lib/themes";
import { applyYouPalette, getYouSeedId } from "../../lib/materialYou";
import {
  OobeMorphMark,
  OobeYouBackdrop,
  OobeYouButton,
  OobeYouSteps,
  OobeYouTopBar,
  useOobeShell,
  youPaletteStyle,
} from "./OobeYouKit";

interface Props {
  /** Активен ли WinPro у пользователя (null — ещё проверяется). */
  winPro: boolean | null;
  /** Завершить OOBE и открыть список чатов. */
  onFinish: () => void;
  /** Стиль OOBE (в 6.0 всегда Material You). */
  variant?: OobeVariant;
}

/** Что нового в WinChat 6.0 (шаг 3). */
const WHATS_NEW = [
  "Material You — живые палитры и тональные поверхности",
  "Новый шрифт Google Sans в Material You",
  "Expressive-формы из заставки теперь в интерфейсе",
  "Каналы, приглашения и OTA-обновления стали надёжнее",
];

/**
 * OOBE обновления до WinChat 6.0 в стиле Material You:
 * приветствие → живое превью → активация темы → «Что нового».
 * Фон и логотип используют expressive-формы из бут-анимации You.
 */
export default function OobeUpdate({
  winPro,
  onFinish,
  variant = "you",
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activated, setActivated] = useState(false);
  const palette = useMemo(() => youPaletteStyle(), []);

  /* Пока OOBE открыт — гасим фоновые анимации WinPro на <html>. */
  useOobeShell();

  const stepLabel =
    step === 1 ? "Обновление" : step === 2 ? "Живое превью" : "Что нового";

  /* Прокручиваем страницу наверх при смене шага (на всякий случай). */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  /* Активировать тему WinChat You (Material You) — кнопка на шаге 2. */
  function activateYou() {
    saveThemeId(YOU_THEME_ID);
    applyTheme(getThemeById(YOU_THEME_ID) ?? THEMES[0]);
    applyYouPalette(getYouSeedId());
    setActivated(true);
  }

  return (
    <div
      className="theme-you oobe-you-page"
      style={palette}
      data-variant={variant}
    >
      {/* Живой фон из форм бут-анимации */}
      <OobeYouBackdrop />

      <OobeYouTopBar subtitle={stepLabel} />

      <main className="oobe-you-main">
        <OobeYouSteps value={step - 1} total={3} />

        {/* ================================================== ШАГ 1: Приветствие */}
        {step === 1 && (
          <section key="update-1" className="oobe-you-step oobe-you-center">
            <OobeMorphMark className="oobe-you-hero-mark" />

            <span className="oobe-you-eyebrow">
              <Sparkles />
              WinChat 6.0 · Material You
            </span>

            <h1 className="oobe-you-h1">
              Обновление завершено
              <span className="oobe-you-grad">Встречайте Material You</span>
            </h1>

            <p className="oobe-you-lead">
              Живые формы из заставки, тональные поверхности и новая палитра —
              WinChat стал мягче и выразительнее.
            </p>

            <div className="oobe-you-actions">
              <OobeYouButton
                label="Смотреть превью"
                leading={<Play />}
                onClick={() => setStep(2)}
              />
            </div>

            <div className="oobe-you-chips">
              <span className="oobe-you-chip">
                <WandSparkles /> Expressive-формы
              </span>
              <span className="oobe-you-chip">
                <Palette /> Живые палитры
              </span>
              <span className="oobe-you-chip">
                <ShieldCheck /> Всё на месте
              </span>
            </div>
          </section>
        )}

        {/* ================================================== ШАГ 2: Превью + Сравнение */}
        {step === 2 && (
          <section key="update-2" className="oobe-you-step oobe-you-stack">
            <span className="oobe-you-kicker">
              <Scale />
              Сравнение
            </span>

            <div className="oobe-you-video-grid">
              <OobeYouVideo src="/Preview_you.mp4" caption="WinChat You 2.0–5.0" />
              <OobeYouVideo src="/winchat_new_prewiew.mp4" caption="WinChat 6.0" />
            </div>

            <span className="oobe-you-eyebrow">
              <WandSparkles />
              Так теперь выглядит WinChat
            </span>

            <h1 className="oobe-you-h2">
              WinChat 6.0
              <span className="oobe-you-grad">Встречайте новый улучшенный WinChat You</span>
            </h1>

            <p className="oobe-you-lead">
              Одна палитра для кнопок, сообщений и фона. Форму интерфейса можно
              менять в настройках WinChat You.
            </p>

            {winPro ? (
              <div className="oobe-you-actions">
                <OobeYouButton
                  variant={activated ? "tonal" : "filled"}
                  label={
                    activated
                      ? "Тема WinChat You активирована"
                      : "Активировать WinChat You"
                  }
                  leading={activated ? <CheckCheck /> : <Palette />}
                  onClick={activateYou}
                  disabled={activated}
                />
              </div>
            ) : (
              <p className="oobe-you-lead">
                Активация Material You доступна с WinPro — оформить можно во
                вкладке «WinPro» в настройках.
              </p>
            )}

            <OobeYouButton
              variant="text"
              label={winPro ? "Далее" : "Пропустить"}
              onClick={() => setStep(3)}
              disabled={winPro === null}
            />
          </section>
        )}

        {/* ================================================== ШАГ 3: Что нового */}
        {step === 3 && (
          <section key="update-3" className="oobe-you-step oobe-you-stack">
            <OobeMorphMark settle className="oobe-you-success-mark" />

            <span className="oobe-you-eyebrow">
              <Sparkles />
              Что нового в 6.0
            </span>

            <h1 className="oobe-you-h2">
              Больше жизни
              <span className="oobe-you-grad">в каждом касании</span>
            </h1>

            <p className="oobe-you-lead">
              Самое важное из обновления — коротко и по делу.
            </p>

            <div className="oobe-you-list">
              {WHATS_NEW.map((text, i) => (
                <div
                  key={text}
                  className="oobe-you-list-item"
                  style={{ animationDelay: `${0.08 + i * 0.09}s` }}
                >
                  <span className="oobe-you-list-num">
                    <Check />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <OobeYouButton
              label="Продолжить"
              onClick={onFinish}
              leading={<CheckCheck />}
            />
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------- Превью в «Сравнении»: старый и новый ролик ---------- */

function OobeYouVideo({ src, caption }: { src: string; caption: string }) {
  return (
    <div className="oobe-you-video-item">
      <div className="oobe-you-video">
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className="block h-auto w-full"
        />
        <span className="oobe-you-video-tag">
          <Play />
          Живое превью
        </span>
      </div>
      <p className="oobe-you-video-caption">{caption}</p>
    </div>
  );
}

/* ---------- Совместимость: старая кнопка OOBE ---------- */
export function OobeButton({
  label,
  onClick,
  className,
  disabled,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  /** Стиль WinChat You (в 6.0 всегда Material You). */
  you?: boolean;
}) {
  return (
    <OobeYouButton
      label={label}
      onClick={onClick}
      disabled={disabled}
      className={className}
    />
  );
}
