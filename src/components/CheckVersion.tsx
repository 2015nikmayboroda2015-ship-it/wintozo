import { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import {
  APP_VERSION,
  isVersionNewer,
  shouldShowUpdateBanner,
  dismissUpdateBanner,
  getChangelog,
  shouldShowWhatsNew,
  markWhatsNewSeen,
} from "../lib/checkVersion";
import {
  initDeviceOta,
  installOta,
  onOtaStatus,
  isOtaDismissed,
  dismissOta,
  type OtaInfo,
  type OtaState,
} from "../lib/ota";

export default function CheckVersion() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [ota, setOta] = useState<OtaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [otaDismissed, setOtaDismissed] = useState(false);
  const [otaBusy, setOtaBusy] = useState(false);
  const [otaState, setOtaState] = useState<OtaState | null>(null);

  /* Статус устройства + check_version + поиск OTA при запуске */
  useEffect(() => {
    let cancelled = false;

    initDeviceOta()
      .then((res) => {
        if (cancelled) return;
        setLatestVersion(res.latestVersion);
        setOta(res.ota);
        setLoading(false);

        if (res.ota) {
          if (isOtaDismissed(res.ota.url)) setOtaDismissed(true);
          return;
        }

        /* Баннер обновления по версии */
        if (res.latestVersion && shouldShowUpdateBanner(res.latestVersion)) {
          return;
        }

        /* Баннер "Что нового" после входа */
        if (shouldShowWhatsNew()) {
          setShowWhatsNew(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Прогресс нативного установщика */
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void onOtaStatus((event) => {
      setOtaState(event.state);
      if (event.state === "error" || event.state === "installing") {
        setOtaBusy(false);
      }
      if (event.state === "downloading" || event.state === "permission") {
        setOtaBusy(true);
      }
    }).then((fn) => {
      dispose = fn;
    });
    return () => dispose?.();
  }, []);

  const newer = latestVersion && isVersionNewer(latestVersion, APP_VERSION);
  const showOta = Boolean(ota) && !otaDismissed;
  const showVersionBanner = Boolean(newer) && !ota;

  function dismissUpdate() {
    setDismissed(true);
    if (latestVersion) dismissUpdateBanner(latestVersion);
  }

  function closeWhatsNew() {
    setShowWhatsNew(false);
    markWhatsNewSeen();
  }

  function dismissOtaBanner() {
    setOtaDismissed(true);
    if (ota) dismissOta(ota.url);
  }

  async function startOta() {
    if (!ota || otaBusy) return;
    setOtaBusy(true);
    setOtaState("downloading");
    try {
      const res = await installOta(ota.url);
      if (res.fallback) {
        setOtaBusy(false);
        setOtaState(null);
      }
    } catch {
      setOtaBusy(false);
      setOtaState("error");
    }
  }

  function otaSubtitle(): string {
    if (otaState === "permission") {
      return "Разрешите установку из этого источника и вернитесь в приложение";
    }
    if (otaState === "error") {
      return "Не удалось скачать обновление. Попробуйте ещё раз";
    }
    if (otaState === "installing") {
      return "Открываем системный установщик…";
    }
    if (otaBusy || otaState === "downloading") {
      return "Загрузка обновления…";
    }
    return "Нажмите «Установить», чтобы обновить приложение";
  }

  if (loading) return null;
  if (dismissed) return null;

  return (
    <>
      {/* Баннер OTA / обновления версии */}
      {(showOta || showVersionBanner) && (
        <div className="fixed inset-x-0 top-0 z-[200] animate-fade-in">
          <div className="mx-auto my-2 max-w-md rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-3 px-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-900" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-amber-900">
                  {showOta
                    ? `Доступно обновление${ota?.version ? ` ${ota.version}` : ""}`
                    : `Доступна версия ${latestVersion}`}
                </p>
                <p className="text-[11px] font-medium text-amber-800/75">
                  {showOta
                    ? otaSubtitle()
                    : `Текущая: ${APP_VERSION} — обновите для новых функций`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {showOta && (
                  <button
                    type="button"
                    onClick={startOta}
                    disabled={otaBusy}
                    className="flex items-center gap-1 rounded-xl bg-amber-900/20 px-3 py-1.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-900/30 disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {otaBusy ? "Загрузка…" : "Установить"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={showOta ? dismissOtaBanner : dismissUpdate}
                  className="rounded-full p-1 text-amber-900/60 transition hover:bg-amber-900/15 hover:text-amber-900"
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно "Что нового" */}
      {showWhatsNew && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <button
            onClick={closeWhatsNew}
            className="absolute inset-0"
            aria-label="Закрыть"
          />
          <div className="animate-scale-in relative w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeWhatsNew}
              className="absolute top-4 right-4 rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-extrabold tracking-tight">Что нового</h3>
            </div>

            <p className="mt-3 font-mono text-[11px] font-bold text-accent">
              v{APP_VERSION}
            </p>

            {(() => {
              const entry = getChangelog(APP_VERSION);
              if (!entry) return null;
              return (
                <>
                  <p className="mt-3 text-sm font-medium text-black/60">{entry.title}</p>
                  <ul className="mt-3 space-y-2">
                    {entry.items.map((item: string) => (
                      <li key={item} className="flex items-start gap-2 text-sm font-semibold text-ink">
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
