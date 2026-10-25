import type { Profile } from "./supabase";

/** Проверить, активен ли WinPro */
export function hasWinPro(profile: Profile | null | undefined): boolean {
  if (!profile?.winpro_until) return false;
  return new Date(profile.winpro_until) > new Date();
}

/** Получить дни до окончания WinPro */
export function winproDaysLeft(profile: Profile | null | undefined): number {
  if (!profile?.winpro_until) return 0;
  const diff = new Date(profile.winpro_until).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Получить форматированную дату окончания */
export function winproExpiresLabel(profile: Profile | null | undefined): string {
  if (!profile?.winpro_until || !hasWinPro(profile)) return "";
  const d = new Date(profile.winpro_until);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
