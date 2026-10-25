import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, Loader2, Lock, LogOut, Palette, Sparkles, ShieldCheck, User, X } from "lucide-react";
import { isVerified, supabase, type Profile, type VerifyLevel } from "../lib/supabase";
import { filesUpload } from "../lib/blobStorage";
import { normalizeWinpass, validateBio, validateNickname, validatePassword } from "../lib/utils";
import Avatar from "./Avatar";
import Crown from "./Crown";
import Verified from "./Verified";
import { cn } from "../utils/cn";
import { ALL_THEMES, applyTheme, saveThemeId, WINPRO_THEMES } from "../lib/themes";
import { hasWinPro, winproDaysLeft, winproExpiresLabel } from "../lib/winpro";
import { ANIMATIONS, getAnimationId, saveAnimationId } from "../lib/animations";

interface Props {
  me: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
  onLogout: () => void;
}

type Tab = "profile" | "customization" | "security" | "winpro";

/** Получить уровень галочки для профиля (вынесено из компонента) */
const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
  const lvl = p?.verify_status || "user";
  if (!["grey", "green", "full"].includes(lvl)) return "full";
  return lvl as Exclude<VerifyLevel, "user">;
};

export default function SettingsModal({ me, onClose, onSaved, onLogout }: Props) {
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [wpCopied, setWpCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  /* --- Смена пароля --- */
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  /* --- WinPro --- */
  const winPro = hasWinPro(me);
  const [animId, setAnimId] = useState<string>(() => getAnimationId());
  const [celebrate, setCelebrate] = useState(false);

  /* --- Палитра --- */
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem("winchat_theme_id") || "ink-blue"
  );

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

  const showTab = (tab: Tab) => cn(activeTab !== tab && "hidden");

  return (
    <div className="font-app fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <div className="animate-scale-in relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-[28px]">
        {/* Шапка */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 px-5 py-4 sm:border-0 sm:px-8 sm:pt-8 sm:pb-0">
          <h3 className="text-lg font-extrabold tracking-tight">Настройки</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
            aria-label="Закрыть настройки"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Вкладки — sticky на мобильных */}
        <div className="shrink-0 border-b border-black/5 bg-white/95 px-3 py-2 backdrop-blur sm:border-0 sm:bg-transparent sm:px-8 sm:py-3">
          <div className="flex gap-1.5 rounded-2xl bg-paper p-1">
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
                    active ? "bg-white text-ink shadow-sm" : "text-black/45 active:scale-95 hover:text-ink"
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
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-6 sm:pb-8">
          
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
              <p className="mt-3 flex items-center gap-1.5 font-mono text-sm font-semibold text-black/40">
                @{me.username}
                {isVerified(me) && <Verified size="sm" level={badgeLevel(me)} />}
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
              <span className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
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
                <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
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

            <button
              onClick={onLogout}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/5 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              Выйти из аккаунта
            </button>
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