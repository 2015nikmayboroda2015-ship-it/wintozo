import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Download,
  HardDriveDownload,
  Loader2,
  LogOut,
  Package,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Store,
  XCircle,
} from "lucide-react";
import { supabase, type Profile } from "../lib/supabase";
import { APP_VERSION } from "../lib/checkVersion";
import { canInstallOta, installOta, onOtaStatus, type OtaStatusEvent } from "../lib/ota";

type CatalogApp = {
  id: string;
  name: string;
  packageId: string;
  description: string;
  badge?: string;
};

const CATALOG: CatalogApp[] = [
  {
    id: "winchat",
    name: "WinChat",
    packageId: "org.wintozo.messenger",
    description: "Основной мессенджер WinChat: чаты, каналы, группы и обновления.",
    badge: "Messenger",
  },
  {
    id: "winchat-you",
    name: "WinChat You",
    packageId: "org.winchat.you",
    description: "Отдельное приложение WinChat только в теме Material You.",
    badge: "You",
  },
  {
    id: "wintozo-store",
    name: "Wintozo Store",
    packageId: "com.winchat.store",
    description: "Магазин приложений Wintozo: загрузка APK и управление OTA.",
    badge: "Store",
  },
];

type OtaConfig = {
  ok?: boolean;
  url?: string | null;
  version?: string | null;
  target?: string | null;
  description?: string | null;
  error?: string;
};

export default function StoreApp({
  me,
  session,
  onLogout,
}: {
  me: Profile;
  session: Session;
  onLogout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OtaStatusEvent | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [ota, setOta] = useState<OtaConfig | null>(null);
  const [otaUrl, setOtaUrl] = useState("");
  const [otaVersion, setOtaVersion] = useState("");
  const [otaTarget, setOtaTarget] = useState("*");
  const [otaDesc, setOtaDesc] = useState("");
  const [otaSaving, setOtaSaving] = useState(false);

  const [customUrl, setCustomUrl] = useState("");

  const isAdmin = useMemo(() => (me.username || "").toLowerCase() === "admin", [me.username]);
  const nativeInstall = canInstallOta();

  useEffect(() => {
    let off: (() => void) | undefined;
    void (async () => {
      off = await onOtaStatus((event) => {
        setStatus(event);
        if (event.state === "downloading") {
          if (typeof event.progress === "number" && Number.isFinite(event.progress)) {
            setProgress(Math.max(0, Math.min(100, Math.round(event.progress))));
          } else {
            setProgress((p) => (p == null ? 0 : p));
          }
        } else if (event.state === "installing" || event.state === "permission") {
          setProgress(100);
        } else if (event.state === "error") {
          setActiveDownload(null);
        }
      });
    })();
    return () => {
      try {
        off?.();
      } catch {
        /* no-op */
      }
    };
  }, []);

  async function loadOta() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("get_winchat_ota");
      if (error) throw error;
      const res = (data || {}) as OtaConfig;
      setOta(res);
      if (res?.url) setOtaUrl(String(res.url));
      if (res?.version != null) setOtaVersion(String(res.version));
      if (res?.target != null) setOtaTarget(String(res.target || "*"));
      if (res?.description != null) setOtaDesc(String(res.description));
    } catch (e) {
      setNotice({ ok: false, text: `Не удалось загрузить OTA: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadOta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveOta(disable = false) {
    setOtaSaving(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.rpc("set_winchat_ota", {
        _admin_id: session.user.id,
        _url: disable ? "" : otaUrl.trim(),
        _version: disable ? null : (otaVersion.trim() || null),
        _target: disable ? null : (otaTarget.trim() || "*"),
        _desc: disable ? null : (otaDesc.trim() || null),
      });
      if (error) throw error;
      const res = (data || {}) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(res.error || "Ошибка сохранения OTA");
      setNotice({ ok: true, text: res.message || (disable ? "OTA отключена" : "OTA сохранена") });
      await loadOta();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message });
    } finally {
      setOtaSaving(false);
    }
  }

  async function startDownload(app: CatalogApp | { id: string; name: string }, url: string) {
    const clean = (url || "").trim();
    if (!clean) {
      setNotice({ ok: false, text: "Нет ссылки для загрузки этого приложения" });
      return;
    }
    setNotice(null);
    setStatus(null);
    setProgress(nativeInstall ? 0 : null);
    setActiveDownload(app.id);
    try {
      const res = await installOta(clean);
      if (res.fallback) {
        setNotice({ ok: true, text: "Ссылка на APK открыта. Если загрузка не началась, откройте её в браузере." });
        setProgress(null);
      }
    } catch (e) {
      setNotice({ ok: false, text: `Ошибка загрузки: ${(e as Error).message}` });
      setProgress(null);
      setActiveDownload(null);
    } finally {
      if (!nativeInstall) setActiveDownload(null);
    }
  }

  const statusText =
    status?.state === "downloading"
      ? `Загрузка${progress != null ? `: ${progress}%` : "…"}`
      : status?.state === "permission"
        ? "Нужно разрешение на установку из неизвестных источников"
        : status?.state === "installing"
          ? "Открыт установщик APK"
          : status?.state === "error"
            ? (status.message || "Ошибка установки")
            : null;

  return (
    <div className="font-app min-h-dvh bg-[radial-gradient(1200px_600px_at_10%_-10%,#d9e7ff_0%,transparent_60%),radial-gradient(900px_500px_at_100%_0%,#e8fff4_0%,transparent_55%),#f3f6fb] text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_20px_60px_-30px_rgba(16,18,20,0.35)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] bg-white shadow-lg ring-1 ring-black/5 sm:h-16 sm:w-16">
              <img src="/logo.jpg" alt="Wintozo Store" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">Wintozo Store</h1>
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent">APK</span>
              </div>
              <p className="mt-0.5 text-[13px] font-medium text-black/50">
                Магазин приложений, загрузка и OTA-обновления · v{APP_VERSION}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="rounded-2xl border border-black/8 bg-white/80 px-3 py-2 text-right">
              <p className="text-[12px] font-bold text-ink">{me.nickname}</p>
              <p className="font-mono text-[11px] text-black/45">@{me.username}</p>
            </div>
            <button
              onClick={onLogout}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/8 bg-white/80 text-black/55 transition hover:bg-white hover:text-ink"
              title="Выйти"
              aria-label="Выйти"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {notice && (
          <div
            className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
              notice.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.ok ? <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />}
            <span>{notice.text}</span>
          </div>
        )}

        {(activeDownload || statusText) && (
          <div className="mb-4 rounded-2xl border border-accent/20 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                {status?.state === "error" ? <XCircle className="h-4.5 w-4.5 text-red-500" /> : <HardDriveDownload className="h-4.5 w-4.5 text-accent" />}
                <span>{statusText || "Подготовка загрузки…"}</span>
              </div>
              {progress != null && (
                <span className="font-mono text-sm font-extrabold text-accent">{progress}%</span>
              )}
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/8">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${status?.state === "error" ? "bg-red-500" : "bg-gradient-to-r from-accent to-emerald-500"}`}
                style={{ width: `${progress != null ? progress : status?.state === "error" ? 100 : 18}%` }}
              />
            </div>
            {!nativeInstall && (
              <p className="mt-2 text-[12px] text-black/45">
                Процент отображается в нативном Android-приложении. В браузере будет открыта ссылка на файл.
              </p>
            )}
          </div>
        )}

        <section className="mb-5">
          <div className="mb-3 flex items-center gap-2">
            <Store className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-extrabold tracking-tight">Приложения</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATALOG.map((app) => {
              const otaForWinchat = app.id === "winchat" ? (ota?.url || "") : "";
              const downloadUrl = otaForWinchat || (app.id !== "winchat" && customUrl.trim() ? customUrl.trim() : "");
              const downloading = activeDownload === app.id && status?.state !== "error" && status?.state !== "installing" && status?.state !== "permission";
              return (
                <div
                  key={app.id}
                  className="group flex flex-col rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_14px_40px_-24px_rgba(16,18,20,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow ring-1 ring-black/5">
                        <img src="/logo.jpg" alt={app.name} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="text-[16px] font-extrabold leading-tight text-ink">{app.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-black/45">{app.packageId}</p>
                      </div>
                    </div>
                    {app.badge && (
                      <span className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black/45">
                        {app.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 flex-1 text-[13px] leading-relaxed text-black/55">{app.description}</p>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => void startDownload(app, downloadUrl)}
                      disabled={downloading || !downloadUrl}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                    >
                      {downloading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Download className="h-4.5 w-4.5" />}
                      {downloading ? "Загрузка…" : downloadUrl ? "Скачать / Установить" : "Нет ссылки"}
                    </button>
                  </div>
                  {!downloadUrl && (
                    <p className="mt-2 text-[11px] font-medium text-black/40">
                      {app.id === "winchat"
                        ? "Администратор не задал OTA-ссылку для этого приложения."
                        : "Вставьте ссылку на APK в поле «Загрузка по ссылке» ниже или настройте OTA."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_20px_60px_-30px_rgba(16,18,20,0.35)] backdrop-blur-xl sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-extrabold tracking-tight">Загрузка по ссылке</h2>
          </div>
          <p className="mb-3 text-[13px] text-black/50">
            Вставьте прямую ссылку на APK, чтобы скачать и установить приложение с отображением прогресса (в нативном Android).
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://.../app.apk"
              className="w-full flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
            />
            <button
              onClick={() => void startDownload({ id: "custom", name: "APK" }, customUrl)}
              disabled={!customUrl.trim() || (activeDownload === "custom" && status?.state === "downloading")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-accent/20 transition hover:brightness-105 disabled:opacity-45"
            >
              <Download className="h-4.5 w-4.5" />
              Скачать APK
            </button>
          </div>
        </section>

        <section className="mt-auto rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_20px_60px_-30px_rgba(16,18,20,0.35)] backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Управление OTA</h2>
                <p className="text-[12px] font-medium text-black/45">
                  Редактирование OTA-таблицы/конфигурации обновлений (set/get winchat_ota)
                </p>
              </div>
            </div>
            <button
              onClick={() => void loadOta()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/8 bg-white px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-black/[0.03] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Обновить
            </button>
          </div>

          <div className="mb-4 grid gap-2 rounded-2xl bg-black/[0.03] p-3 text-[13px] text-black/60 sm:grid-cols-3">
            <div className="flex items-center gap-2"><Package className="h-4 w-4" /> Текущий URL: <span className="ml-auto truncate font-mono text-[11px] text-ink sm:ml-1">{ota?.url || "—"}</span></div>
            <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Версия/цель: <span className="ml-auto font-mono text-[11px] text-ink sm:ml-1">{ota?.version || "—"} · {ota?.target || "*"}</span></div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Статус: <span className="ml-auto font-semibold text-ink sm:ml-1">{ota?.url ? "включено" : "выключено"}</span></div>
          </div>

          {!isAdmin ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Редактирование OTA доступно администратору. Вы можете обновлять список и скачивать приложения по доступным ссылкам.
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-black/45">Ссылка на APK (URL)</span>
                <input
                  value={otaUrl}
                  onChange={(e) => setOtaUrl(e.target.value)}
                  placeholder="https://.../app-release.apk"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-black/45">Версия</span>
                  <input
                    value={otaVersion}
                    onChange={(e) => setOtaVersion(e.target.value)}
                    placeholder="6.0.2"
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-black/45">Цель (target)</span>
                  <input
                    value={otaTarget}
                    onChange={(e) => setOtaTarget(e.target.value)}
                    placeholder="* или @username"
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                  />
                </label>
              </div>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-black/45">Описание обновления</span>
                <textarea
                  value={otaDesc}
                  onChange={(e) => setOtaDesc(e.target.value)}
                  placeholder="Что нового в этой версии…"
                  rows={3}
                  className="w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void saveOta(false)}
                  disabled={otaSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {otaSaving ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
                  Сохранить OTA
                </button>
                <button
                  onClick={() => void saveOta(true)}
                  disabled={otaSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  Отключить OTA
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
