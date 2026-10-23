import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, Loader2, LogOut, Palette, ShieldCheck, X } from "lucide-react";
import { isVerified, supabase, type Profile, type VerifyLevel } from "../lib/supabase";
import { filesUpload } from "../lib/blobStorage";
import { normalizeWinpass, validateBio, validateNickname } from "../lib/utils";
import Avatar from "./Avatar";
import Verified from "./Verified";
import { cn } from "../utils/cn";
import { ALL_THEMES, applyTheme, saveThemeId } from "../lib/themes";

interface Props {
  me: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
  onLogout: () => void;
}

export default function SettingsModal({ me, onClose, onSaved, onLogout }: Props) {
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [wpCopied, setWpCopied] = useState(false);

  /* --- Палитра --- */
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem("winchat_theme_id") || "ink-blue"
  );

  /** Получить уровень галочки для профиля */
  const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
    const lvl = p?.verify_status || "user";
    if (!["grey", "green", "full"].includes(lvl)) return "full";
    return lvl as Exclude<VerifyLevel, "user">;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
  }

  return (
    <div className="font-app fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
      />
      <div className="animate-scale-in relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold tracking-tight">Настройки профиля</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
            aria-label="Закрыть настройки"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Аватар */}
        <div className="mt-6 flex flex-col items-center">
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

        {/* Никнейм */}
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

        {/* О себе */}
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

        {/* Палитра чатов */}
        <div className="mt-6">
          <span className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] text-black/45 uppercase">
            <Palette className="h-3.5 w-3.5" />
            Палитра чатов
          </span>

          {/* Встроенные темы — карточки-превью */}
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
                {/* Мини-пузыри сообщений */}
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
                {/* Градиент-полоска */}
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
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60",
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
              {wpCopied ? "Скопировано ✓" : "Копировать"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-black/40">
            Сохраните код — он поможет войти, если вы забудете пароль.
          </p>
        </div>

        {/* Инфо */}
        <div className="mt-6 space-y-2 rounded-2xl bg-paper p-4 font-mono text-[11px] tracking-wide text-black/45">
          <div className="flex justify-between gap-3">
            <span>ID</span>
            <span className="truncate text-black/70">{me.id}</span>
          </div>
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
  );
}
