import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isWinProActive, supabase, type Profile } from "./lib/supabase";
import { checkBanned } from "./lib/adminApi";
import { applyTheme, getCurrentTheme, getThemeById, isWinProTheme, saveThemeId, THEMES } from "./lib/themes";
import { getAnimationId } from "./lib/animations";
import Auth from "./components/Auth";
import Messenger from "./components/Messenger";

function Splash() {
  return (
    <div className="font-app flex min-h-dvh items-center justify-center bg-paper">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-ink text-2xl font-extrabold text-white">
        W
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [banned, setBanned] = useState(false);
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    // Применить тему из localStorage при старте
    const theme = getCurrentTheme();
    applyTheme(theme);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setBanned(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      let p = data as Profile | null;
      if (!p) {
        // Запасной путь, если триггер handle_new_user ещё не выполнен
        const meta = session.user.user_metadata as { username?: string; nickname?: string };
        // upsert: профиль мог создать триггер между двумя нашими запросами
        await supabase.from("profiles").upsert({
          id: session.user.id,
          username: (meta.username || `user_${session.user.id.slice(0, 6)}`).toLowerCase(),
          nickname: meta.nickname || "Пользователь",
        });
        const { data: again } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        p = again as Profile | null;
      }
      if (alive) setProfile(p);
    })();

    // Проверка бана
    (async () => {
      const status = await checkBanned(session.user.id);
      if (status === "banned") {
        const { data: p } = await supabase
          .from("profiles")
          .select("ban_reason")
          .eq("id", session.user.id)
          .maybeSingle();
        setBanReason((p as { ban_reason?: string } | null)?.ban_reason || "Вы забанены");
        setBanned(true);
      }
    })();
  }, [session]);

  /* ---------- тема + WinPro-анимация ---------- */
  useEffect(() => {
    if (!profile) return;
    const winPro = isWinProActive(profile);
    const saved = getCurrentTheme();

    // Тема WinPro недоступна без подписки — откатываемся на базовую
    if (isWinProTheme(saved.id) && !winPro) {
      saveThemeId(THEMES[0].id);
      applyTheme(THEMES[0]);
    } else {
      applyTheme(getThemeById(saved.id) ?? THEMES[0]);
    }

    // Фоновая анимация
    const root = document.documentElement;
    root.classList.remove(
      "winpro-bg-gold-dust",
      "winpro-bg-aurora",
      "winpro-bg-crown-rain",
      "winpro-bg-gradient-shift",
      "winpro-bg-ripple",
      "winpro-bg-nebula"
    );
    const anim = getAnimationId();
    if (winPro && anim !== "off") root.classList.add(`winpro-bg-${anim}`);
  }, [profile]);

  useEffect(() => {
    const onChange = () => {
      const root = document.documentElement;
      root.classList.remove(
        "winpro-bg-gold-dust",
        "winpro-bg-aurora",
        "winpro-bg-crown-rain",
        "winpro-bg-gradient-shift",
        "winpro-bg-ripple",
        "winpro-bg-nebula"
      );
      if (!profile || !isWinProActive(profile)) return;
      const anim = getAnimationId();
      if (anim !== "off") root.classList.add(`winpro-bg-${anim}`);
    };
    window.addEventListener("winchat-animation-change", onChange);
    return () => window.removeEventListener("winchat-animation-change", onChange);
  }, [profile]);

  if (booting || (session && !profile)) return <Splash />;
  if (!session || !profile) return <Auth />;
  if (banned)
    return (
      <div className="font-app flex min-h-dvh items-center justify-center bg-paper px-6">
        <div className="animate-scale-in w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-500/10">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Доступ заблокирован</h2>
          <p className="mt-3 text-sm font-medium text-black/50">{banReason}</p>
          <p className="mt-5 text-[13px] font-semibold text-black/35">
            Если вы считаете это ошибкой, свяжитесь с администрацией.
          </p>
        </div>
      </div>
    );
  return (
    <Messenger
      me={profile}
      onProfileSaved={setProfile}
      onLogout={() => supabase.auth.signOut()}
    />
  );
}
