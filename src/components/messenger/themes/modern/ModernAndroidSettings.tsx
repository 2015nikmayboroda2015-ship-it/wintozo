import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bug,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  Crown,
  Info,
  Loader2,
  Lock,
  LogOut,
  Palette,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { isGlassGranted, isVerified, supabase, type Profile } from "../../../../lib/supabase";
import { filesUpload } from "../../../../lib/blobStorage";
import { normalizeWinpass, validateBio, validateNickname, validatePassword } from "../../../../lib/utils";
import Avatar from "../../../Avatar";
import CrownBadge from "../../../Crown";
import Verified from "../../../Verified";
import { cn } from "../../../../utils/cn";
import {
  ALL_THEMES,
  applyTheme,
  getThemeById,
  GLASS_THEME_ID,
  saveThemeId,
  THEMES,
  WINPRO_THEMES,
  YOU_THEME_ID,
  type Theme,
  type WinProTheme,
} from "../../../../lib/themes";
import {
  YOU_SEEDS,
  applyYouPalette,
  getYouSeedId,
  getYouShape,
  saveYouSeedId,
  type YouShape,
} from "../../../../lib/materialYou";
import { navigate } from "../../../../lib/router";
import { hasWinPro, winproDaysLeft, winproExpiresLabel } from "../../../../lib/winpro";
import { ANIMATIONS, getAnimationId, saveAnimationId } from "../../../../lib/animations";
import { getBootStyle, saveBootStyle, type BootStyle } from "../../../../lib/bootAnimation";
import BootStylePicker from "../../../BootStylePicker";
import YouShapePicker from "../../../YouShapePicker";
import {
  APP_VERSION,
  DOWNLOAD_URL,
  fetchLatestVersion,
  getCachedServerVersion,
  isVersionNewer,
} from "../../../../lib/checkVersion";
import {
  getDeviceInfo,
  installOta,
  markOtaSeen,
  onOtaStatus,
  reportDeviceStatus,
  searchOta,
  type DeviceInfo,
  type OtaInfo,
  type OtaState,
} from "../../../../lib/ota";
import DevModePanel from "../../../DevModePanel";
import {
  isDevMode,
  registerVersionTap,
  setDevMode,
  subscribeDevMode,
} from "../../../../lib/devMode";
import { devLog } from "../../../../lib/devLogs";

type View = "menu" | "winpro" | "about" | "customization" | "security" | "dev";

interface Props {
  me: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
  onLogout: () => void;
  /** Ивент «Память о Wintozo»: показать плашку выбора интерфейса. */
  onShowLegacy?: () => void;
  /** Какой экран открыть сразу (роут /settings/status/winpro и т.п.). */
  initialView?: View;
  /** Режим WinChat You / Glass (настройки открыты из тематического режима). */
  youMode?: boolean;
}

/**
 * Настройки для нативного Android: полноэкранная страница вместо модалки.
 * Сверху — профиль (аватар, никнейм, описание) с SVG-карандашом для
 * редактирования, ниже — четыре пункта: Статус WinPro, О приложении,
 * Кастомизация, Безопасность. Все иконки — SVG (lucide), стили
 * подхватываются всеми темами (стандартные, WinChat You, Glass).
 */
export default function AndroidSettings({
  me,
  onClose,
  onSaved,
  onLogout,
  onShowLegacy,
  initialView = "menu",
  youMode = false,
}: Props) {
  const [view, setView] = useState<View>(initialView);
  /** Скрытый режим разработчика (4 нажатия на версию приложения). */
  const [devMode, setDevModeState] = useState<boolean>(() => isDevMode());

  /* --- Профиль --- */
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* --- WinPro --- */
  const winPro = hasWinPro(me);
  const [animId, setAnimId] = useState<string>(() => getAnimationId());

  /* --- Кастомизация --- */
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem("winchat_theme_id") || "ink-blue"
  );
  const [youSeed, setYouSeed] = useState<string>(() => getYouSeedId());
  const [youShape, setYouShape] = useState<YouShape>(() => getYouShape());
  const [bootStyle, setBootStyle] = useState<BootStyle>(() => getBootStyle());
  const glassAllowed = isGlassGranted(me);
  /** Открыты настройки внутри темы You — используем её тона. */
  const you = youMode || currentId === YOU_THEME_ID;

  /* --- О приложении --- */
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(() => getCachedServerVersion());
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [aboutOta, setAboutOta] = useState<OtaInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [otaBusy, setOtaBusy] = useState(false);
  const [otaState, setOtaState] = useState<OtaState | null>(null);

  /* --- Безопасность --- */
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [wpCopied, setWpCopied] = useState(false);

  /* Данные устройства для экрана «О приложении». */
  useEffect(() => {
    let alive = true;
    void getDeviceInfo().then((d) => {
      if (alive) setDevice(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Скрытый режим разработчика: следим за флагом. */
  useEffect(() => subscribeDevMode(() => setDevModeState(isDevMode())), []);
  useEffect(() => {
    if (!devMode && view === "dev") setView("menu");
  }, [devMode, view]);

  /* Прогресс нативного установщика APK. */
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void onOtaStatus((event) => {
      setOtaState(event.state);
      if (event.state === "downloading" || event.state === "permission") {
        setOtaBusy(true);
      } else {
        setOtaBusy(false);
      }
    }).then((fn) => {
      dispose = fn;
    });
    return () => dispose?.();
  }, []);

  /* ===== Профиль: загрузка аватара и сохранение ===== */
  async function uploadAvatar(file: File) {
    setError(null);
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${me.id}/avatar.${ext}`;
      const url = `${await filesUpload("avatars", path, file, file.type)}?t=${Date.now()}`;
      const { data: row, error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", me.id)
        .select()
        .single();
      if (pErr) throw pErr;
      onSaved(row as Profile);
    } catch {
      setError("Не удалось загрузить фото. Проверьте размер файла.");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    const nErr = validateNickname(nickname);
    if (nErr) return setError(nErr);
    const bErr = validateBio(bio);
    if (bErr) return setError(bErr);
    setError(null);
    setSaving(true);
    const { data, error: pErr } = await supabase
      .from("profiles")
      .update({ nickname: nickname.trim(), bio: bio.trim() || null })
      .eq("id", me.id)
      .select()
      .single();
    setSaving(false);
    if (pErr || !data) return setError("Не удалось сохранить профиль");
    onSaved(data as Profile);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
    setEditing(false);
  }

  /* ===== О приложении ===== */
  async function checkUpdates() {
    if (checking) return;
    setChecking(true);
    try {
      const d = await reportDeviceStatus(true);
      setDevice(d);
      const [server, otaRes] = await Promise.all([
        fetchLatestVersion(),
        d.isAndroid && !d.isWintozoWeb ? searchOta(d.deviceId) : Promise.resolve(null),
      ]);
      setServerVersion(server);
      setAboutOta(otaRes);
      const latest =
        otaRes?.version && server && isVersionNewer(otaRes.version, server)
          ? otaRes.version
          : server;
      setLatestVersion(latest);
    } catch {
      /* нет сети — просто ничего не обновляем */
    } finally {
      setChecking(false);
    }
  }

  async function startAboutOta() {
    if (!aboutOta || otaBusy) return;
    setOtaBusy(true);
    setOtaState("downloading");
    // Запоминаем запись OTA как установленную: пересборка с той же
    // версией предложится снова только после следующей перезаливки.
    markOtaSeen(aboutOta);
    try {
      const res = await installOta(aboutOta.url);
      if (res.fallback) {
        setOtaBusy(false);
        setOtaState(null);
      }
    } catch {
      setOtaBusy(false);
      setOtaState("error");
    }
  }

  function deviceLabel(): string {
    if (!device) return "…";
    const name = [device.manufacturer, device.model].filter(Boolean).join(" ").trim();
    if (name) return name;
    return device.isWintozoWeb ? "Браузер (web)" : "Android";
  }

  function androidLabel(): string {
    if (!device) return "…";
    if (!device.isAndroid) return "—";
    if (!device.isWintozoWeb) return device.osVersion || "—";
    const m = /Android\s+([\d.]+)/i.exec(typeof navigator !== "undefined" ? navigator.userAgent : "");
    return m ? `Android ${m[1]}` : "Android";
  }

  function aboutStatus(): { kind: "idle" | "ok" | "update"; text: string } {
    if (aboutOta) {
      if (otaState === "permission") {
        return { kind: "update", text: "Разрешите установку из этого источника и вернитесь в приложение" };
      }
      if (otaState === "error") {
        return { kind: "update", text: "Не удалось скачать обновление. Попробуйте ещё раз" };
      }
      if (otaState === "installing") {
        return { kind: "update", text: "Открываем системный установщик…" };
      }
      if (otaBusy || otaState === "downloading") {
        return { kind: "update", text: "Загрузка обновления…" };
      }
      return { kind: "update", text: `Доступно обновление${aboutOta.version ? ` ${aboutOta.version}` : ""}` };
    }
    if (latestVersion && isVersionNewer(latestVersion, APP_VERSION)) {
      return { kind: "update", text: `Доступна версия ${latestVersion}` };
    }
    if (latestVersion) {
      return { kind: "ok", text: "У вас последняя версия WinChat" };
    }
    return { kind: "idle", text: "Нажмите «Проверить обновления»" };
  }

  /* ===== Безопасность ===== */
  async function changePassword() {
    const err = validatePassword(newPw);
    if (err) return setPwStatus({ type: "error", text: err });
    if (newPw !== newPw2) return setPwStatus({ type: "error", text: "Пароли не совпадают" });

    setPwStatus(null);
    setPwSaving(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (pwErr) {
      return setPwStatus({
        type: "error",
        text: /session|jwt/i.test(pwErr.message)
          ? "Сессия истекла — войдите заново и повторите."
          : pwErr.message,
      });
    }
    setPwStatus({ type: "ok", text: "Пароль обновлён — используйте его при следующем входе" });
    setNewPw("");
    setNewPw2("");
  }

  /* ===== Плитки палитр (мини-превью чата) ===== */
  function themeTile(t: Theme | WinProTheme, opts: { active: boolean; locked?: boolean; lightLabel?: boolean; onClick: () => void }) {
    return (
      <button
        key={t.id}
        type="button"
        onClick={opts.onClick}
        className={cn(
          "group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.97]",
          opts.active
            ? "border-accent shadow-lg shadow-accent/20"
            : "border-transparent hover:border-black/15",
          opts.locked && "opacity-60"
        )}
        style={{ background: t.chatBg }}
      >
        {opts.locked && (
          <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
            <Lock className="h-4 w-4 text-white" />
          </span>
        )}
        <div className="space-y-1.5">
          <div className="ml-auto h-2.5 w-10 rounded-full" style={{ background: t.ownerMsg }} />
          <div
            className="h-2.5 w-8 rounded-full"
            style={{ background: t.otherMsg, boxShadow: `inset 0 0 0 1px ${t.otherMsgBorder}` }}
          />
          <div className="ml-auto h-2.5 w-6 rounded-full" style={{ background: t.ownerMsg }} />
        </div>
        <div
          className="mt-2.5 h-1.5 w-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})` }}
        />
        <p
          className={cn("mt-2 text-[11px] font-bold leading-tight", opts.lightLabel ? "text-white" : "")}
          style={opts.lightLabel ? undefined : { color: t.id === "sunset" ? "#431407" : "#101214" }}
        >
          {t.name}
        </p>
      </button>
    );
  }

  /* Пункты главного меню */
  const MENU: { id: View; label: string; sub: string; icon: typeof Info }[] = [
    {
      id: "winpro",
      label: "Статус WinPro",
      sub: winPro ? `активен · ${winproDaysLeft(me)} дн.` : "не активен",
      icon: Crown,
    },
    { id: "about", label: "О приложении", sub: device?.appVersion || APP_VERSION, icon: Info },
    { id: "customization", label: "Кастомизация", sub: "темы и палитры", icon: Palette },
    { id: "security", label: "Безопасность", sub: "пароль и WinPass", icon: ShieldCheck },
  ];

  /* Режим разработчика добавляет скрытый пункт в конец меню. */
  const menuItems: typeof MENU = devMode
    ? [
        ...MENU,
        {
          id: "dev",
          label: "Режим разработчика",
          sub: "логи и монохром",
          icon: Bug,
        },
      ]
    : MENU;

  const TITLES: Record<Exclude<View, "menu">, string> = {
    winpro: "Статус WinPro",
    about: "О приложении",
    customization: "Кастомизация",
    security: "Безопасность",
    dev: "Режим разработчика",
  };

  /** 4 нажатия на версию приложения открывают режим разработчика. */
  function handleVersionTap() {
    if (!registerVersionTap()) return;
    devLog("developer mode unlocked by version taps");
    setDevMode(true);
    setDevModeState(true);
    setView("dev");
  }

  return (
    <div className="modern-phone-settings fixed inset-0 z-[80] flex flex-col animate-fade-in">
      {/* ================= ШАПКА ================= */}
      <div className="shrink-0 border-b border-black/6 bg-white/75 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          {view === "menu" ? (
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-white shadow-md shadow-ink/15">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">WinChat</p>
                <span className="text-[17px] font-extrabold tracking-tight text-ink leading-none">Настройки</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setView("menu")}
              className="-ml-1 flex items-center gap-2 rounded-2xl px-2 py-2 text-ink transition hover:bg-black/5 active:scale-95"
              aria-label="Назад"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.04]">
                <ArrowLeft className="h-4.5 w-4.5" />
              </span>
              <span className="text-[16px] font-extrabold tracking-tight">{TITLES[view]}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/8 bg-white/70 text-black/45 shadow-sm transition hover:bg-white hover:text-ink active:scale-95"
            aria-label="Закрыть настройки"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ================= КОНТЕНТ ================= */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5">
        <div className="mx-auto w-full max-w-md">
          {/* ---------------- ГЛАВНОЕ МЕНЮ ---------------- */}
          {view === "menu" && (
            <div className="animate-fade-in">
              {/* Профиль: аватарка, никнейм, описание */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => editing && fileRef.current?.click()}
                    className={cn(
                      "relative rounded-[28px] transition",
                      editing && "hover:brightness-110 active:scale-95"
                    )}
                    aria-label={editing ? "Сменить фото профиля" : undefined}
                  >
                    <Avatar profile={me} size="xl" showWinPro />
                    {editing && (
                      <span className="absolute -right-1.5 -bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white shadow-lg ring-4 ring-paper">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </span>
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAvatar(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {!editing ? (
                  <>
                    <div className="mt-3 flex items-center justify-center gap-1.5">
                      <h2 className="text-[20px] leading-tight font-extrabold tracking-tight text-ink">
                        {me.nickname}
                      </h2>
                      {isVerified(me) && (
                        <Verified
                          level={
                            me.verify_status && me.verify_status !== "user"
                              ? me.verify_status
                              : "full"
                          }
                        />
                      )}
                      {winPro && <CrownBadge size="xs" className="h-4 w-4" />}
                    </div>
                    <p className="mt-1 max-w-[320px] text-[13px] leading-relaxed font-medium text-black/50">
                      {me.bio || "Описание пока пустое"}
                    </p>
                  </>
                ) : (
                  <div className="mt-4 w-full space-y-2.5">
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-paper px-4 py-3 text-center text-[15px] font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                      placeholder="Никнейм"
                    />
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 160))}
                      rows={3}
                      placeholder="Пара слов о вас — это описание увидят собеседники"
                      className="w-full resize-none rounded-xl border border-black/10 bg-paper px-4 py-3 text-center text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                    />
                    <p className="text-right font-mono text-[10px] text-black/35">{bio.length}/160</p>
                  </div>
                )}

                {/* SVG-карандаш — редактирование профиля */}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (editing) void saveProfile();
                    else {
                      setNickname(me.nickname);
                      setBio(me.bio ?? "");
                      setEditing(true);
                    }
                  }}
                  disabled={saving}
                  className={cn(
                    "mt-3 flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-extrabold tracking-wide transition active:scale-[0.97] disabled:opacity-60",
                    savedTick
                      ? "bg-emerald-500 text-white"
                      : editing
                        ? "bg-ink text-white hover:bg-black"
                        : "border border-black/8 bg-white/60 text-ink hover:bg-white"
                  )}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedTick ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                  {savedTick ? "Сохранено" : editing ? "Сохранить" : "Редактировать профиль"}
                </button>

                {error && (
                  <div className="animate-fade-in mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-600">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Четыре пункта настроек */}
              <div className="mt-6 overflow-hidden rounded-2xl border border-black/8 bg-white/60">
                {menuItems.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-black/[0.03] active:scale-[0.99]",
                      i > 0 && "border-t border-black/5"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 text-ink">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-ink">{item.label}</span>
                      <span className="block truncate text-[11px] font-medium text-black/40">
                        {item.sub}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
                  </button>
                ))}
              </div>

              {/* Ивент «Память о Wintozo» */}
              {onShowLegacy && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onShowLegacy();
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-50 to-orange-50 py-3 text-sm font-bold text-amber-700 transition hover:brightness-105 active:scale-[0.99]"
                >
                  Память о Wintozo — сменить интерфейс
                </button>
              )}
            </div>
          )}

          {/* ---------------- СТАТУС WINPRO ---------------- */}
          {view === "winpro" && (
            <div className="animate-fade-in">
              {winPro ? (
                <>
                  <div className="winpro-card winpro-sweep-shine relative overflow-hidden rounded-[24px] p-6 text-center">
                    <div className="winpro-shine absolute inset-0" />
                    <div className="relative">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/15 backdrop-blur">
                        <Crown size="lg" className="h-9 w-9" />
                      </div>
                      <h4 className="mt-4 text-xl font-extrabold tracking-tight text-white">
                        WinPro активен
                      </h4>
                      <p className="mt-1.5 text-[13px] font-medium text-white/75">
                        Осталось {winproDaysLeft(me)} дн. — до {winproExpiresLabel(me)}
                      </p>
                      <div className="mt-5 space-y-2 text-left">
                        {[
                          "Золотая корона в профиле и чатах",
                          "Серая галочка верификации",
                          "Премиум-палитры: Золотая ночь, Неоновая аура, Королевский фиолет",
                          "Секретные анимации интерфейса",
                        ].map((f) => (
                          <p key={f} className="flex items-start gap-2 text-[12.5px] font-semibold text-white/85">
                            <Check className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-300" />
                            {f}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-paper p-4">
                    <span className="mb-2 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                      <Sparkles className="h-3.5 w-3.5" />
                      Секретные анимации
                    </span>
                    <div className="space-y-1.5">
                      {ANIMATIONS.map((a) => {
                        const on = animId === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              saveAnimationId(a.id);
                              setAnimId(a.id);
                              window.dispatchEvent(new Event("winchat-animation-change"));
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition",
                              on
                                ? "border-accent bg-white shadow-sm"
                                : "border-black/8 bg-white/60 hover:border-black/15"
                            )}
                          >
                            <span>
                              <span className="block text-[13px] font-bold">{a.name}</span>
                              <span className="block text-[11px] font-medium text-black/40">
                                {a.description}
                              </span>
                            </span>
                            {on && <Check className="h-4 w-4 shrink-0 text-accent" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="winpro-locked relative overflow-hidden rounded-[24px] border border-amber-300/40 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm">
                    <Crown size="lg" className="h-9 w-9 opacity-40" />
                  </div>
                  <h4 className="mt-4 text-xl font-extrabold tracking-tight">WinPro</h4>
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-black/50">
                    Премиум-подписка WinChat: корона в профиле, серая галочка, эксклюзивные
                    палитры и секретные анимации.
                  </p>
                  <p className="mt-5 rounded-xl bg-white/70 px-3 py-2.5 font-mono text-[11px] font-semibold text-black/45">
                    WinPro выдаёт администрация — обратитесь к ней
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---------------- РЕЖИМ РАЗРАБОТЧИКА ---------------- */}
          {view === "dev" && (
            <div className="animate-fade-in">
              <DevModePanel you={you} />
            </div>
          )}

          {/* ---------------- О ПРИЛОЖЕНИИ ---------------- */}
          {view === "about" && (
            <div className="animate-fade-in">
              <div className="overflow-hidden rounded-2xl border border-black/8 bg-white/60">
                {[
                  { label: "Устройство", value: deviceLabel() },
                  { label: "Версия Android", value: androidLabel() },
                  { label: "Версия приложения WinChat", value: device?.appVersion || APP_VERSION },
                  { label: "Версия сервера WinChat", value: serverVersion ?? "…" },
                  { label: "Самая новая версия", value: latestVersion ?? "—" },
                ].map((row, i) => {
                  const isVersion = row.label === "Версия приложения WinChat";
                  const content = (
                    <>
                      <span className="shrink-0 text-[12px] font-bold text-black/45">{row.label}</span>
                      <span className="truncate text-right font-mono text-[13px] font-bold text-ink">
                        {row.value}
                      </span>
                    </>
                  );
                  return isVersion ? (
                    <button
                      key={row.label}
                      type="button"
                      onClick={handleVersionTap}
                      title="Версия приложения"
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition active:bg-black/5",
                        i > 0 && "border-t border-black/5"
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={row.label}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3",
                        i > 0 && "border-t border-black/5"
                      )}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={checkUpdates}
                disabled={checking}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-40"
              >
                {checking ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Проверить обновления
              </button>

              {(() => {
                const st = aboutStatus();
                if (st.kind === "idle") return null;
                return (
                  <div
                    className={cn(
                      "mt-2.5 flex items-center gap-2 rounded-2xl border px-4 py-3",
                      st.kind === "update"
                        ? "border-amber-500/35 bg-gradient-to-r from-amber-50 to-orange-50"
                        : "border-emerald-500/30 bg-emerald-500/5"
                    )}
                  >
                    <p
                      className={cn(
                        "min-w-0 flex-1 text-[12px] leading-snug font-bold",
                        st.kind === "update" ? "text-amber-700" : "text-emerald-600"
                      )}
                    >
                      {st.text}
                    </p>
                    {aboutOta ? (
                      <button
                        type="button"
                        onClick={startAboutOta}
                        disabled={otaBusy}
                        className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink transition hover:bg-white disabled:opacity-60"
                      >
                        {otaBusy ? "Загрузка…" : "Установить"}
                      </button>
                    ) : (
                      st.kind === "update" && (
                        <button
                          type="button"
                          onClick={() => window.open(DOWNLOAD_URL, "_blank", "noopener,noreferrer")}
                          className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink transition hover:bg-white"
                        >
                          Скачать
                        </button>
                      )
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ---------------- КАСТОМИЗАЦИЯ ---------------- */}
          {view === "customization" && (
            <div className="animate-fade-in">
              <span className="mb-3 flex items-center gap-2 text-[12px] font-bold text-black/45">
                <Palette className="h-3.5 w-3.5" />
                Палитра чатов
              </span>

              <div className="grid grid-cols-3 gap-3">
                {ALL_THEMES.map((t) =>
                  themeTile(t, {
                    active: currentId === t.id,
                    onClick: () => {
                      saveThemeId(t.id);
                      applyTheme(t);
                      setCurrentId(t.id);
                      if (youMode) navigate("/chats");
                    },
                  })
                )}
              </div>

              {/* WinPro-темы */}
              <div className="mt-5 flex items-center gap-2">
                <span className="text-[12px] font-bold text-black/45">WinPro палитры</span>
                <CrownBadge size="xs" />
                {!winPro && (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-black/40">
                    нужна подписка
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {WINPRO_THEMES.filter((t) => t.id !== GLASS_THEME_ID || glassAllowed).map((t) => {
                  const isYou = t.id === YOU_THEME_ID;
                  const isGlass = t.id === GLASS_THEME_ID;
                  return themeTile(t, {
                    active: currentId === t.id,
                    locked: !winPro && !isGlass,
                    lightLabel: true,
                    onClick: () => {
                      if (isGlass) {
                        // Glass открывается по флагу профиля, WinPro не требуется.
                        if (!glassAllowed) return;
                      } else if (!winPro) {
                        setView("winpro");
                        return;
                      }
                      saveThemeId(t.id);
                      applyTheme(t);
                      setCurrentId(t.id);
                      if (isYou) {
                        onClose();
                        navigate("/themes/you/chat");
                      } else if (isGlass) {
                        onClose();
                        navigate("/themes/glass/chat");
                      } else if (youMode) {
                        navigate("/chats");
                      }
                    },
                  });
                })}
              </div>

              {/* Material You — палитра и форма */}
              {currentId === YOU_THEME_ID && (
                <div className="mt-5">
                  <div
                    className="overflow-hidden bg-gradient-to-br from-[var(--you-primary-container)] via-[var(--you-secondary-container)] to-[var(--you-tertiary-container)] p-5 shadow-lg"
                    style={{ borderRadius: "var(--you-r-lg)" }}
                  >
                    <p className="text-[15px] font-extrabold tracking-tight text-[var(--you-on-surface)]">
                      Палитра
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      {YOU_SEEDS.map((s, idx) => {
                        const on = youSeed === s.id;
                        const layouts = [
                          <>
                            <span className="absolute -right-2 -top-3 h-14 w-14 rounded-full opacity-90" style={{ background: s.primary }} />
                            <span className="absolute bottom-8 left-2 h-5 w-10 rounded-full" style={{ background: s.secondary }} />
                            <span className="absolute bottom-8 right-2 h-5 w-5 rounded-full" style={{ background: s.tertiary }} />
                          </>,
                          <>
                            <span className="absolute inset-x-2 top-2 h-5 rounded-full" style={{ background: s.primary }} />
                            <span className="absolute bottom-8 left-2 h-6 w-6 rounded-[10px]" style={{ background: s.secondary }} />
                            <span className="absolute bottom-8 right-2 h-6 w-10 rounded-full" style={{ background: s.tertiary }} />
                          </>,
                          <>
                            <span className="absolute left-2 top-2 h-4 w-12 rounded-full" style={{ background: s.primary }} />
                            <span className="absolute left-2 top-7 h-4 w-8 rounded-full" style={{ background: s.secondary }} />
                            <span className="absolute bottom-8 right-2 h-8 w-8 rounded-full" style={{ background: s.tertiary, opacity: 0.9 }} />
                          </>,
                          <>
                            <span className="absolute -left-2 top-4 h-10 w-16 -rotate-12 rounded-full" style={{ background: s.primary }} />
                            <span className="absolute bottom-8 right-3 h-5 w-5 rounded-full" style={{ background: s.secondary }} />
                            <span className="absolute right-2 top-2 h-4 w-8 rounded-full" style={{ background: s.tertiary }} />
                          </>,
                        ];
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              saveYouSeedId(s.id);
                              setYouSeed(s.id);
                              applyYouPalette(s.id);
                              if (currentId !== YOU_THEME_ID) {
                                saveThemeId(YOU_THEME_ID);
                                applyTheme(getThemeById(YOU_THEME_ID) ?? THEMES[0]);
                                setCurrentId(YOU_THEME_ID);
                              }
                            }}
                            aria-label={s.name}
                            className={cn(
                              "relative flex h-[104px] flex-col justify-end overflow-hidden p-2.5 text-left transition active:scale-[0.98]",
                              on ? "ring-2 ring-[var(--you-on-surface)]" : "ring-1 ring-black/5"
                            )}
                            style={{
                              background: `linear-gradient(160deg, ${s.surfaceLow} 0%, ${s.surface} 55%, ${s.surfaceHigh} 100%)`,
                              borderRadius: "var(--you-r)",
                              boxShadow: on
                                ? "0 12px 26px -14px color-mix(in srgb, var(--you-primary) 70%, transparent)"
                                : "0 6px 16px -12px rgba(0,0,0,0.25)",
                            }}
                          >
                            <span className="pointer-events-none absolute inset-0">
                              {layouts[idx % layouts.length]}
                            </span>
                            <span className="pointer-events-none absolute bottom-7 left-2 right-2 flex flex-col gap-1">
                              <span className="ml-auto h-2 w-10 rounded-full" style={{ background: s.primary }} />
                              <span
                                className="h-2 w-8 rounded-full"
                                style={{ background: s.surfaceHighest, boxShadow: `inset 0 0 0 1px ${s.outlineVariant}` }}
                              />
                            </span>
                            <span className="relative">
                              <span className="block text-[12px] font-extrabold" style={{ color: s.onSurface }}>
                                {s.name}
                              </span>
                              {on && (
                                <span
                                  className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                                  style={{ background: s.primaryContainer, color: s.onPrimaryContainer }}
                                >
                                  выбрано
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5">
                      <p className="mb-2 text-[12px] font-bold text-[var(--you-on-surface-variant)]">Форма кнопок</p>
                      <YouShapePicker value={youShape} onChange={setYouShape} />
                    </div>
                  </div>
                </div>
              )}

              {/* Бут-анимация */}
              <div className="mt-5">
                <span
                  className={cn(
                    "mb-3 flex items-center gap-2 text-[12px] font-bold",
                    you ? "text-[var(--you-on-surface-variant)]" : "text-black/45"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Бут-анимация
                </span>
                <BootStylePicker
                  value={bootStyle}
                  you={you}
                  onChange={(id) => {
                    saveBootStyle(id);
                    setBootStyle(id);
                  }}
                />
              </div>
            </div>
          )}

          {/* ---------------- БЕЗОПАСНОСТЬ ---------------- */}
          {view === "security" && (
            <div className="animate-fade-in">
              <div>
                <span className="mb-1.5 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                  <Lock className="h-3.5 w-3.5" />
                  Пароль для входа
                </span>
                <div className="space-y-2">
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Новый пароль"
                    className="w-full rounded-xl border border-black/10 bg-paper px-4 py-3 text-[15px] font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                  />
                  <input
                    type="password"
                    value={newPw2}
                    onChange={(e) => setNewPw2(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Повторите пароль"
                    className="w-full rounded-xl border border-black/10 bg-paper px-4 py-3 text-[15px] font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                  />
                </div>
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={pwSaving || !newPw || !newPw2}
                  className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-40"
                >
                  {pwSaving ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Обновить пароль
                </button>
                {pwStatus && (
                  <p
                    className={cn(
                      "mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed font-semibold",
                      pwStatus.type === "ok" ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {pwStatus.type === "ok" ? (
                      <Check className="mt-px h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{pwStatus.text}</span>
                  </p>
                )}
                <p className="mt-2 text-[11px] font-medium leading-relaxed text-black/40">
                  Английские буквы и цифры, минимум 6 символов. После входа по WinPass старый пароль
                  сбрасывается — задайте новый здесь.
                </p>
              </div>

              <div className="mt-6">
                <span className="mb-1.5 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  WinPass — код восстановления
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-soft px-4 py-3">
                  <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold text-ink">
                    {normalizeWinpass(me.winpass || "") || me.winpass || "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const code = normalizeWinpass(me.winpass || "");
                      if (code) navigator.clipboard?.writeText(code).catch(() => undefined);
                      setWpCopied(true);
                      setTimeout(() => setWpCopied(false), 1600);
                    }}
                    className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink transition hover:bg-white"
                  >
                    {wpCopied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-black/40">
                  Сохраните код — он поможет войти, если вы забудете пароль.
                </p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5 active:scale-[0.99]"
              >
                <LogOut className="h-4 w-4" />
                Выйти из аккаунта
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
