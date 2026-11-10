import { useEffect, useRef, useState } from "react";
import { Bell, Camera, Check, CircleAlert, History, Loader2, Lock, LogOut, Palette, Sparkles, ShieldCheck, User, X } from "lucide-react";
import { isVerified, supabase, type Profile, type VerifyLevel } from "../lib/supabase";
import { filesUpload } from "../lib/blobStorage";
import { badgeCodes, BADGE_IMAGES, BADGE_LABELS } from "../lib/badges";
import { normalizeWinpass, validateBio, validateNickname, validatePassword } from "../lib/utils";
import Avatar from "./Avatar";
import Crown from "./Crown";
import Verified from "./Verified";
import { cn } from "../utils/cn";
import { ALL_THEMES, applyTheme, getThemeById, GLASS_THEME_ID, saveThemeId, THEMES, WINPRO_THEMES, YOU_THEME_ID } from "../lib/themes";
import {
  YOU_SEEDS,
  YOU_SHAPES,
  applyYouPalette,
  applyYouShape,
  getYouSeedId,
  getYouShape,
  saveYouSeedId,
  saveYouShape,
  type YouShape,
} from "../lib/materialYou";
import { navigate } from "../lib/router";
import { hasWinPro, winproDaysLeft, winproExpiresLabel } from "../lib/winpro";
import { ANIMATIONS, getAnimationId, saveAnimationId } from "../lib/animations";
import { initPush, savePushSubscription, subscribeWebPush, unsubscribeWebPush, getPlatform } from "../lib/push";

interface Props {
  me: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
  onLogout: () => void;
  /** Ивент «Память о Wintozo»: показать плашку выбора интерфейса. */
  onShowLegacy?: () => void;
  /** Режим WinChat You: показывать отдельное окно кастомизации «WinChat You». */
  youMode?: boolean;
}

type Tab = "profile" | "customization" | "security" | "winpro";

/** Получить уровень галочки для профиля (вынесено из компонента) */
const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
  const lvl = p?.verify_status || "user";
  if (!["grey", "green", "full"].includes(lvl)) return "full";
  return lvl as Exclude<VerifyLevel, "user">;
};

export default function SettingsModal({
  me,
  onClose,
  onSaved,
  onLogout,
  onShowLegacy,
  initialTab = "profile",
  youMode = false,
}: Props & { initialTab?: Tab }) {
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [wpCopied, setWpCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  /* --- Смена пароля --- */
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  /* --- WinPro --- */
  const winPro = hasWinPro(me);
  const [animId, setAnimId] = useState<string>(() => getAnimationId());
  const [celebrate, setCelebrate] = useState(false);

  /* --- Пуш-уведомления --- */
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const platform = getPlatform();
      const supported = platform === "web" && typeof window !== "undefined" && "PushManager" in window && !!import.meta.env.VITE_PUBLIC_VAPID_KEY;
      setPushSupported(supported);
      if (supported && !cancelled) {
        try {
          const subscribed = await initPush();
          setPushSubscribed(!!subscribed.subscribed);
        } catch {
          /* no-op */
        }
      }
      return () => { cancelled = true; };
    })();
  }, []);

  /* --- Палитра --- */
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem("winchat_theme_id") || "ink-blue"
  );
  /* --- WinChat You --- */
  const [youSeed, setYouSeed] = useState<string>(() => getYouSeedId());
  const [youShape, setYouShape] = useState<YouShape>(() => getYouShape());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Анимация получения WinPro — один раз на каждый срок подписки */
  useEffect(() => {
    if (!me.winpro_until || !hasWinPro(me)) return;
    const KEY = "winchat_winpro_seen";
    let seen = "";
    try {
      seen = localStorage.getItem(KEY) || "";
    } catch {
      return;
    }
    if (seen === me.winpro_until) return;
    setActiveTab("winpro");
    setCelebrate(true);
    try {
      localStorage.setItem(KEY, me.winpro_until);
    } catch {
      /* no-op */
    }
    const t = window.setTimeout(() => setCelebrate(false), 4200);
    return () => window.clearTimeout(t);
  }, [me]);


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
    // Проверка на null
    if (pErr || !data) return setError("Не удалось сохранить профиль");
    onSaved(data as Profile);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  }

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
    setNewPw("");
    setNewPw2("");
    setPwStatus({ type: "ok", text: "Пароль обновлён — теперь входите с ним." });
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Профиль", icon: User },
    { id: "customization", label: "Кастомизация", icon: Palette },
    { id: "security", label: "Безопасность", icon: ShieldCheck },
    { id: "winpro", label: "WinPro", icon: Sparkles },
  ];


  /* --- Пуш-уведомления: обработчики --- */
  const togglePush = async () => {
    if (!pushSupported) {
      setPushError("Пуш-уведомления недоступны в этом браузере или не задан VITE_PUBLIC_VAPID_KEY");
      return;
    }
    setPushLoading(true);
    setPushError(null);
    try {
      if (pushSubscribed) {
        await unsubscribeWebPush();
        setPushSubscribed(false);
      } else {
        const sub = await subscribeWebPush();
        await savePushSubscription(sub.endpoint, sub.p256dh, sub.auth, navigator.userAgent);
        setPushSubscribed(true);
      }
    } catch (err: any) {
      setPushError(err?.message || "Не удалось изменить подписку на пуш-уведомления");
    } finally {
      setPushLoading(false);
    }
  };

  const showTab = (t: Tab) => (activeTab === t ? "animate-fade-in" : "hidden");
  const you = youMode || currentId === YOU_THEME_ID;
  const myBadges = badgeCodes(me);

  return (
    <div className="font-app fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <div
        className={cn(
          "animate-scale-in relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden shadow-2xl sm:max-h-[90dvh]",
          you
            ? "you-gate-card rounded-t-[28px] sm:rounded-[36px]"
            : "rounded-t-[26px] bg-white sm:rounded-[28px]"
        )}
      >
        {/* Шапка */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-between border-b px-5 py-4 sm:border-0 sm:px-8 sm:pt-8 sm:pb-0",
            you ? "border-[var(--you-outline-variant)]" : "border-black/8"
          )}
        >
          <div className="flex items-center gap-2.5">
            {you && (
              <span className="you-logo flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px]">
                <img src="/logo.jpg" alt="WinChat" className="h-full w-full object-cover" />
              </span>
            )}
            <h3
              className={cn(
                "text-lg font-extrabold tracking-tight",
                you ? "text-[var(--you-on-surface)]" : ""
              )}
            >
              Настройки
            </h3>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "rounded-full p-2 transition",
              you
                ? "text-[var(--you-on-surface-variant)] hover:bg-[var(--you-surface-container)]"
                : "text-black/45 hover:bg-black/5 hover:text-ink"
            )}
            aria-label="Закрыть настройки"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Вкладки */}
        <div
          className={cn(
            "shrink-0 border-b px-3 py-2 backdrop-blur sm:border-0 sm:px-8 sm:py-3",
            you ? "border-[var(--you-outline-variant)]" : "border-black/5 bg-white/95 sm:bg-transparent"
          )}
        >
          <div className={cn("flex gap-1.5 rounded-2xl p-1", you ? "bg-[var(--you-surface-container)]" : "bg-paper")}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.id);
                    scrollRef.current?.scrollTo({ top: 0 });
                  }}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-bold transition",
                    active
                      ? you
                        ? "bg-[var(--you-surface-highest)] text-[var(--you-on-surface)] shadow-sm"
                        : "bg-white text-ink shadow-sm"
                      : you
                        ? "text-[var(--you-on-surface-variant)] active:scale-95"
                        : "text-black/45 active:scale-95 hover:text-ink"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Скроллируемое содержимое */}
        <div
          ref={scrollRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-6 sm:pb-8",
            you ? "text-[var(--you-on-surface)]" : ""
          )}
        >
          
          {/* ===== Профиль ===== */}
          <div className={showTab("profile")}>
            <div className="flex flex-col items-center">
              <div className="group relative">
                <Avatar profile={me} size="xl" />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-ink/55 opacity-0 transition group-hover:opacity-100"
                  aria-label="Сменить фото"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 font-mono text-sm font-semibold text-black/40">
                @{me.username}
                {isVerified(me) && <Verified size="sm" level={badgeLevel(me)} />}
                {myBadges.map((code) => (
                  <img
                    key={code}
                    src={BADGE_IMAGES[code]}
                    alt={BADGE_LABELS[code]}
                    title={BADGE_LABELS[code]}
                    className="h-6 w-6 object-contain drop-shadow-sm"
                  />
                ))}
              </p>
              {isVerified(me) && (
                <p className="mt-1.5 flex items-center gap-1 rounded-full bg-[#1d9bf0]/10 px-2.5 py-1 text-[11px] font-bold text-[#1d9bf0]">
                  <Verified size="xs" className="h-3 w-3" level={badgeLevel(me)} />
                  Подтверждённый аккаунт
                </p>
              )}
            </div>

            <div className="mt-6">
              <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                Никнейм
              </span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                className="w-full rounded-xl border border-black/10 bg-paper px-4 py-3 text-[15px] font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                placeholder="Ваш никнейм"
              />
            </div>

            <div className="mt-4">
              <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                О себе
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                rows={3}
                placeholder="Пара слов о вас — это описание увидят собеседники"
                className="w-full resize-none rounded-xl border border-black/10 bg-paper px-4 py-3 text-sm font-medium outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
              <p className="mt-1 text-right font-mono text-[10px] text-black/35">{bio.length}/160</p>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className={cn(
                "mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60",
                savedTick ? "bg-emerald-500" : "bg-ink hover:bg-black"
              )}
            >
              {saving ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {savedTick ? "Сохранено" : "Сохранить профиль"}
                </>
              )}
            </button>

            {error && (
              <div className="animate-fade-in mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-600">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-2xl bg-paper p-4 font-mono text-[11px] tracking-wide text-black/45">
              <div className="flex justify-between gap-3">
                <span>ID</span>
                <span className="truncate text-black/70">{me.id}</span>
              </div>
            </div>
          </div>

          {/* ===== Кастомизация ===== */}
          <div className={showTab("customization")}>
            <div>
              <span className={cn("mb-3 flex items-center gap-2 text-[12px] font-bold", you ? "text-[var(--you-on-surface-variant)]" : "text-black/45")}>
                <Palette className="h-3.5 w-3.5" />
                Палитра чатов
              </span>

              <div className="grid grid-cols-3 gap-3">
                {ALL_THEMES.map((t) => {
                  const active = currentId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        saveThemeId(t.id);
                        applyTheme(t);
                        setCurrentId(t.id);
                        if (youMode) navigate("/chats");
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.97]",
                        active
                          ? "border-accent shadow-lg shadow-accent/20"
                          : "border-transparent hover:border-black/15"
                      )}
                      style={{ background: t.chatBg }}
                    >
                      <span
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
                        style={{ background: t.accent }}
                      >
                        <Check className="h-3 w-3 text-white" />
                      </span>
                      <div className="space-y-1.5">
                        <div
                          className="ml-auto h-2.5 w-10 rounded-full"
                          style={{ background: t.ownerMsg }}
                        />
                        <div
                          className="h-2.5 w-8 rounded-full"
                          style={{ background: t.otherMsg, boxShadow: `inset 0 0 0 1px ${t.otherMsgBorder}` }}
                        />
                        <div
                          className="ml-auto h-2.5 w-6 rounded-full"
                          style={{ background: t.ownerMsg }}
                        />
                      </div>
                      <div
                        className="mt-2.5 h-1.5 w-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})` }}
                      />
                      <p
                        className="mt-2 text-[11px] font-bold leading-tight"
                        style={{ color: t.id === "sunset" ? "#431407" : "#101214" }}
                      >
                        {t.name}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* WinPro-темы */}
              <div className="mt-5 flex items-center gap-2">
                <span className={cn("text-[12px] font-bold", you ? "text-[var(--you-on-surface-variant)]" : "text-black/45")}>
                  WinPro палитры
                </span>
                <Crown size="xs" />
                {!winPro && (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-black/40">
                    нужна подписка
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {WINPRO_THEMES.map((t) => {
                  const active = currentId === t.id;
                  const isYou = t.id === YOU_THEME_ID;
                  const isGlass = t.id === GLASS_THEME_ID;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (!winPro) {
                          setActiveTab("winpro");
                          scrollRef.current?.scrollTo({ top: 0 });
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
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.97]",
                        active
                          ? "border-accent shadow-lg shadow-accent/20"
                          : "border-transparent hover:border-black/15",
                        !winPro && "opacity-60"
                      )}
                      style={{ background: t.chatBg }}
                    >
                      {!winPro && (
                        <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                          <Lock className="h-4 w-4 text-white" />
                        </span>
                      )}
                      <div className="space-y-1.5">
                        <div
                          className="ml-auto h-2.5 w-10 rounded-full"
                          style={{ background: t.ownerMsg }}
                        />
                        <div
                          className="h-2.5 w-8 rounded-full"
                          style={{ background: t.otherMsg, boxShadow: `inset 0 0 0 1px ${t.otherMsgBorder}` }}
                        />
                        <div
                          className="ml-auto h-2.5 w-6 rounded-full"
                          style={{ background: t.ownerMsg }}
                        />
                      </div>
                      <div
                        className="mt-2.5 h-1.5 w-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})` }}
                      />
                      <p className="mt-2 text-[11px] font-bold leading-tight text-white">{t.name}</p>
                    </button>
                  );
                })}
              </div>

              {/* ===== Material You — WinChat You ===== */}
              {currentId === YOU_THEME_ID && (
                <div className="mt-5">
                  <div
                    className={cn(
                      "overflow-hidden p-5 shadow-lg",
                      "bg-gradient-to-br from-[var(--you-primary-container)] via-[var(--you-secondary-container)] to-[var(--you-tertiary-container)]"
                    )}
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
                            <span className="pointer-events-none absolute bottom-7 right-2 left-2 flex flex-col gap-1">
                              <span className="ml-auto h-2 w-10 rounded-full" style={{ background: s.primary }} />
                              <span className="h-2 w-8 rounded-full" style={{ background: s.surfaceHighest, boxShadow: `inset 0 0 0 1px ${s.outlineVariant}` }} />
                            </span>
                            <span className="relative">
                              <span className="block text-[12px] font-extrabold" style={{ color: s.onSurface }}>
                                {s.name}
                              </span>
                              {on && (
                                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: s.primaryContainer, color: s.onPrimaryContainer }}>
                                  выбрано
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5">
                      <p className="mb-2 text-[12px] font-bold text-[var(--you-on-surface-variant)]">
                        Форма
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {YOU_SHAPES.map((sh) => {
                          const on = youShape === sh.id;
                          return (
                            <button
                              key={sh.id}
                              type="button"
                              onClick={() => {
                                saveYouShape(sh.id);
                                setYouShape(sh.id);
                                applyYouShape(sh.id);
                              }}
                              className={cn(
                                "flex flex-col items-center gap-2 p-2.5 transition active:scale-95",
                                on
                                  ? "bg-[var(--you-surface-highest)] ring-2 ring-[var(--you-on-surface)]"
                                  : "bg-[var(--you-surface-low)]/70 ring-1 ring-black/5"
                              )}
                              style={{ borderRadius: "var(--you-r-sm)" }}
                            >
                              <span
                                className="h-8 w-full"
                                style={{
                                  borderRadius: sh.r,
                                  background: on
                                    ? "linear-gradient(135deg, var(--you-primary), var(--you-primary-strong))"
                                    : "var(--you-surface-highest)",
                                  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--you-outline-variant) 60%, transparent)",
                                }}
                              />
                              <span className="text-[10px] font-bold text-[var(--you-on-surface)]">
                                {sh.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== WinPro ===== */}
          <div className={showTab("winpro")}>
            {winPro ? (
              <div className="animate-fade-in">
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
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="winpro-locked relative overflow-hidden rounded-[24px] border border-amber-300/40 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm">
                    <Crown size="lg" className="h-9 w-9 opacity-40" />
                  </div>
                  <h4 className="mt-4 text-xl font-extrabold tracking-tight">WinPro</h4>
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-black/50">
                    Премиум-подписка WinChat: корона в профиле, серая галочка, эксклюзивные
                    палитры и секретные анимации.
                  </p>
                  <div className="mt-5 space-y-2 text-left">
                    {[
                      "Золотая SVG-корона рядом с ником",
                      "Базовая серая галочка верификации",
                      "Три премиум-палитры чатов",
                      "Секретные анимации интерфейса",
                    ].map((f) => (
                      <p key={f} className="flex items-start gap-2 text-[12.5px] font-semibold text-black/60">
                        <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />
                        {f}
                      </p>
                    ))}
                  </div>
                  <p className="mt-5 rounded-xl bg-white/70 px-3 py-2.5 font-mono text-[11px] font-semibold text-black/45">
                    WinPro выдаёт администрация — обратитесь к ней
                  </p>
                </div>
              </div>
            )}
          </div>


          {/* ===== Безопасность ===== */}
          <div className={showTab("security")}>
            {/* Смена пароля (ТЕПЕРЬ ТОЛЬКО ОДИН РАЗ) */}
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

            {/* WinPass */}
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

            {/* --- Пуш-уведомления --- */}
            <div className="mt-6">
              <span className="mb-1.5 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
                <Bell className="h-3.5 w-3.5" />
                Пуш-уведомления
              </span>
              {!pushSupported ? (
                <div className="rounded-xl border border-dashed border-black/20 bg-black/5 px-4 py-3 text-[12px] text-black/50">
                  Пуш-уведомления недоступны: браузер не поддерживает Push API или не задан
                  VITE_PUBLIC_VAPID_KEY.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={togglePush}
                    disabled={pushLoading}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
                      pushSubscribed ? "border-green-400 bg-green-400/5 text-green-700" : "border-black/8 bg-white/60 hover:border-black/15"
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="text-[12px] font-bold">
                        {pushSubscribed ? "Пуш включён" : "Включить пуш-уведомления"}
                      </span>
                      <span className="text-[10px] font-medium text-black/40">
                        {pushSubscribed ? "Вы будете получать уведомления о сообщениях" : "Разрешить уведомления о новых сообщениях"}
                      </span>
                    </span>
                    {pushLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      pushSubscribed ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )
                    )}
                  </button>
                  {pushError && (
                    <p className="mt-1.5 text-[11px] font-medium text-red-600">{pushError}</p>
                  )}
                </>
              )}
            </div>

            <button
              onClick={onLogout}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              Выйти из аккаунта
            </button>

            {/* Ивент «Память о Wintozo» — снова выбрать интерфейс */}
            {onShowLegacy && (
              <button
                onClick={() => {
                  onClose();
                  onShowLegacy();
                }}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-50 to-orange-50 py-3 text-sm font-bold text-amber-700 transition hover:brightness-105 active:scale-[0.99]"
              >
                <History className="h-4 w-4" />
                Память о Wintozo — сменить интерфейс
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Анимация получения WinPro */}
      {celebrate && (
        <div
          className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm"
          onClick={() => setCelebrate(false)}
        >
          <div className="winpro-celebrate relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#0f0f1a] px-8 py-10 text-center shadow-2xl ring-1 ring-amber-400/30">
            {/* Лучи */}
            <div className="winpro-rays pointer-events-none absolute inset-0" />
            {/* Короны-частицы */}
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="winpro-particle pointer-events-none absolute"
                style={{
                  left: `${8 + i * 9}%`,
                  animationDelay: `${i * 0.28}s`,
                  animationDuration: `${2.6 + (i % 3) * 0.5}s`,
                }}
              >
                <Crown size="xs" className="h-4 w-4" />
              </span>
            ))}

            <div className="winpro-crown-pop relative flex h-24 w-24 items-center justify-center rounded-[30px] bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 shadow-[0_0_60px_rgba(255,200,0,0.55)]">
              <Crown size="lg" className="h-14 w-14" />
            </div>

            <h3 className="relative mt-6 text-2xl font-extrabold tracking-tight text-white">
              WinPro активирован
            </h3>
            <p className="relative mt-2 text-[13px] font-medium leading-relaxed text-white/70">
              Подписка на {winproDaysLeft(me)} дн. Корона, галочка и премиум-палитры уже в профиле.
            </p>

            <button
              type="button"
              onClick={() => setCelebrate(false)}
              className="relative mt-7 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-extrabold text-[#1a1a2e] transition hover:brightness-110 active:scale-[0.99]"
            >
              Отлично!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}