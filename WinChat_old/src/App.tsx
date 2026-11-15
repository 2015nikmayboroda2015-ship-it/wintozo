import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "./lib/supabase";
import { checkBanned } from "./lib/adminApi";
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
        await supabase.from("profiles").insert({
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
