import type { Profile } from "./supabase";
import designerBadge from "../bages/code_1.png";
import testerBadge from "../bages/code_2.jpg";
import oldBadge from "../bages/code_3.webp";

/** Один тип бейджа, выдаваемого админом. */
export interface AppBadge {
  code: number;
  label: string;
}

/** Всего три типа бейджей в профиль. */
export const BADGES: AppBadge[] = [
  { code: 1, label: "Дизайнер" },
  { code: 2, label: "Тестер" },
  { code: 3, label: "Олд" },
];

export const BADGE_LABELS: Record<number, string> = Object.fromEntries(
  BADGES.map((b) => [b.code, b.label])
);

export const BADGE_IMAGES: Record<number, string> = {
  1: designerBadge,
  2: testerBadge,
  3: oldBadge,
};

/** Коды бейджей, выданные пользователю (колонка profiles.badges — строка «1,2»). */
export function badgeCodes(profile?: Profile | null): number[] {
  const raw = profile?.badges;
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const codes: number[] = [];
  parts.forEach((p) => {
    const n = parseInt(String(p).trim(), 10);
    if ([1, 2, 3].includes(n) && !codes.includes(n)) codes.push(n);
  });
  return codes;
}

export function hasBadge(profile: Profile | null | undefined, code: number): boolean {
  return badgeCodes(profile).includes(code);
}

export function badgeLabel(code: number): string {
  return BADGE_LABELS[code] ?? "";
}
