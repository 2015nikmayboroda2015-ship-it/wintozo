import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isGlobalAdmin, isWinProActive, supabase, type Profile } from "./lib/supabase";
import { checkBanned } from "./lib/adminApi";
import {
  applyTheme,
  getCurrentTheme,
  getThemeById,
  GLASS_THEME_ID,
  isWinProTheme,
  saveThemeId,
  THEMES,
  YOU_THEME_ID,
} from "./lib/themes";
import { getAnimationId } from "./lib/animations";
import { requestNotifyPermission } from "./lib/notify";
import { applyLegacyGate, declineLegacyUi, isLegacyUi, resetLegacyChoice } from "./lib/checkVersion";
import { reportDeviceStatus, isAndroidWebLite } from "./lib/ota";
import {
  isPhoneDevice,
  markOobeInstallDone,
  markOobeUpdateDone,
  OOBE_INSTALL_KEY,
  OOBE_UPDATE_KEY,
} from "./lib/oobe";
import { navigate } from "./lib/router";
import Auth from "./components/Auth";
import Messenger from "./components/Messenger";
import LiteMessenger from "./components/LiteMessenger";
import LegacyScreen from "./components/LegacyScreen";
import YouLocked from "./components/YouLocked";
import GlassLocked from "./components/GlassLocked";
import OobeUpdate from "./components/OobeUpdate";
import OobeInstall from "./components/OobeInstall";

/* ============================================================
   Лёгкий роутер (как в старом Wintozo)
   Новые маршруты:  /login  /registration  /chats  /settings
                    /settings/status/winpro
   WinChat You:     /themes/you  /themes/you/chat  /themes/you/settings
                    /themes/you/winpro
   Старый интерфейс (ивент «Память о Wintozo»):
                    /events/themes/wintozo/*
   ============================================================ */
const LEGACY_PREFIX = "/events/themes/wintozo";
const YOU_PREFIX = "/themes/you";
const YOU_PREV_THEME_KEY = "winchat_you_prev_theme";
const GLASS_PREFIX = "/themes/glass";
const GLASS_PREV_THEME_KEY = "winchat_glass_prev_theme";

function isYouPath(path: string): boolean {
  return path === YOU_PREFIX || path.startsWith(`${YOU_PREFIX}/`);
}

function isGlassPath(path: string): boolean {
  return path === GLASS_PREFIX || path.startsWith(`${GLASS_PREFIX}/`);
}

function useRoute(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export { navigate } from "./lib/router";

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
  /* Ивент «Память о Wintozo»: показывать ли legacy-экран выбора/старый UI */
  const [legacyAsk, setLegacyAsk] = useState(false);
  /* OOBE: приветствия после обновления и при первом скачивании */
  const [oobeUpdateShown, setOobeUpdateShown] = useState(true);
  const [oobeInstallShown, setOobeInstallShown] = useState(true);
  /* Лёгкий роутер: путь синхронизируется с экранами приложения */
  const path = useRoute();
  /* WinChat You — отдельный режим-маршрут /themes/you/* */
  const youMode = isYouPath(path);
  const youChatId = youMode
    ? path.match(/^\/themes\/you\/chat\/([^/?#]+)/)?.[1] ?? null
    : null;
  const wasYou = useRef(false);

  /* WinChat Glass — отдельный режим-маршрут /themes/glass/* */
  const glassMode = isGlassPath(path);
  const glassChatId = glassMode
    ? path.match(/^\/themes\/glass\/chat\/([^/?#]+)/)?.[1] ?? null
    : null;
  const wasGlass = useRef(false);
  /** Активный «особый» режим интерфейса: You или Glass. */
  const themedMode = youMode || glassMode;
  const themeRoutePrefix = glassMode ? GLASS_PREFIX : YOU_PREFIX;

  /* ---------- OOBE: приветствия (телефоны − автоматически, ПК − по адресу) ---------- */
  const oobeForceUpdate = path.startsWith("/oobe_update");
  const oobeForceInstall = path.startsWith("/install_oobe");
  const showInstallOobe =
    oobeForceInstall || (isPhoneDevice() && !oobeInstallShown && !banned);
  const showUpdateOobe =
    oobeForceUpdate || (isPhoneDevice() && !oobeUpdateShown && !!profile && !banned);

  const finishUpdateOobe = () => {
    markOobeUpdateDone();
    setOobeUpdateShown(true);
    navigate(profile ? "/chats" : "/login");
  };
  const finishInstallOobe = () => {
    markOobeInstallDone();
    setOobeInstallShown(true);
    navigate(profile ? "/chats" : "/login");
  };

  useEffect(() => {
    try {
      setOobeUpdateShown(localStorage.getItem(OOBE_UPDATE_KEY) === "1");
      setOobeInstallShown(localStorage.getItem(OOBE_INSTALL_KEY) === "1");
    } catch {
      /* no-op */
    }
  }, []);


  useEffect(() => {
    // Применить тему из localStorage при старте
    const theme = getCurrentTheme();
    applyTheme(theme);

    // OTA: отправить статус устройства (is_wintozo_web_true / _no).
    // Сам поиск OTA делает CheckVersion после входа (см. lib/ota.ts).
    void reportDeviceStatus();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
      void requestNotifyPermission();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  /* Проверка серверной версии при запуске (ивент «Память о Wintozo») */
  useEffect(() => {
    if (!session || banned) return;
    let alive = true;
    void applyLegacyGate().then((turnedOn) => {
      if (alive && (turnedOn || isLegacyUi())) setLegacyAsk(true);
    });
    return () => {
      alive = false;
    };
  }, [session, banned]);

  /* OTA: после входа привязываем устройство к аккаунту (для цели @username) */
  useEffect(() => {
    if (!session) return;
    void reportDeviceStatus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

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

  /* ---------- WinChat You: короткий адрес → чат ---------- */
  useEffect(() => {
    if (path !== YOU_PREFIX) return;
    window.history.replaceState({}, "", `${YOU_PREFIX}/chat`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [path]);

  /* ---------- WinChat Glass: короткий адрес → чат ---------- */
  useEffect(() => {
    if (path !== GLASS_PREFIX) return;
    window.history.replaceState({}, "", `${GLASS_PREFIX}/chat`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [path]);

  /* ---------- WinChat You: включение/выключение режима ---------- */
  useEffect(() => {
    if (!profile) return;
    const winPro = isWinProActive(profile);
    const active = youMode && winPro;
    const savedId = (getCurrentTheme() as { id?: string }).id ?? THEMES[0].id;

    if (active) {
      if (!wasYou.current) {
        // Запоминаем тему, к которой вернёмся после выхода из You.
        try {
          const prev = localStorage.getItem("winchat_theme_id");
          if (prev && prev !== YOU_THEME_ID) {
            localStorage.setItem(YOU_PREV_THEME_KEY, prev);
          }
        } catch {
          /* no-op */
        }
      }
      wasYou.current = true;
      saveThemeId(YOU_THEME_ID);
      applyTheme(getThemeById(YOU_THEME_ID) ?? THEMES[0]);
      document.title = "WinChat You";
      return;
    }

    const leavingYou = wasYou.current;
    wasYou.current = false;

    // После перезагрузки адрес может снова стать /chats (или /), но тема
    // WinChat You уже выбрана — не сбрасываем её, а возвращаем в You.
    if (
      savedId === YOU_THEME_ID &&
      winPro &&
      !leavingYou &&
      (path === "/chats" || path === "/" || path === "")
    ) {
      window.history.replaceState({}, "", `${YOU_PREFIX}/chat`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }

    // Пользователь уже выбрал другую тему — не перетираем его выбор.
    if (savedId !== YOU_THEME_ID) {
      document.title = "WinChat";
      return;
    }

    // Вышли из /themes/you/* — возвращаем тему, которая была до You.
    let prev: string = THEMES[0].id;
    try {
      prev = localStorage.getItem(YOU_PREV_THEME_KEY) || THEMES[0].id;
    } catch {
      /* no-op */
    }
    if (isWinProTheme(prev) && !winPro) prev = THEMES[0].id;
    saveThemeId(prev);
    applyTheme(getThemeById(prev) ?? THEMES[0]);
    document.title = "WinChat";
  }, [profile, youMode, path]);

  /* ---------- WinChat Glass: включение/выключение режима ---------- */
  useEffect(() => {
    if (!profile) return;
    const allowed = isWinProActive(profile) || isGlobalAdmin(profile);
    const active = glassMode && allowed;
    const savedId = (getCurrentTheme() as { id?: string }).id ?? THEMES[0].id;

    if (active) {
      if (!wasGlass.current) {
        // Запоминаем тему, к которой вернёмся после выхода из Glass.
        try {
          const prev = localStorage.getItem("winchat_theme_id");
          if (prev && prev !== GLASS_THEME_ID) {
            localStorage.setItem(GLASS_PREV_THEME_KEY, prev);
          }
        } catch {
          /* no-op */
        }
      }
      wasGlass.current = true;
      saveThemeId(GLASS_THEME_ID);
      applyTheme(getThemeById(GLASS_THEME_ID) ?? THEMES[0]);
      document.title = "WinChat Glass";
      return;
    }

    const leavingGlass = wasGlass.current;
    wasGlass.current = false;

    // После перезагрузки адрес может снова стать /chats (или /), но тема
    // WinChat Glass уже выбрана — не сбрасываем её, а возвращаем в Glass.
    if (
      savedId === GLASS_THEME_ID &&
      allowed &&
      !leavingGlass &&
      !youMode &&
      (path === "/chats" || path === "/" || path === "")
    ) {
      window.history.replaceState({}, "", `${GLASS_PREFIX}/chat`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }

    // Пользователь выбрал другую тему или ушёл в You — не перетираем.
    if (savedId !== GLASS_THEME_ID || youMode) {
      if (!themedMode) document.title = "WinChat";
      return;
    }

    // Вышли из /themes/glass/* — возвращаем тему, которая была до Glass.
    let prev: string = THEMES[0].id;
    try {
      prev = localStorage.getItem(GLASS_PREV_THEME_KEY) || THEMES[0].id;
    } catch {
      /* no-op */
    }
    if (isWinProTheme(prev) && !allowed) prev = THEMES[0].id;
    saveThemeId(prev);
    applyTheme(getThemeById(prev) ?? THEMES[0]);
    if (!themedMode) document.title = "WinChat";
  }, [profile, glassMode, path, youMode, themedMode]);

  if (booting || (session && !profile)) {
    /* OOBE первого скачивания: приветствие «Установка завершена» и форма — вместо splash */
    if (!banned && showInstallOobe) {
      return (
        <OobeInstall hasSession={!!session} profile={null} onFinish={finishInstallOobe} />
      );
    }
    return <Splash />;
  }

  /* ---------- OOBE: приветствия WinChat 5.0 (обновление / установка) ---------- */
  if (showInstallOobe) {
    document.title = "Добро пожаловать в WinChat";
    return (
      <OobeInstall hasSession={!!session} profile={profile} onFinish={finishInstallOobe} />
    );
  }
  if (showUpdateOobe) {
    document.title = "WinChat 5.0";
    return (
      <OobeUpdate
        winPro={profile ? isWinProActive(profile) : session ? null : false}
        onFinish={finishUpdateOobe}
      />
    );
  }

  /* ---------- Маршруты старого интерфейса ---------- */
  if (path.startsWith(LEGACY_PREFIX)) {
    if (!session || !profile) {
      // не авторизован — сначала вход
      window.history.replaceState({}, "", "/login");
      return <Auth />;
    }
    return (
      <LegacyScreen
        me={profile}
        /** Роут ведёт сразу в старый интерфейс, минуя плашку выбора. */
        skipAsk
        onStayNew={() => {
          declineLegacyUi();
          setLegacyAsk(false);
          window.history.pushState({}, "", "/chats");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />
    );
  }

  /* ---------- Не авторизован: /login и /registration ---------- */
  if (!session || !profile) {
    const route = path === "/registration" ? "register" : "login";
    // нормализуем адрес, если пользователь открыл корень
    if (path !== "/login" && path !== "/registration") {
      window.history.replaceState({}, "", `/${route}`);
    }
    return <Auth initialMode={route} />;
  }
  /* Авторизован на странице входа — уводим в чаты */
  if (path === "/login" || path === "/registration") {
    window.history.replaceState({}, "", "/chats");
  }
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

  /* ---------- Android-телефон в браузере → урезанная Lite-версия ---------- */
  if (isAndroidWebLite()) {
    document.title = "WinChat Lite";
    return <LiteMessenger me={profile} onLogout={() => supabase.auth.signOut()} />;
  }

  if (isLegacyUi())
    return (
      <LegacyScreen
        me={profile}
        onStayNew={() => {
          declineLegacyUi();
          setLegacyAsk(false);
        }}
      />
    );
  if (legacyAsk)
    return (
      <LegacyScreen
        me={profile}
        onStayNew={() => {
          declineLegacyUi();
          setLegacyAsk(false);
        }}
      />
    );

  /* ---------- /themes/you/* — Material You только для WinPro ---------- */
  if (youMode && !isWinProActive(profile)) {
    return (
      <YouLocked
        me={profile}
        onBack={() => navigate("/chats")}
        onGetWinPro={() => navigate("/settings/status/winpro")}
      />
    );
  }

  /* ---------- /themes/glass/* — WinChat Glass (WinPro или админ) ---------- */
  if (glassMode && !isWinProActive(profile) && !isGlobalAdmin(profile)) {
    return (
      <GlassLocked
        me={profile}
        onBack={() => navigate("/chats")}
        onGetWinPro={() => navigate("/settings/status/winpro")}
      />
    );
  }

  /* ---------- /settings, /settings/status/winpro, /themes/{you,glass}/settings ---------- */
  const settingsTab =
    path === "/settings/status/winpro" ||
    path === "/themes/you/winpro" ||
    path === "/themes/glass/winpro"
      ? "winpro" as const
      : path === "/settings"
        ? "profile" as const
        : path === "/themes/you/settings" || path === "/themes/glass/settings"
          ? "customization" as const
          : null;

  return (
    <Messenger
      me={profile}
      onProfileSaved={setProfile}
      onLogout={() => supabase.auth.signOut()}
      onShowLegacy={() => {
        resetLegacyChoice(); // сбрасываем «user_declined» — плашка снова доступна
        setLegacyAsk(true);
      }}
      initialSettingsOpen={!!settingsTab}
      initialSettingsTab={settingsTab ?? undefined}
      youMode={themedMode}
      initialChatId={youMode ? youChatId : glassMode ? glassChatId : null}
      onYouChatRoute={(id) =>
        navigate(id ? `${themeRoutePrefix}/chat/${id}` : `${themeRoutePrefix}/chat`)
      }
      onExitYou={() => navigate("/chats")}
      onOpenYouSettings={() => navigate(`${themeRoutePrefix}/settings`)}
      onYouSettingsClosed={() => {
        if (themedMode) navigate(`${themeRoutePrefix}/chat`);
      }}
    />
  );
}
